import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { requireRunnerAuth } from "@/lib/auth-runner";
import { castVoteSafe, getJury, JUROR_SLOTS, type JurorSlot } from "@/lib/jury";

// POST /api/jury/vote { jobId, slot: 1|2|3, approve: boolean }
// Server signs castVote with EVALUATOR_PK_<slot>. REQUIRES x-runner-token.
// On-chain "Not a jury member" rules out wrong slots, but the slot wallets
// ARE always members of their own juries, so an unauthenticated caller could
// otherwise force any verdict (including reject) on any jury job before the
// runner's diverse-AI verdicts even ran. The token closes that hole.
export async function POST(req: NextRequest) {
  const unauth = requireRunnerAuth(req);
  if (unauth) return unauth;
  const limited = rateLimit(req, "jury-vote", 20, 60_000);
  if (limited) return limited;
  try {
    const body = (await req.json()) as {
      jobId?: number | string;
      slot?: number;
      approve?: boolean;
    };
    if (body.jobId == null) {
      return NextResponse.json({ error: "jobId required" }, { status: 400 });
    }
    if (typeof body.approve !== "boolean") {
      return NextResponse.json({ error: "approve must be boolean" }, { status: 400 });
    }
    const slot = body.slot as JurorSlot;
    if (!JUROR_SLOTS.includes(slot)) {
      return NextResponse.json(
        { error: `slot must be one of ${JUROR_SLOTS.join("/")}` },
        { status: 400 }
      );
    }
    const id = BigInt(body.jobId);
    const result = await castVoteSafe(slot, id, body.approve);
    const jury = await getJury(id);
    return NextResponse.json({ ok: true, ...result, jury });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "vote failed" },
      { status: 500 }
    );
  }
}
