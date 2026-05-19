import { NextRequest, NextResponse } from "next/server";
import { parseUnits } from "viem";
import { publicClient, getSignerFromEnv } from "@/lib/viem";
import { ADDRESSES } from "@/contracts/addresses";
import { ERC8183_ABI } from "@/contracts/abis";
import { agentByWallet } from "@/lib/agents";

export const maxDuration = 60;

type Job = {
  id: bigint;
  client: string;
  provider: string;
  evaluator: string;
  description: string;
  budget: bigint;
  expiredAt: bigint;
  status: number;
  hook: string;
};

// The agent is the on-chain provider, and ERC-8183 requires the provider to
// quote the price via setBudget() before the client can fund the escrow.
// Agent wallets are server-controlled, so the client calls this right after
// createJob; then the client approves + funds from their own wallet.
export async function POST(req: NextRequest) {
  try {
    const { jobId, amountUsdc } = (await req.json()) as {
      jobId?: number;
      amountUsdc?: string;
    };
    if (jobId == null || !Number.isInteger(jobId)) {
      return NextResponse.json({ ok: false, error: "jobId required" }, { status: 400 });
    }
    const amt = Number(amountUsdc ?? "0");
    if (!(amt > 0) || amt > 1000) {
      return NextResponse.json(
        { ok: false, error: "amountUsdc must be > 0 and <= 1000" },
        { status: 400 }
      );
    }

    const job = (await publicClient.readContract({
      address: ADDRESSES.ERC8183_JOB,
      abi: ERC8183_ABI,
      functionName: "getJob",
      args: [BigInt(jobId)],
    })) as Job;

    if (job.id === 0n) {
      return NextResponse.json({ ok: false, error: "job not found" }, { status: 404 });
    }
    const agent = agentByWallet(job.provider);
    if (!agent) {
      return NextResponse.json(
        { ok: false, error: "provider is not an agent wallet" },
        { status: 400 }
      );
    }
    // Only quote an unpriced, still-open job. Idempotent: if a budget is
    // already set, report success so the post flow can proceed to fund.
    if (Number(job.status) !== 0) {
      return NextResponse.json({
        ok: true,
        already: true,
        budget: job.budget.toString(),
        message: `Job status ${job.status}; budget already set or job past Open.`,
      });
    }
    if (job.budget > 0n) {
      return NextResponse.json({ ok: true, already: true, budget: job.budget.toString() });
    }

    const raw = parseUnits(String(amt), 6); // USDC ERC-20 interface = 6 dp
    const signer = getSignerFromEnv(agent.pkEnv);
    const hash = await signer.writeContract({
      address: ADDRESSES.ERC8183_JOB,
      abi: ERC8183_ABI,
      functionName: "setBudget",
      args: [BigInt(jobId), raw, "0x"],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    return NextResponse.json({ ok: true, budget: raw.toString(), setBudgetTx: hash });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error("agent/set-budget error:", m);
    return NextResponse.json({ ok: false, error: m }, { status: 500 });
  }
}
