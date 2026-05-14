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
      className="block bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 hover:bg-zinc-800/50 transition-all duration-150 group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-xs font-mono text-zinc-500">
          #{job.chain_job_id}
        </span>
        <StatusBadge status={status} />
      </div>

      <p className="text-sm text-zinc-100 font-medium leading-snug mb-3 line-clamp-2 group-hover:text-white transition-colors">
        {job.description}
      </p>

      <div className="flex items-center justify-between mt-auto">
        <span className="text-xs px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700">
          {job.category}
        </span>
        {displayAmount && (
          <span className="text-sm font-semibold text-emerald-400">
            {displayAmount} USDC
          </span>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center gap-2">
        <span className="text-xs text-zinc-500">Client</span>
        <span className="text-xs font-mono text-zinc-400 truncate">
          {job.client_address.slice(0, 6)}…{job.client_address.slice(-4)}
        </span>
      </div>
    </Link>
  );
}
