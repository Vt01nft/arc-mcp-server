import { NextResponse } from "next/server";
import { getEvaluatorPool } from "@/lib/jury";

// GET /api/evaluators -> EvaluatorPool snapshot read live from the registry.
// Read-only chain calls; cached briefly to keep RPC load down.
export const revalidate = 30;

export async function GET() {
  try {
    const pool = await getEvaluatorPool();
    return NextResponse.json(pool);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to read evaluator pool" },
      { status: 502 }
    );
  }
}
