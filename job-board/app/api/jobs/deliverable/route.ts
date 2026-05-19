import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

// POST { chainJobId, content, hash }
// Persists the submitted deliverable off-chain so the client and evaluator
// can read the actual work on the job page (on-chain only stores the hash).
export async function POST(req: NextRequest) {
  try {
    const { chainJobId, content, hash } = (await req.json()) as {
      chainJobId?: number;
      content?: string;
      hash?: string;
    };
    if (
      chainJobId == null ||
      !content ||
      typeof content !== "string" ||
      !hash
    ) {
      return NextResponse.json(
        { error: "chainJobId, content, hash required" },
        { status: 400 }
      );
    }

    const db = getServiceClient();
    const { data: jobRow } = await db
      .from("jobs")
      .select("id")
      .eq("chain_job_id", chainJobId)
      .maybeSingle();
    if (!jobRow) {
      // No off-chain job row (metadata save had failed). Nothing to attach
      // the deliverable to; the on-chain submit still stands.
      return NextResponse.json({ saved: false, reason: "no job row" });
    }

    const isIpfs = content.startsWith("ipfs://");
    // Replace any prior deliverable for this job (re-submits overwrite).
    await db.from("deliverables").delete().eq("chain_job_id", chainJobId);
    const { error } = await db.from("deliverables").insert({
      job_id: jobRow.id,
      chain_job_id: chainJobId,
      deliverable_hash: hash,
      content_preview: content.slice(0, 200000),
      ipfs_cid: isIpfs ? content.replace("ipfs://", "") : null,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ saved: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Save deliverable error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
