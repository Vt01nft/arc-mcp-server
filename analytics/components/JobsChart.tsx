"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { DailyStat } from "@/lib/types";

type Props = {
  data: DailyStat[];
  loading: boolean;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-zinc-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.fill }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export function JobsChart({ data, loading }: Props) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-zinc-100 mb-4">Job Activity (last 30 days)</h2>
      {loading ? (
        <div className="h-48 bg-zinc-800 rounded-lg animate-pulse" />
      ) : data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-zinc-600 text-sm">
          No data yet - sync chain to populate
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="date"
              tick={{ fill: "#71717a", fontSize: 10 }}
              tickFormatter={(v) => v.slice(5)} // MM-DD
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#71717a", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Legend
              formatter={(v) => <span style={{ color: "#71717a", fontSize: 11 }}>{v}</span>}
            />
            <Bar dataKey="jobs_created" name="Created" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            <Bar dataKey="jobs_completed" name="Completed" fill="#00d4aa" radius={[2, 2, 0, 0]} />
            <Bar dataKey="jobs_rejected" name="Rejected" fill="#ef4444" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
