// Types for the in-app Analytics dashboard (merged from the former
// standalone Phase 4 app, now a route on the job board).

export type CachedEvent = {
  id: number;
  block_number: number;
  tx_hash: string;
  event_name: string;
  job_id: number | null;
  amount_raw: string | null;
  from_address: string | null;
  to_address: string | null;
  logged_at: string;
};

export type DailyStat = {
  date: string;
  jobs_created: number;
  jobs_completed: number;
  jobs_rejected: number;
  volume_usdc: number;
};

export type StatsSnapshot = {
  total_jobs: number;
  active_jobs: number;
  completed_jobs: number;
  rejected_jobs: number;
  total_volume_usdc: string;
  events_24h: number;
  latest_block: number;
};

export type NarrationResponse = {
  headline: string;
  summary: string;
  trend: "up" | "down" | "neutral";
  generated_at: string;
};

// ERC-8183 event signatures, verified against the deployed AgenticCommerce
// implementation on ArcScan. topic0 is keccak256 of the FULL canonical
// signature; a wrong arg list yields the wrong topic and no logs.
export const ERC8183_EVENTS_ABI = [
  {
    name: "JobCreated",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "provider", type: "address", indexed: true },
      { name: "evaluator", type: "address", indexed: false },
      { name: "expiredAt", type: "uint256", indexed: false },
      { name: "hook", type: "address", indexed: false },
    ],
  },
  {
    name: "JobFunded",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    name: "JobSubmitted",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "provider", type: "address", indexed: true },
      { name: "deliverable", type: "bytes32", indexed: false },
    ],
  },
  {
    name: "JobCompleted",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "evaluator", type: "address", indexed: true },
      { name: "reason", type: "bytes32", indexed: false },
    ],
  },
  {
    name: "JobRejected",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "rejector", type: "address", indexed: true },
      { name: "reason", type: "bytes32", indexed: false },
    ],
  },
  {
    name: "Refunded",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    name: "BudgetSet",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
