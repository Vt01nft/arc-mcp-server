import { NextRequest, NextResponse } from "next/server";
import { getJury } from "@/lib/jury";

// GET /api/jury/[jobId] -> JuryView on-chain (no cache; jury state can flip
// in seconds when the runner casts its three votes).
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const id = BigInt(jobId);
  try {
    const jury = await getJury(id);
    return NextResponse.json(jury);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to read jury" },
      { status: 502 }
    );
  }
}
