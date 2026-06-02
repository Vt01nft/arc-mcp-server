import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { completeInboundTransfer, CCTP_DOMAIN } from "@/lib/cctp";

export const maxDuration = 300;

// POST /api/cctp/receive { burnTxHash, sourceDomain? }
// Given a CCTP burn tx on the source chain (default Optimism Sepolia), poll
// Circle's attestation and complete the mint on Arc. The server pays Arc gas,
// so the user receives USDC on Arc without holding Arc gas first. The mint is
// permissionless (gated by the attestation), so no privileged auth is needed;
// receiveMessage simply mints to whatever recipient the burn already committed
// to. Rate-limited to keep RPC/attestation polling sane.
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "cctp-receive", 10, 60_000);
  if (limited) return limited;
  try {
    const { burnTxHash, sourceDomain } = (await req.json()) as {
      burnTxHash?: string;
      sourceDomain?: number;
    };
    if (!burnTxHash || !/^0x[0-9a-fA-F]{64}$/.test(burnTxHash)) {
      return NextResponse.json(
        { error: "burnTxHash (0x… 32-byte hash) required" },
        { status: 400 }
      );
    }
    const result = await completeInboundTransfer({
      burnTxHash: burnTxHash as `0x${string}`,
      sourceDomain: sourceDomain ?? CCTP_DOMAIN.OPTIMISM_SEPOLIA,
    });
    if (!result.ok) {
      // Attestation not ready yet — client should retry shortly.
      return NextResponse.json(
        { ok: false, status: result.status, retry: true },
        { status: 202 }
      );
    }
    return NextResponse.json({ ok: true, mintTx: result.mintTx, status: result.status });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "cctp receive failed" },
      { status: 500 }
    );
  }
}
