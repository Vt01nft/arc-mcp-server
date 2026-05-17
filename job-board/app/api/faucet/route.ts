import { NextRequest, NextResponse } from "next/server";
import { isAddress, parseUnits, formatUnits } from "viem";
import { publicClient, getFaucetWalletClient } from "@/lib/viem";
import { getServiceClient } from "@/lib/supabase";

// Policy: only top up wallets below 5 USDC, give 5 USDC. Primary source is
// Circle's own faucet (Circle-funded); on Circle rate-limit/error we fall
// back to a transfer from the DEDICATED faucet wallet (isolated from the
// deployer/evaluator key). Abuse limits: 1 drip / address / 24h and
// 3 drips / IP / hour, tracked durably in Supabase (faucet_log).
const THRESHOLD = parseUnits("5", 18);
const DRIP = parseUnits("5", 18);
const PER_IP_HOUR = 3;

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
}

// Returns a deny reason, or null if allowed. Fails open only if the log
// table is missing (until it is created) so the faucet is not bricked;
// the dedicated wallet is intentionally small so interim risk is bounded.
async function rateDenied(
  address: string,
  ip: string
): Promise<string | null> {
  try {
    const db = getServiceClient();
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();

    const { data: addrHits, error: e1 } = await db
      .from("faucet_log")
      .select("id")
      .eq("address", address.toLowerCase())
      .gte("created_at", dayAgo)
      .limit(1);
    if (e1) return null; // table missing / unavailable: fail open
    if (addrHits && addrHits.length > 0) {
      return "This address already used the faucet in the last 24 hours.";
    }

    const { data: ipHits, error: e2 } = await db
      .from("faucet_log")
      .select("id")
      .eq("ip", ip)
      .gte("created_at", hourAgo);
    if (e2) return null;
    if (ipHits && ipHits.length >= PER_IP_HOUR) {
      return "Too many faucet requests from your network. Try again later.";
    }
    return null;
  } catch {
    return null; // never brick the faucet on logging failure
  }
}

async function logDrip(address: string, ip: string, source: string) {
  try {
    await getServiceClient()
      .from("faucet_log")
      .insert({ address: address.toLowerCase(), ip, source });
  } catch {
    /* best effort */
  }
}

async function tryCircle(address: string): Promise<boolean> {
  const key = process.env.CIRCLE_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.circle.com/v1/faucet/drips", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        address,
        blockchain: "ARC-TESTNET",
        native: true,
        usdc: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { address } = (await req.json()) as { address?: string };
    if (!address || !isAddress(address)) {
      return NextResponse.json(
        { ok: false, message: "Enter a valid 0x wallet address." },
        { status: 400 }
      );
    }
    const ip = clientIp(req);

    const denied = await rateDenied(address, ip);
    if (denied) {
      return NextResponse.json({ ok: false, message: denied }, { status: 429 });
    }

    const bal = await publicClient.getBalance({
      address: address as `0x${string}`,
    });
    if (bal >= THRESHOLD) {
      return NextResponse.json({
        ok: false,
        message: `You already have ${Number(formatUnits(bal, 18)).toFixed(
          2
        )} USDC. The faucet only tops up wallets below 5 USDC.`,
      });
    }

    // 1) Primary: Circle's own faucet (Circle-funded).
    if (await tryCircle(address)) {
      await logDrip(address, ip, "circle");
      return NextResponse.json({
        ok: true,
        source: "circle",
        message: "Requested from the Circle faucet. Arriving shortly.",
      });
    }

    // 2) Fallback: dedicated faucet wallet (not the evaluator key).
    const wallet = getFaucetWalletClient();
    const pool = await publicClient.getBalance({
      address: wallet.account.address,
    });
    if (pool < DRIP) {
      return NextResponse.json(
        {
          ok: false,
          fallback: true,
          faucetUrl: "https://faucet.circle.com",
          message:
            "Circle faucet is rate-limited and the backup pool is low. Use the Circle faucet directly.",
        },
        { status: 503 }
      );
    }
    const hash = await wallet.sendTransaction({
      to: address as `0x${string}`,
      value: DRIP,
    });
    await logDrip(address, ip, "treasury");
    return NextResponse.json({
      ok: true,
      source: "treasury",
      hash,
      message: "Circle faucet was busy, sent 5 USDC from the backup pool.",
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error("Faucet error:", m);
    return NextResponse.json(
      {
        ok: false,
        fallback: true,
        faucetUrl: "https://faucet.circle.com",
        message: "Faucet failed. Use the Circle faucet directly.",
      },
      { status: 502 }
    );
  }
}
