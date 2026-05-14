import { JOB_STATUS_LABEL, JOB_STATUS_COLOR, type JobStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: number }) {
  const s = status as JobStatus;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${JOB_STATUS_COLOR[s] ?? "text-zinc-400 bg-zinc-400/10 border-zinc-400/20"}`}
    >
      {JOB_STATUS_LABEL[s] ?? "Unknown"}
    </span>
  );
}
