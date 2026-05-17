import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";

// Attempts a Circle testnet drip for ARC-TESTNET. The W3S key currently
// lacks faucet scope (Circle returns 403), so this usually responds with a
// graceful fallback telling the client to use the official faucet with the
// address it already has. If a faucet-scoped key is set, it just works.
export async function POST(req: NextRequest) {
  try {
    const { address } = (await req.json()) as { address?: string };
    if (!address || !isAddress(address)) {
      return NextResponse.json(
        { ok: false, message: "Enter a valid 0x wallet address." },
        { status: 400 }
      );
    }

    const key = process.env.CIRCLE_API_KEY;
    if (!key) {
      return NextResponse.json({
        ok: false,
        fallback: true,
        message: "Faucet not configured. Use the Circle faucet.",
        faucetUrl: "https://faucet.circle.com",
      });
    }

    const res = await fetch("https://api.circle.com/v1/faucet/drips", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        address,
        blockchain: "ARC-TESTNET",
        usdc: true,
        native: true,
      }),
    });

    if (res.ok) {
      return NextResponse.json({
        ok: true,
        message: "Test USDC requested. It should arrive shortly.",
      });
    }

    // Expected path with the W3S key: gated. Degrade gracefully.
    return NextResponse.json({
      ok: false,
      fallback: true,
      message:
        "Circle's programmatic faucet is gated for this key. Your address is ready below, open the Circle faucet and paste it.",
      faucetUrl: "https://faucet.circle.com",
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        fallback: true,
        message: "Faucet request failed. Use the Circle faucet.",
        faucetUrl: "https://faucet.circle.com",
      },
      { status: 502 }
    );
  }
}
