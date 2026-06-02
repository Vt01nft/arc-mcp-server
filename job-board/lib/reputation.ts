// ERC-8004 reputation: record on-chain feedback for a provider agent after a
// job settles. Best-effort — a feedback failure must never affect settlement,
// which has already happened on-chain by the time this runs.
import { keccak256, toBytes } from "viem";
import { publicClient, getWalletClient } from "./viem";
import { ADDRESSES } from "@/contracts/addresses";
import { ERC8004_REPUTATION_ABI } from "@/contracts/abis";

export type FeedbackSource = "jury" | "single-evaluator";

// value uses valueDecimals=0 (integer score). +100 approve, -100 reject.
const APPROVE_SCORE = 100n;
const REJECT_SCORE = -100n;

export async function giveAgentFeedback(opts: {
  agentId: number;
  approved: boolean;
  jobId: number;
  source: FeedbackSource;
  summary: string;
}): Promise<{ tx: `0x${string}` | null; error?: string }> {
  try {
    const wallet = getWalletClient(); // server evaluator wallet; open-caller fn
    const feedbackURI = `https://arc-job-board.vercel.app/jobs/${opts.jobId}`;
    const tx = await wallet.writeContract({
      address: ADDRESSES.ERC8004_REPUTATION,
      abi: ERC8004_REPUTATION_ABI,
      functionName: "giveFeedback",
      args: [
        BigInt(opts.agentId),
        opts.approved ? APPROVE_SCORE : REJECT_SCORE,
        0, // valueDecimals: value is an integer score
        "arc-job", // tag1: source platform
        opts.source === "jury" ? "jury" : "evaluator", // tag2: settlement path
        "", // endpoint
        feedbackURI, // feedbackURI: link to the job
        keccak256(toBytes(opts.summary.slice(0, 400))), // feedbackHash
      ],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
    return { tx };
  } catch (e) {
    return { tx: null, error: e instanceof Error ? e.message : String(e) };
  }
}
