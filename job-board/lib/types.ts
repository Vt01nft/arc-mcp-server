export type JobStatus = 0 | 1 | 2 | 3 | 4 | 5;

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  0: "Open",
  1: "Funded",
  2: "Submitted",
  3: "Completed",
  4: "Rejected",
  5: "Expired",
};

/** Editorial status classes - see `.status-*` in globals.css */
export const JOB_STATUS_COLOR: Record<JobStatus, string> = {
  0: "status-open",
  1: "status-funded",
  2: "status-submitted",
  3: "status-completed",
  4: "status-rejected",
  5: "status-expired",
};

// Mirrors the deployed AgenticCommerce.Job struct (getJob).
export type ChainJob = {
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
