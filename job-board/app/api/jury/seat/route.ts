import { NextRequest, NextResponse } from "next/server";
import { publicClient } from "@/lib/viem";
import { ADDRESSES } from "@/contracts/addresses";
import { ERC8183_ABI } from "@/contracts/abis";
import { rateLimit } from "@/lib/ratelimit";
import { getJury, isJuryHook, seatJuryFor } from "@/lib/jury";

// POST /api/jury/seat { jobId }
// Server calls hook.onDeliverableSubmitted to seat a 3-juror jury.
// Idempotent: returns the existing jury if one is already assigned.
// Authorization is enforced on-chain: only authorizedCaller (PRIVATE_KEY) can
// seat, so a hostile caller hitting this route still produces a revert at
// signing time. We still rate-limit to keep the RPC behaved.
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "jury-seat", 12, 60_000);
  if (limited) return limited;
  try {
    const { jobId } = (await req.json()) as { jobId?: number | string };
    if (jobId == null) {
      return NextResponse.json({ error: "jobId required" }, { status: 400 });
    }
    const id = BigInt(jobId);

    const job = (await publicClient.readContract({
      address: ADDRESSES.ERC8183_JOB,
      abi: ERC8183_ABI,
      functionName: "getJob",
      args: [id],
    })) as { id: bigint; budget: bigint; status: number; hook: string };
    if (job.id === 0n) {
      return NextResponse.json({ error: "job not found" }, { status: 404 });
    }
    if (!isJuryHook(job.hook)) {
      return NextResponse.json(
        { error: "job hook is not the multi-evaluator hook" },
        { status: 400 }
      );
    }
    if (Number(job.status) !== 2) {
      return NextResponse.json(
        { error: `job status ${job.status}, must be Submitted to seat a jury` },
        { status: 409 }
      );
    }

    const existing = await getJury(id);
    if (existing.assigned) {
      return NextResponse.json({ ok: true, idempotent: true, jury: existing });
    }

    // Pass the on-chain budget so jury rewards scale with the real escrow.
    const tx = await seatJuryFor(id, job.budget);
    const jury = await getJury(id);
    return NextResponse.json({ ok: true, tx, jury });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "seat failed" },
      { status: 500 }
    );
  }
}
