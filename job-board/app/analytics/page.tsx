"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  StatsSnapshot,
  CachedEvent,
  NarrationResponse,
  ByType,
} from "@/lib/analytics-types";

const EXPLORER = "https://testnet.arcscan.app";
const JOB_CONTRACT = "0x0747EEf0706327138c69792bF28Cd525089e4583";

const TYPE_ORDER = [
  "JobCreated",
  "BudgetSet",
  "JobFunded",
  "JobSubmitted",
  "JobCompleted",
  "JobRejected",
  "Refunded",
];

function short(h: string) {
  return h ? `${h.slice(0, 8)}...${h.slice(-6)}` : "";
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<StatsSnapshot | null>(null);
  const [byType, setByType] = useState<ByType>({});
  const [events, setEvents] = useState<CachedEvent[]>([]);
  const [narration, setNarration] = useState<NarrationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [narrating, setNarrating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [updated, setUpdated] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, f] = await Promise.all([
        fetch("/api/analytics/events?type=stats").then((r) => r.json()),
        fetch("/api/analytics/events?type=feed&limit=24").then((r) => r.json()),
      ]);
      setStats(s.stats ?? null);
      setByType(s.byType ?? {});
      setEvents(f.events ?? []);
      setUpdated(new Date().toLocaleTimeString());
    } catch {
      /* silent, retried on the interval */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function narrate() {
    if (!stats) return;
    setNarrating(true);
    try {
      const r = await fetch("/api/analytics/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats, daily: [] }),
      });
      const d = await r.json();
      if (!d.error) setNarration(d as NarrationResponse);
    } catch {
      /* silent */
    }
    setNarrating(false);
  }

  async function sync() {
    setSyncing(true);
    try {
      await fetch("/api/analytics/sync", { method: "POST" });
      await load();
    } catch {
      /* silent */
    }
    setSyncing(false);
  }

  const tiles = stats
    ? [
        { label: "Jobs Created", value: String(stats.total_jobs) },
        { label: "Active", value: String(stats.active_jobs) },
        { label: "Completed", value: String(stats.completed_jobs) },
        { label: "Rejected", value: String(stats.rejected_jobs) },
        { label: "Volume USDC", value: stats.total_volume_usdc },
        { label: "Cached Events", value: String(stats.cached_events ?? 0) },
        { label: "Latest Block", value: String(stats.latest_block) },
      ]
    : [];

  const typeRows = TYPE_ORDER.filter((t) => (byType[t] ?? 0) > 0).map((t) => ({
    name: t,
    count: byType[t] ?? 0,
  }));
  const maxType = typeRows.reduce((m, r) => Math.max(m, r.count), 1);
  const accentFor = (name: string) =>
    name === "JobCompleted"
      ? "var(--accent)"
      : name === "JobRejected" || name === "Refunded"
      ? "var(--ink-3)"
      : "var(--ink)";

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "48px 20px 0" }}>
      <div className="kicker">
        <span className="square" />
        Live Testnet Dashboard
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div>
          <h1 className="serif-h" style={{ fontSize: 46, margin: "0 0 8px" }}>
            Arc Analytics
          </h1>
          <p className="lede" style={{ fontSize: 15, margin: 0 }}>
            Every ERC-8183 job on Arc Testnet, chain 5042002.
            {updated ? ` Updated ${updated}.` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn btn-ghost"
            onClick={sync}
            disabled={syncing}
            style={{ height: 38, padding: "0 14px", fontSize: 13 }}
          >
            {syncing ? "Syncing..." : "Sync Chain"}
          </button>
          <button
            className="btn btn-primary"
            onClick={narrate}
            disabled={narrating || !stats}
            style={{ height: 38, padding: "0 14px", fontSize: 13 }}
          >
            {narrating ? "Narrating..." : "Narrate"}
          </button>
        </div>
      </div>

      {narration && (
        <div
          className="paper-card-soft"
          style={{ marginBottom: 24, borderLeft: "3px solid var(--accent)" }}
        >
          <div className="eyebrow accent" style={{ marginBottom: 8 }}>
            {narration.trend === "up"
              ? "Trending up"
              : narration.trend === "down"
              ? "Trending down"
              : "Steady"}
          </div>
          <h2
            className="serif-h"
            style={{ fontSize: 22, margin: "0 0 8px", lineHeight: 1.3 }}
          >
            {narration.headline}
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.65,
              color: "var(--ink-2)",
            }}
          >
            {narration.summary}
          </p>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(124px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {(loading && tiles.length === 0
          ? Array.from({ length: 7 }).map((_, i) => ({
              label: "",
              value: "...",
              k: i,
            }))
          : tiles.map((t, i) => ({ ...t, k: i }))
        ).map((t) => (
          <div key={t.k} className="paper-card" style={{ padding: "16px 18px" }}>
            <div
              className="eyebrow"
              style={{ fontSize: 10, marginBottom: 10, letterSpacing: 0.5 }}
            >
              {t.label || " "}
            </div>
            <div
              className="mono"
              style={{ fontSize: 25, color: "var(--ink)", fontWeight: 600 }}
            >
              {t.value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 20,
        }}
      >
        <div className="paper-card">
          <div className="eyebrow accent" style={{ marginBottom: 18 }}>
            On-chain Events by Type
          </div>
          {typeRows.length === 0 ? (
            <p style={{ fontSize: 14, color: "var(--ink-3)", margin: 0 }}>
              No synced events yet. Press Sync Chain.
            </p>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              {typeRows.map((r) => (
                <div key={r.name}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      marginBottom: 5,
                    }}
                  >
                    <span style={{ color: "var(--ink-2)" }}>{r.name}</span>
                    <span
                      className="mono"
                      style={{ color: "var(--ink)", fontWeight: 600 }}
                    >
                      {r.count}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      background: "var(--rule)",
                      borderRadius: 0,
                    }}
                  >
                    <div
                      style={{
                        height: 8,
                        width: `${Math.max(2, (r.count / maxType) * 100)}%`,
                        background: accentFor(r.name),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="paper-card">
          <div className="eyebrow accent" style={{ marginBottom: 18 }}>
            Recent Events
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxHeight: 340,
              overflowY: "auto",
            }}
          >
            {events.length === 0 ? (
              <p style={{ fontSize: 14, color: "var(--ink-3)", margin: 0 }}>
                Nothing cached yet.
              </p>
            ) : (
              events.map((e) => (
                <a
                  key={e.id}
                  href={`${EXPLORER}/tx/${e.tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom: "1px solid var(--rule)",
                    textDecoration: "none",
                    color: "var(--ink)",
                  }}
                >
                  <span style={{ fontSize: 13 }}>
                    {e.event_name}
                    {e.job_id != null ? (
                      <span style={{ color: "var(--ink-3)" }}>
                        {" "}
                        #{e.job_id}
                      </span>
                    ) : (
                      ""
                    )}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: "var(--ink-3)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    blk {e.block_number} · {short(e.tx_hash)}
                  </span>
                </a>
              ))
            )}
          </div>
        </div>
      </div>

      <a
        href={`${EXPLORER}/address/${JOB_CONTRACT}`}
        target="_blank"
        rel="noopener noreferrer"
        className="eyebrow"
        style={{
          display: "block",
          textAlign: "center",
          padding: "26px 0 44px",
        }}
      >
        View ERC-8183 contract on ArcScan
      </a>
    </div>
  );
}
