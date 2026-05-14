import { NextRequest, NextResponse } from "next/server";
import { publicClient, formatUsdc } from "@/lib/viem";
import { supabase } from "@/lib/supabase";
import { ADDRESSES } from "@/contracts/addresses";
import { ERC8183_ABI, JOB_STATUS } from "@/contracts/abis";
import type { ChainJob } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const jobId = parseInt(id, 10);
    if (isNaN(jobId) || jobId < 0) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    // Fetch on-chain state
    const chainJob = (await publicClient.readContract({
      address: ADDRESSES.ERC8183_JOB,
      abi: ERC8183_ABI,
      functionName: "jobs",
      args: [BigInt(jobId)],
    })) as ChainJob;

    // Fetch off-chain metadata from Supabase
    const [{ data: metadata }, { data: evaluation }, { data: deliverable }] =
      await Promise.all([
        supabase
          .from("jobs")
          .select("*")
          .eq("chain_job_id", jobId)
          .maybeSingle(),
        supabase
          .from("evaluations")
          .select("*")
          .eq("chain_job_id", jobId)
          .order("evaluated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("deliverables")
          .select("*")
          .eq("chain_job_id", jobId)
          .maybeSingle(),
      ]);

    return NextResponse.json({
      chain: {
        id: Number(chainJob.id),
        client: chainJob.client,
        provider: chainJob.provider,
        evaluator: chainJob.evaluator,
        expiry: Number(chainJob.expiry),
        amount: formatUsdc(chainJob.amount, 18), // native 18-decimal USDC
        status: chainJob.status,
        statusLabel: JOB_STATUS[chainJob.status] ?? "Unknown",
        deliverable: chainJob.deliverable,
        hook: chainJob.hook,
      },
      metadata: metadata ?? null,
      evaluation: evaluation ?? null,
      deliverable: deliverable ?? null,
    });
  } catch (err) {
    console.error("Get job error:", err);
    return NextResponse.json(
      { error: "Failed to fetch job data" },
      { status: 500 }
    );
  }
}
