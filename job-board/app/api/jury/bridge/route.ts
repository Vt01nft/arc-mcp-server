import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { requireRunnerAuth } from "@/lib/auth-runner";
import { bridgeToErc8183, getJury } from "@/lib/jury";

// POST /api/jury/bridge { jobId }
// Read jury outcome and call complete/reject on ERC-8183 from the server
// evaluator wallet. REQUIRES x-runner-token. The outcome is deterministic
// from on-chain votes so a hostile caller can't change it, but spamming
// this endpoint would still burn server-wallet gas on every jury job and
// front-run the runner's own bridge call.
export async function POST(req: NextRequest) {
  const unauth = requireRunnerAuth(req);
  if (unauth) return unauth;
  const limited = rateLimit(req, "jury-bridge", 12, 60_000);
  if (limited) return limited;
  try {
    const { jobId } = (await req.json()) as { jobId?: number | string };
    if (jobId == null) {
      return NextResponse.json({ error: "jobId required" }, { status: 400 });
    }
    const id = BigInt(jobId);
    const jury = await getJury(id);
    if (!jury.assigned) {
      return NextResponse.json({ error: "no jury for this job" }, { status: 404 });
    }
    if (!jury.resolved) {
      return NextResponse.json(
        { error: "jury has not resolved yet", jury },
        { status: 409 }
      );
    }
    const approved = jury.approves > jury.rejects;
    const reasonText = approved
      ? `jury approved ${jury.approves}-${jury.rejects}`
      : `jury rejected ${jury.rejects}-${jury.approves}`;
    const result = await bridgeToErc8183(id, approved, reasonText);
    return NextResponse.json({ ok: true, approved, ...result, jury });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "bridge failed" },
      { status: 500 }
    );
  }
}
