export type JobStatus = 0 | 1 | 2 | 3 | 4 | 5;

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  0: "Open",
  1: "Funded",
  2: "Submitted",
  3: "Completed",
  4: "Rejected",
  5: "Expired",
};

export const JOB_STATUS_COLOR: Record<JobStatus, string> = {
  0: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  1: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  2: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  3: "text-green-400 bg-green-400/10 border-green-400/20",
  4: "text-red-400 bg-red-400/10 border-red-400/20",
  5: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
};

export type ChainJob = {
  id: bigint;
  client: `0x${string}`;
  provider: `0x${string}`;
  evaluator: `0x${string}`;
  expiry: bigint;
  description: `0x${string}`;
  amount: bigint;
  status: number;
  deliverable: `0x${string}`;
  hook: `0x${string}`;
};

export type EvaluateRequest = {
  jobId: number;
  description: string;
  deliverable: string;
};

export type EvaluateResponse = {
  decision: "approve" | "reject";
  reasoning: string;
  confidence: number;
};

export const JOB_CATEGORIES = [
  "General",
  "Development",
  "Design",
  "Research",
  "Writing",
  "Data",
  "AI/ML",
  "Security",
  "DevOps",
  "Other",
] as const;

export type JobCategory = (typeof JOB_CATEGORIES)[number];
