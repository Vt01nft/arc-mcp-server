import { NextRequest, NextResponse } from "next/server";
import { isAddress, parseUnits, formatUnits } from "viem";
import { publicClient, getWalletClient } from "@/lib/viem";

// Project-run testnet faucet: the server signs a native USDC transfer from
// the project treasury to the recipient. Circle's hosted faucet API is gated
// for our W3S key (403), so we dispense directly. Arc's native gas token is
// USDC (18 decimals); a value transfer credits spendable USDC for gas and
// for ERC-8183 escrow.
const DRIP = parseUnits("2", 18); // 2 USDC per request
const CAP = parseUnits("5", 18); // skip if recipient already has >= 5 USDC

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
    if (bal >= CAP) {
      return NextResponse.json({
        ok: false,
        message: `You already have ${Number(formatUnits(bal, 18)).toFixed(
          2
        )} USDC. Faucet skipped (cap 5).`,
      });
    }

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
          message: "Faucet treasury is low. Use the Circle faucet for now.",
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
      hash,
      amount: "2",
      message: "2 USDC sent. Arriving in a few seconds.",
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error("Faucet error:", m);
    return NextResponse.json(
      {
        ok: false,
        fallback: true,
        faucetUrl: "https://faucet.circle.com",
        message: "Faucet failed. Use the Circle faucet.",
      },
      { status: 502 }
    );
  }
}
