import { NextRequest, NextResponse } from "next/server";
import { contractExecutionChallenge } from "@/lib/circle";

// POST { userToken, walletId, contractAddress, abiFunctionSignature,
//        abiParameters, amount? } -> { challengeId }
// The client then PIN-signs the challenge with the Circle web SDK.
export async function POST(req: NextRequest) {
  try {
    const b = (await req.json()) as {
      userToken?: string;
      walletId?: string;
      contractAddress?: string;
      abiFunctionSignature?: string;
      abiParameters?: unknown[];
      amount?: string;
    };
    if (
      !b.userToken ||
      !b.walletId ||
      !b.contractAddress ||
      !b.abiFunctionSignature ||
      !Array.isArray(b.abiParameters)
    ) {
      return NextResponse.json(
        { error: "userToken, walletId, contractAddress, abiFunctionSignature, abiParameters required" },
        { status: 400 }
      );
    }
    const challengeId = await contractExecutionChallenge(b.userToken, {
      walletId: b.walletId,
      contractAddress: b.contractAddress,
      abiFunctionSignature: b.abiFunctionSignature,
      abiParameters: b.abiParameters,
      amount: b.amount,
    });
    return NextResponse.json({ challengeId });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    console.error("Circle contract challenge error:", e?.message);
    return NextResponse.json(
      { error: "Circle transaction failed to build" },
      { status: e?.status && e.status >= 400 ? 502 : 500 }
    );
  }
}
