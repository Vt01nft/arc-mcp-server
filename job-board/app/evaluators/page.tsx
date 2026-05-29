"use client";

import { useCallback, useEffect, useState } from "react";
import type { EvaluatorPool } from "@/lib/jury";

const EXPLORER = "https://testnet.arcscan.app";

function short(h: string) {
  return h ? `${h.slice(0, 6)}...${h.slice(-4)}` : "";
}

export default function EvaluatorsPage() {
  const [pool, setPool] = useState<EvaluatorPool | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/evaluators");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setPool(data as EvaluatorPool);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const tiles = pool
    ? [
        { label: "Active Evaluators", value: String(pool.activeCount) },
        { label: "Min Stake (USDC)", value: pool.minStake },
        {
          label: "Jury Status",
          value: pool.juryReady ? "Ready" : `Need ${3 - pool.activeCount}`,
        },
      ]
    : [];

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "48px 20px 0" }}>
      <div className="kicker">
        <span className="square" />
        Multi-Evaluator Jury
      </div>

      <div style={{ marginBottom: 28 }}>
        <h1 className="serif-h" style={{ fontSize: 46, margin: "0 0 8px" }}>
          Evaluators
        </h1>
        <p className="lede" style={{ fontSize: 15, margin: 0, maxWidth: 640 }}>
          A staked jury settles deliverables instead of a single evaluator.
          Three jurors are drawn at random per job; a 2-of-3 vote decides, and
          minority voters are slashed. Stake is native USDC on Arc Testnet.
        </p>
      </div>

      {err && (
        <div
          className="paper-card-soft"
          style={{ marginBottom: 20, borderLeft: "3px solid var(--ink-3)" }}
        >
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)" }}>
            Could not read the registry: {err}
          </p>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {(loading && tiles.length === 0
          ? Array.from({ length: 3 }).map((_, i) => ({ label: "", value: "...", k: i }))
          : tiles.map((t, i) => ({ ...t, k: i }))
        ).map((t) => (
          <div key={t.k} className="paper-card" style={{ padding: "16px 18px", minWidth: 0 }}>
            <div
              className="serif-h"
              style={{ fontSize: 30, lineHeight: 1, marginBottom: 6 }}
            >
              {t.value}
            </div>
            <div className="eyebrow">{t.label}</div>
          </div>
        ))}
      </div>

      {!pool?.juryReady && !loading && (
        <div
          className="paper-card-soft"
          style={{ marginBottom: 24, borderLeft: "3px solid var(--accent)" }}
        >
          <div className="eyebrow accent" style={{ marginBottom: 8 }}>
            Pool not yet active
          </div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "var(--ink-2)" }}>
            A jury needs at least three staked evaluators before it can be
            seated. Until the pool reaches three, jobs settle through the
            single-evaluator path.
          </p>
        </div>
      )}

      <div className="paper-card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)" }}>
              <th style={{ padding: "12px 16px" }} className="eyebrow">Evaluator</th>
              <th style={{ padding: "12px 16px" }} className="eyebrow">Stake</th>
              <th style={{ padding: "12px 16px" }} className="eyebrow">Votes</th>
              <th style={{ padding: "12px 16px" }} className="eyebrow">Accuracy</th>
              <th style={{ padding: "12px 16px" }} className="eyebrow">Status</th>
            </tr>
          </thead>
          <tbody>
            {pool && pool.evaluators.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{ padding: "28px 16px", color: "var(--ink-3)", textAlign: "center" }}
                >
                  No evaluators registered yet.
                </td>
              </tr>
            )}
            {pool?.evaluators.map((e) => (
              <tr key={e.address} style={{ borderBottom: "1px solid var(--rule)" }}>
                <td style={{ padding: "12px 16px" }}>
                  <a
                    className="mono"
                    href={`${EXPLORER}/address/${e.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: "none", color: "var(--ink)" }}
                  >
                    {short(e.address)}
                  </a>
                </td>
                <td style={{ padding: "12px 16px" }} className="mono">
                  {Number(e.stake).toFixed(2)}
                </td>
                <td style={{ padding: "12px 16px" }} className="mono">
                  {e.correctVotes}/{e.totalVotes}
                </td>
                <td style={{ padding: "12px 16px" }} className="mono">
                  {e.accuracy === null ? "—" : `${Math.round(e.accuracy * 100)}%`}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span className={`status ${e.active ? "status-completed" : "status-rejected"}`}>
                    {e.active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
