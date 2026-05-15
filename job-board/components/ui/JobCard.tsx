"use client";

import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { formatUsdc } from "@/lib/viem";
import type { Job } from "@/lib/supabase";

type Props = {
  job: Job;
  amount?: bigint;
  status?: number;
};

export function JobCard({ job, amount, status = 0 }: Props) {
  const displayAmount = amount != null ? formatUsdc(amount, 18) : null;

  return (
    <Link
      href={`/jobs/${job.chain_job_id}`}
      className="paper-card-soft"
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
          No. {job.chain_job_id}
        </span>
        <StatusBadge status={status} />
      </div>

      <p
        className="serif-h"
        style={{
          fontSize: 19,
          margin: 0,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {job.description}
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginTop: "auto",
        }}
      >
        <span className="tag">{job.category}</span>
        {displayAmount && (
          <span className="lst-b" style={{ fontSize: 20 }}>
            {displayAmount}
            <span className="u">USDC</span>
          </span>
        )}
      </div>

      <div
        style={{
          paddingTop: 12,
          borderTop: "1px solid var(--rule)",
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--ink-3)",
          }}
        >
          Client
        </span>
        <span className="mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>
          {job.client_address.slice(0, 6)}…{job.client_address.slice(-4)}
        </span>
      </div>
    </Link>
  );
}
