import { NextRequest, NextResponse } from "next/server";
import { isAddress, parseUnits, formatUnits } from "viem";
import { publicClient, getWalletClient } from "@/lib/viem";

// Faucet policy: only top up wallets that are low (< 5 USDC), and give 5 USDC.
// Primary source is Circle's own faucet API (Circle-funded). Circle heavily
// rate-limits it, so on 429/error we fall back to a project treasury transfer
// so the user is never blocked.
const THRESHOLD = parseUnits("5", 18); // only dispense if balance < 5 USDC
const DRIP = parseUnits("5", 18); // treasury fallback amount: 5 USDC

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
    return res.ok; // 2xx = Circle accepted the drip
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
      return NextResponse.json({
        ok: true,
        source: "circle",
        message: "Requested from the Circle faucet. Arriving shortly.",
      });
    }

    // 2) Fallback: project treasury transfer (Circle rate-limited or down).
    const wallet = getWalletClient();
    const treasury = await publicClient.getBalance({
      address: wallet.account.address,
    });
    if (treasury < DRIP) {
      return NextResponse.json(
        {
          ok: false,
          fallback: true,
          faucetUrl: "https://faucet.circle.com",
          message:
            "Circle faucet is rate-limited and the treasury is low. Try the Circle faucet directly.",
        },
        { status: 503 }
      );
    }
    const hash = await wallet.sendTransaction({
      to: address as `0x${string}`,
      value: DRIP,
    });
    return NextResponse.json({
      ok: true,
      source: "treasury",
      hash,
      message: "Circle faucet was busy, sent 5 USDC from the project pool.",
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
