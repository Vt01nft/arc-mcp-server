"use client";

import { useEffect, useState, useCallback } from "react";
import { StatsGrid } from "@/components/StatsGrid";
import { JobsChart } from "@/components/JobsChart";
import { EventFeed } from "@/components/EventFeed";
import { NarrationCard } from "@/components/NarrationCard";
import type { StatsSnapshot, DailyStat, CachedEvent, NarrationResponse } from "@/lib/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsSnapshot | null>(null);
  const [daily, setDaily] = useState<DailyStat[]>([]);
  const [events, setEvents] = useState<CachedEvent[]>([]);
  const [narration, setNarration] = useState<NarrationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [narrating, setNarrating] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const [statsRes, eventsRes] = await Promise.all([
        fetch("/api/events?type=stats"),
        fetch("/api/events?type=feed&limit=20"),
      ]);
      const statsData = await statsRes.json();
      const eventsData = await eventsRes.json();

      setStats(statsData.stats ?? null);
      setDaily(statsData.daily ?? []);
      setEvents(eventsData.events ?? []);
      setLastSync(new Date().toLocaleTimeString());
    } catch {
      // silent retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  async function handleNarrate() {
    if (!stats) return;
    setNarrating(true);
    try {
      const res = await fetch("/api/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats, daily }),
      });
      const data: NarrationResponse = await res.json();
      setNarration(data);
    } catch {
      // silent
    }
    setNarrating(false);
  }

  async function handleSync() {
    try {
      await fetch("/api/sync", { method: "POST" });
      await fetchDashboard();
    } catch {
      // silent
    }
  }

  return (
    <div className="space-y-8">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Testnet Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">
            ERC-8183 job activity on Arc Testnet · Chain ID 5042002
            {lastSync && <span className="ml-2">· Updated {lastSync}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
          >
            Sync Chain
          </button>
          <button
            onClick={handleNarrate}
            disabled={narrating || !stats}
            className="px-3 py-1.5 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-lg transition-colors disabled:opacity-40"
          >
            {narrating ? "Narrating…" : "Narrate with Gemini"}
          </button>
        </div>
      </div>

      {/* Gemini narration */}
      {narration && <NarrationCard narration={narration} />}

      {/* Stats grid */}
      <StatsGrid stats={stats} loading={loading} />

      {/* Charts + Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <JobsChart data={daily} loading={loading} />
        </div>
        <div>
          <EventFeed events={events} loading={loading} />
        </div>
      </div>
    </div>
  );
}
