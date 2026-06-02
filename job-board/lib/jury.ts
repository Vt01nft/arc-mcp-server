// Server-side helpers for the v2 jury layer (EvaluatorRegistry +
// MultiEvaluatorHook). Reads, jury seating, vote signing, and ERC-8183
// settlement bridge all live here so the runner stays orchestration-only.
import { formatUnits, keccak256, toBytes, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { publicClient, getWalletClient, getSignerFromEnv } from "./viem";
import { ADDRESSES } from "@/contracts/addresses";
import {
  EVALUATOR_REGISTRY_ABI,
  MULTI_EVALUATOR_HOOK_ABI,
  ERC8183_ABI,
} from "@/contracts/abis";
import { geminiJSON } from "./gemini";
import { openrouterJSON } from "./ai";

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

export function isJuryHook(addr: string | null | undefined): boolean {
  return !!addr && addr.toLowerCase() === HOOK.toLowerCase();
}

// Hook needs native USDC to pay the 5% jury reward via registry.reward{value}.
// Keep a small reserve so jury _resolve doesn't revert on the first vote pass.
const HOOK_RESERVE_TOPUP_THRESHOLD = parseUnits("0.1", 18); // top up when under 0.1
const HOOK_RESERVE_TARGET = parseUnits("0.5", 18); // ~20 settlements at 0.025 fee each

export async function ensureHookFunded(): Promise<{ topped: boolean; balance: bigint }> {
  const balance = await publicClient.getBalance({ address: HOOK });
  if (balance >= HOOK_RESERVE_TOPUP_THRESHOLD) return { topped: false, balance };
  const wallet = getWalletClient();
  const need = HOOK_RESERVE_TARGET - balance;
  const hash = await wallet.sendTransaction({ to: HOOK, value: need });
  await publicClient.waitForTransactionReceipt({ hash });
  const fresh = await publicClient.getBalance({ address: HOOK });
  return { topped: true, balance: fresh };
}

export async function seatJuryFor(jobId: bigint, jobAmount: bigint): Promise<`0x${string}`> {
  // NOTE: this does NOT auto-fund the hook. Funding is a privileged spend and
  // must not be reachable from a request path (even the gated seat route), so
  // it lives in the trusted in-process runner (ensureHookFunded, called before
  // this) and in scripts/fund-hook.mjs for ops. The hook only needs balance to
  // pay the 5% reward on budget>0 jobs; budget==0 jobs need none.
  const wallet = getWalletClient(); // PRIVATE_KEY == authorizedCaller
  const hash = await wallet.writeContract({
    address: HOOK,
    abi: MULTI_EVALUATOR_HOOK_ABI,
    functionName: "onDeliverableSubmitted",
    args: [jobId, jobAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export const JUROR_SLOTS = [1, 2, 3] as const;
export type JurorSlot = (typeof JUROR_SLOTS)[number];

export function jurorPkEnv(slot: JurorSlot): string {
  return `EVALUATOR_PK_${slot}`;
}

// The wallet address behind a project-juror slot, derived from its key.
// Returns null if the key isn't configured. Cached per slot.
const projectJurorAddrCache = new Map<JurorSlot, `0x${string}` | null>();
export function projectJurorAddress(slot: JurorSlot): `0x${string}` | null {
  if (projectJurorAddrCache.has(slot)) return projectJurorAddrCache.get(slot)!;
  const pk = process.env[jurorPkEnv(slot)];
  let addr: `0x${string}` | null = null;
  if (pk) {
    try {
      addr = privateKeyToAccount(
        (pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`
      ).address;
    } catch {
      addr = null;
    }
  }
  projectJurorAddrCache.set(slot, addr);
  return addr;
}

// Which project slot (if any) owns a drawn jury member. Members that map to
// no slot are human jurors who vote for themselves via the /jury page.
export function slotForMember(addr: string): JurorSlot | null {
  const lower = (addr ?? "").toLowerCase();
  for (const slot of JUROR_SLOTS) {
    const a = projectJurorAddress(slot);
    if (a && a.toLowerCase() === lower) return slot;
  }
  return null;
}

export async function castVoteAs(
  slot: JurorSlot,
  jobId: bigint,
  approve: boolean
): Promise<`0x${string}`> {
  const wallet = getSignerFromEnv(jurorPkEnv(slot));
  const hash = await wallet.writeContract({
    address: HOOK,
    abi: MULTI_EVALUATOR_HOOK_ABI,
    functionName: "castVote",
    args: [jobId, approve],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

// Run castVote and treat the contract's idempotent reverts as no-ops so the
// runner can confidently cast all three votes in sequence without aborting
// after the 2nd vote already triggered _resolve.
export async function castVoteSafe(
  slot: JurorSlot,
  jobId: bigint,
  approve: boolean
): Promise<{ tx: `0x${string}` | null; skipped?: string }> {
  try {
    const tx = await castVoteAs(slot, jobId, approve);
    return { tx };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (/Already resolved|Already voted|Voting window closed|Not a jury member/i.test(m)) {
      return { tx: null, skipped: m.slice(0, 120) };
    }
    throw e;
  }
}

const reason = (s: string) => keccak256(toBytes(s.slice(0, 200)));

// Bridge the on-chain jury outcome back to ERC-8183. Server evaluator wallet
// (which is the job's `evaluator` for jury-bridged jobs) calls complete or
// reject. Idempotent: skip if job is no longer Submitted (status 2).
export async function bridgeToErc8183(
  jobId: bigint,
  approved: boolean,
  reasonText: string
): Promise<{ tx: `0x${string}` | null; skipped?: string }> {
  const job = (await publicClient.readContract({
    address: ADDRESSES.ERC8183_JOB,
    abi: ERC8183_ABI,
    functionName: "getJob",
    args: [jobId],
  })) as { status: number };
  if (Number(job.status) !== 2) {
    return { tx: null, skipped: `job status ${job.status}, not Submitted` };
  }
  const wallet = getWalletClient();
  const tx = await wallet.writeContract({
    address: ADDRESSES.ERC8183_JOB,
    abi: ERC8183_ABI,
    functionName: approved ? "complete" : "reject",
    args: [jobId, reason(reasonText), "0x"],
  });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  return { tx };
}

// Independent juror evaluation. Each juror uses a different model so the
// jury actually provides diversity instead of three copies of one verdict.
export type JurorVerdict = {
  slot: JurorSlot;
  modelLabel: string;
  approve: boolean;
  reasoning: string;
  confidence: number;
};

const JUROR_MODELS: Record<JurorSlot, { label: string; run: (p: string) => Promise<string> }> = {
  1: {
    label: "gemini-2.5-flash",
    run: (p) => geminiJSON(p, 1024, 256),
  },
  2: {
    label: "openrouter:openai/gpt-4o-mini",
    run: (p) => openrouterJSON(p, 1024, "openai/gpt-4o-mini"),
  },
  3: {
    label: "openrouter:anthropic/claude-sonnet-4.5",
    run: (p) => openrouterJSON(p, 1024, "anthropic/claude-sonnet-4.5"),
  },
};

function evalPrompt(brief: string, deliverable: string): string {
  return (
    `You are an independent juror on a 3-evaluator jury. Decide if the deliverable satisfies the brief. Strict but fair. Vote ONLY on the work, not on the brief. ` +
    `Return ONLY JSON {"approve":bool,"reasoning":"2-4 sentences","confidence":0..1}.\n\n` +
    `Brief:\n${brief.slice(0, 2500)}\n\n` +
    `Deliverable:\n${deliverable.slice(0, 120000)}`
  );
}

export async function jurorEvaluate(
  slot: JurorSlot,
  brief: string,
  deliverable: string
): Promise<JurorVerdict> {
  const { label, run } = JUROR_MODELS[slot];
  // On a model error we fail closed (reject with low confidence) rather than
  // crash the runner; the bridge then sends the actual ERC-8183 outcome.
  try {
    const raw = await run(evalPrompt(brief, deliverable));
    const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as {
      approve?: boolean;
      reasoning?: string;
      confidence?: number;
    };
    return {
      slot,
      modelLabel: label,
      approve: json.approve === true,
      reasoning: (json.reasoning ?? "no reasoning").slice(0, 800),
      confidence:
        typeof json.confidence === "number"
          ? Math.min(1, Math.max(0, json.confidence))
          : 0,
    };
  } catch (e) {
    return {
      slot,
      modelLabel: `${label} (errored)`,
      approve: false,
      reasoning: `evaluator failed: ${(e as Error).message?.slice(0, 200) ?? "unknown"}`,
      confidence: 0,
    };
  }
}

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
