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
  0: "#71717a",
  1: "#3b82f6",
  2: "#f59e0b",
  3: "#00d4aa",
  4: "#ef4444",
  5: "#6b7280",
};

// Supabase event_cache row
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

// Aggregated daily stats
export type DailyStat = {
  date: string;          // YYYY-MM-DD
  jobs_created: number;
  jobs_completed: number;
  jobs_rejected: number;
  volume_usdc: number;   // total USDC escrowed (6-decimal display)
};

// Claude narration response
export type NarrationResponse = {
  headline: string;
  summary: string;
  trend: "up" | "down" | "neutral";
  generated_at: string;
};

// Stats snapshot
export type StatsSnapshot = {
  total_jobs: number;
  active_jobs: number;
  completed_jobs: number;
  rejected_jobs: number;
  total_volume_usdc: string;
  events_24h: number;
  latest_block: number;
};
