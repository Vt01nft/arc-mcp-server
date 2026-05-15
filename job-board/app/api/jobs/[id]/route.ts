import { NextRequest, NextResponse } from "next/server";
import { publicClient, formatUsdc } from "@/lib/viem";
import { supabase } from "@/lib/supabase";
import { ADDRESSES } from "@/contracts/addresses";
import { ERC8183_ABI, JOB_STATUS } from "@/contracts/abis";

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

type OnchainJob = {
  id: bigint;
  client: `0x${string}`;
  provider: `0x${string}`;
  evaluator: `0x${string}`;
  description: string;
  budget: bigint;
  expiredAt: bigint;
  status: number;
  hook: `0x${string}`;
};

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

    // Fetch on-chain state (getJob returns the named Job struct)
    const chainJob = (await publicClient.readContract({
      address: ADDRESSES.ERC8183_JOB,
      abi: ERC8183_ABI,
      functionName: "getJob",
      args: [BigInt(jobId)],
    })) as OnchainJob;

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
        expiry: Number(chainJob.expiredAt),
        // budget is the ERC-20 USDC interface (6 decimals), not native 18
        amount: formatUsdc(chainJob.budget, 6),
        budgetRaw: chainJob.budget.toString(),
        status: chainJob.status,
        statusLabel: JOB_STATUS[chainJob.status] ?? "Unknown",
        // The Job struct has no deliverable field; the hash lives in the
        // JobSubmitted event. Submitted content is shown from Supabase.
        deliverable: ZERO_BYTES32,
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
