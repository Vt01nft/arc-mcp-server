"use client";

import type { CachedEvent } from "@/lib/types";

type Props = {
  events: CachedEvent[];
  loading: boolean;
};

const EVENT_COLOR: Record<string, string> = {
  JobCreated: "text-blue-400",
  JobFunded: "text-yellow-400",
  DeliverableSubmitted: "text-purple-400",
  JobCompleted: "text-emerald-400",
  JobRejected: "text-red-400",
};

export function EventFeed({ events, loading }: Props) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3 h-full">
      <h2 className="text-sm font-semibold text-zinc-100">Live Event Feed</h2>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 bg-zinc-800 rounded animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-sm text-zinc-600 py-4 text-center">No events cached yet</p>
      ) : (
        <div className="space-y-1 overflow-y-auto max-h-72">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="flex items-start gap-2 py-1.5 border-b border-zinc-800/50 last:border-0"
            >
              <span
                className={`text-xs font-mono shrink-0 mt-0.5 ${EVENT_COLOR[ev.event_name] ?? "text-zinc-400"}`}
              >
                {ev.event_name}
              </span>
              <div className="min-w-0">
                {ev.job_id !== null && (
                  <span className="text-xs text-zinc-500">#{ev.job_id}</span>
                )}
                <a
                  href={`https://testnet.arcscan.app/tx/${ev.tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs font-mono text-zinc-600 hover:text-zinc-400 truncate transition-colors"
                >
                  {ev.tx_hash.slice(0, 10)}…
                </a>
                <p className="text-xs text-zinc-700">block {ev.block_number.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
