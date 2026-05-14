"use client";

import type { StatsSnapshot } from "@/lib/types";

type Props = {
  stats: StatsSnapshot | null;
  loading: boolean;
};

export function StatsGrid({ stats, loading }: Props) {
  const tiles = [
    { label: "Total Jobs", value: stats?.total_jobs, suffix: "" },
    { label: "Active Jobs", value: stats?.active_jobs, suffix: "" },
    { label: "Completed", value: stats?.completed_jobs, suffix: "" },
    { label: "Total Volume", value: stats?.total_volume_usdc, suffix: " USDC" },
    { label: "Events (24h)", value: stats?.events_24h, suffix: "" },
    { label: "Latest Block", value: stats?.latest_block?.toLocaleString(), suffix: "" },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {tiles.map(({ label, value, suffix }) => (
        <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1">{label}</p>
          <p className="text-xl font-bold text-white">
            {value !== undefined && value !== null ? `${value}${suffix}` : "—"}
          </p>
        </div>
      ))}
    </div>
  );
}
