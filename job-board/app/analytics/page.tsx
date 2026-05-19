"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  StatsSnapshot,
  DailyStat,
  CachedEvent,
  NarrationResponse,
} from "@/lib/analytics-types";

const EXPLORER = "https://testnet.arcscan.app";

function short(h: string) {
  return h ? `${h.slice(0, 8)}...${h.slice(-6)}` : "";
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<StatsSnapshot | null>(null);
  const [daily, setDaily] = useState<DailyStat[]>([]);
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
        fetch("/api/analytics/events?type=feed&limit=20").then((r) => r.json()),
      ]);
      setStats(s.stats ?? null);
      setDaily(s.daily ?? []);
      setEvents(f.events ?? []);
      setUpdated(new Date().toLocaleTimeString());
    } catch {
      /* silent retry on next tick */
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
        body: JSON.stringify({ stats, daily }),
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

  const tiles: { label: string; value: string }[] = stats
    ? [
        { label: "Total Jobs", value: String(stats.total_jobs) },
        { label: "Active", value: String(stats.active_jobs) },
        { label: "Completed", value: String(stats.completed_jobs) },
        { label: "Rejected", value: String(stats.rejected_jobs) },
        { label: "Volume USDC", value: stats.total_volume_usdc },
        { label: "Events 24h", value: String(stats.events_24h) },
        { label: "Latest Block", value: String(stats.latest_block) },
      ]
    : [];

  const maxBar =
    daily.reduce(
      (m, d) =>
        Math.max(m, d.jobs_created, d.jobs_completed, d.jobs_rejected),
      0
    ) || 1;
  const last14 = daily.slice(-14);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 0 0" }}>
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
        }}
      >
        <div>
          <h1 className="serif-h" style={{ fontSize: 48, margin: "0 0 10px" }}>
            Arc Analytics
          </h1>
          <p className="lede" style={{ fontSize: 16, margin: 0 }}>
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
          style={{ marginTop: 24, borderLeft: "3px solid var(--accent)" }}
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
            style={{ fontSize: 24, margin: "0 0 8px", lineHeight: 1.3 }}
          >
            {narration.headline}
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.6,
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
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 12,
          marginTop: 24,
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
          <div key={t.k} className="paper-card" style={{ padding: 16 }}>
            <div
              className="eyebrow"
              style={{ fontSize: 10, marginBottom: 8 }}
            >
              {t.label || " "}
            </div>
            <div
              className="mono"
              style={{ fontSize: 24, color: "var(--ink)", fontWeight: 600 }}
            >
              {t.value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
          gap: 20,
          marginTop: 20,
        }}
      >
        <div className="paper-card">
          <div className="eyebrow accent" style={{ marginBottom: 16 }}>
            Daily Activity (last 14 days)
          </div>
          {last14.length === 0 ? (
            <p style={{ fontSize: 14, color: "var(--ink-3)" }}>
              No synced events yet. Press Sync Chain.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 8,
                height: 200,
              }}
            >
              {last14.map((d) => (
                <div
                  key={d.date}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                  }}
                  title={`${d.date}  created ${d.jobs_created}, completed ${d.jobs_completed}, rejected ${d.jobs_rejected}`}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 2,
                      height: 170,
                    }}
                  >
                    {[
                      { v: d.jobs_created, c: "var(--ink)" },
                      { v: d.jobs_completed, c: "var(--accent)" },
                      { v: d.jobs_rejected, c: "var(--ink-3)" },
                    ].map((b, i) => (
                      <div
                        key={i}
                        style={{
                          width: 7,
                          height: `${(b.v / maxBar) * 170}px`,
                          minHeight: b.v > 0 ? 3 : 0,
                          background: b.c,
                        }}
                      />
                    ))}
                  </div>
                  <span
                    className="mono"
                    style={{ fontSize: 9, color: "var(--ink-3)" }}
                  >
                    {d.date.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 14,
              fontSize: 11,
            }}
            className="mono"
          >
            <span>
              <b style={{ color: "var(--ink)" }}>&#9632;</b> created
            </span>
            <span>
              <b style={{ color: "var(--accent)" }}>&#9632;</b> completed
            </span>
            <span>
              <b style={{ color: "var(--ink-3)" }}>&#9632;</b> rejected
            </span>
          </div>
        </div>

        <div className="paper-card">
          <div className="eyebrow accent" style={{ marginBottom: 16 }}>
            Recent Events
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxHeight: 360,
              overflowY: "auto",
            }}
          >
            {events.length === 0 ? (
              <p style={{ fontSize: 14, color: "var(--ink-3)" }}>
                Nothing yet.
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
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "9px 0",
                    borderBottom: "1px solid var(--rule)",
                    textDecoration: "none",
                    color: "var(--ink)",
                  }}
                >
                  <span style={{ fontSize: 13 }}>
                    {e.event_name}
                    {e.job_id != null ? ` #${e.job_id}` : ""}
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--ink-3)" }}
                  >
                    {short(e.tx_hash)}
                  </span>
                </a>
              ))
            )}
          </div>
        </div>
      </div>

      <a
        href={`${EXPLORER}/address/0x0747EEf0706327138c69792bF28Cd525089e4583`}
        target="_blank"
        rel="noopener noreferrer"
        className="eyebrow"
        style={{
          display: "block",
          textAlign: "center",
          padding: "24px 0 40px",
        }}
      >
        View ERC-8183 contract on ArcScan
      </a>
    </div>
  );
}
