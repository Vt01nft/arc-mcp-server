// Server-side read helpers for the v2 jury layer (EvaluatorRegistry +
// MultiEvaluatorHook). Reads only — seating juries and casting votes are
// writes handled elsewhere (runner / juror wallets).
import { formatUnits } from "viem";
import { publicClient } from "./viem";
import { ADDRESSES } from "@/contracts/addresses";
import { EVALUATOR_REGISTRY_ABI, MULTI_EVALUATOR_HOOK_ABI } from "@/contracts/abis";

const REGISTRY = ADDRESSES.EVALUATOR_REGISTRY;
const HOOK = ADDRESSES.MULTI_EVALUATOR_HOOK;

export type Evaluator = {
  address: `0x${string}`;
  stake: string; // native USDC, human-readable
  totalVotes: number;
  correctVotes: number;
  accuracy: number | null; // 0..1, null if no votes yet
  active: boolean;
  lockedUntil: number; // unix seconds, 0 if unlocked
};

export type EvaluatorPool = {
  evaluators: Evaluator[];
  activeCount: number;
  minStake: string; // native USDC, human-readable
  juryReady: boolean; // >= 3 active evaluators
};

// evaluatorList is a public array with an index getter but no length getter,
// so walk it until an out-of-bounds read reverts. The pool is tiny (<=~10).
async function listEvaluators(max = 100): Promise<`0x${string}`[]> {
  const out: `0x${string}`[] = [];
  for (let i = 0; i < max; i++) {
    try {
      const addr = (await publicClient.readContract({
        address: REGISTRY,
        abi: EVALUATOR_REGISTRY_ABI,
        functionName: "evaluatorList",
        args: [BigInt(i)],
      })) as `0x${string}`;
      out.push(addr);
    } catch {
      break;
    }
  }
  return out;
}

export async function getEvaluatorPool(): Promise<EvaluatorPool> {
  const [addresses, activeCount, minStake] = await Promise.all([
    listEvaluators(),
    publicClient.readContract({
      address: REGISTRY,
      abi: EVALUATOR_REGISTRY_ABI,
      functionName: "activeCount",
    }) as Promise<bigint>,
    publicClient.readContract({
      address: REGISTRY,
      abi: EVALUATOR_REGISTRY_ABI,
      functionName: "MIN_STAKE",
    }) as Promise<bigint>,
  ]);

  const evaluators = await Promise.all(
    addresses.map(async (address): Promise<Evaluator> => {
      const [rec, locked] = await Promise.all([
        publicClient.readContract({
          address: REGISTRY,
          abi: EVALUATOR_REGISTRY_ABI,
          functionName: "evaluators",
          args: [address],
        }) as Promise<[bigint, bigint, bigint, boolean]>,
        publicClient.readContract({
          address: REGISTRY,
          abi: EVALUATOR_REGISTRY_ABI,
          functionName: "lockedUntil",
          args: [address],
        }) as Promise<bigint>,
      ]);
      const [stake, totalVotes, correctVotes, active] = rec;
      return {
        address,
        stake: formatUnits(stake, 18),
        totalVotes: Number(totalVotes),
        correctVotes: Number(correctVotes),
        accuracy: totalVotes > 0n ? Number(correctVotes) / Number(totalVotes) : null,
        active,
        lockedUntil: Number(locked),
      };
    })
  );

  return {
    evaluators,
    activeCount: Number(activeCount),
    minStake: formatUnits(minStake, 18),
    juryReady: activeCount >= 3n,
  };
}

export type JuryView = {
  jobId: string;
  assigned: boolean;
  members: `0x${string}`[];
  votes: number[]; // 0=Pending 1=Approve 2=Reject, aligned with members
  deadline: number; // unix seconds
  resolved: boolean;
  approves: number;
  rejects: number;
};

export async function getJury(jobId: bigint): Promise<JuryView> {
  const [members, votes, deadline, resolved, approves, rejects] =
    (await publicClient.readContract({
      address: HOOK,
      abi: MULTI_EVALUATOR_HOOK_ABI,
      functionName: "getJury",
      args: [jobId],
    })) as readonly [
      readonly [`0x${string}`, `0x${string}`, `0x${string}`],
      readonly [number, number, number],
      bigint,
      boolean,
      number,
      number
    ];

  return {
    jobId: jobId.toString(),
    assigned: deadline > 0n,
    members: [...members],
    votes: [...votes],
    deadline: Number(deadline),
    resolved,
    approves,
    rejects,
  };
}
