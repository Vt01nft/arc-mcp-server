import { JOB_STATUS_LABEL, JOB_STATUS_COLOR, type JobStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: number }) {
  const s = status as JobStatus;
  return (
    <span className={`status ${JOB_STATUS_COLOR[s] ?? "status-open"}`}>
      <span className="pill" />
      {JOB_STATUS_LABEL[s] ?? "Unknown"}
    </span>
  );
}
