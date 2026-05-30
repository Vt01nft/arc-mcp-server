"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { JuryView } from "@/lib/jury";

const EXPLORER = "https://testnet.arcscan.app";
const VOTE_LABEL: Record<number, string> = { 0: "Pending", 1: "Approve", 2: "Reject" };
const VOTE_STATUS_CLASS: Record<number, string> = {
  0: "status status-submitted",
  1: "status status-completed",
  2: "status status-rejected",
};

function short(h: string) {
  return h ? `${h.slice(0, 6)}…${h.slice(-4)}` : "";
}

function fmtCountdown(secs: number): string {
  if (secs <= 0) return "deadline passed";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h}h ${m}m ${s}s`;
}

export default function JuryPage() {
  const params = useParams();
  const jobId = String(params?.jobId ?? "");

  const [jury, setJury] = useState<JuryView | null>(null);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [bridging, setBridging] = useState(false);
  const [bridgeMsg, setBridgeMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/jury/${jobId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed to load");
      setJury(data as JuryView);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed to load");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
    const t = setInterval(load, jury?.resolved ? 15_000 : 5_000);
    return () => clearInterval(t);
  }, [load, jury?.resolved]);

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  async function bridge() {
    setBridging(true);
    setBridgeMsg(null);
    try {
      const res = await fetch("/api/jury/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "bridge failed");
      setBridgeMsg(
        data.skipped
          ? `already bridged (${data.skipped})`
          : `Bridged to ERC-8183 ${data.approved ? "complete()" : "reject()"} tx ${short(data.tx)}`
      );
      load();
    } catch (e) {
      setBridgeMsg(e instanceof Error ? e.message : "bridge failed");
    } finally {
      setBridging(false);
    }
  }

  const countdown = jury ? jury.deadline - now : 0;
  const status: { label: string; cls: string } = !jury
    ? { label: "...", cls: "status status-submitted" }
    : !jury.assigned
    ? { label: "Not seated", cls: "status status-open" }
    : jury.resolved
    ? jury.approves > jury.rejects
      ? { label: "Approved", cls: "status status-completed" }
      : { label: "Rejected", cls: "status status-rejected" }
    : { label: "Voting", cls: "status status-submitted" };

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "48px 20px 0" }}>
      <div className="kicker">
        <span className="square" />
        Jury Settlement
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h1 className="serif-h" style={{ fontSize: 46, margin: "0 0 8px" }}>
            Job #{jobId}
          </h1>
          <p className="lede" style={{ fontSize: 15, margin: 0 }}>
            Three jurors are drawn from the staked pool, evaluate independently,
            and vote on-chain. 2-of-3 settles.
          </p>
        </div>
        <Link
          href={`/jobs/${jobId}`}
          className="btn btn-ghost"
          style={{ height: 38, padding: "0 14px", fontSize: 13 }}
        >
          View Job
        </Link>
      </div>

      {err && (
        <div
          className="paper-card-soft"
          style={{ marginBottom: 20, borderLeft: "3px solid var(--ink-3)" }}
        >
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)" }}>
            Could not read the jury: {err}
          </p>
        </div>
      )}

      {!loading && jury && !jury.assigned && (
        <div
          className="paper-card-soft"
          style={{ marginBottom: 20, borderLeft: "3px solid var(--accent)" }}
        >
          <div className="eyebrow accent" style={{ marginBottom: 8 }}>
            Jury not yet seated
          </div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)" }}>
            A jury is seated automatically after the deliverable is submitted.
            For a manual jury job, the seat step can be triggered server-side
            via <span className="mono">POST /api/jury/seat</span>.
          </p>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div className="paper-card" style={{ padding: "16px 18px" }}>
          <div className="serif-h" style={{ fontSize: 28, lineHeight: 1, marginBottom: 6 }}>
            <span className={status.cls}>{status.label}</span>
          </div>
          <div className="eyebrow">State</div>
        </div>
        <div className="paper-card" style={{ padding: "16px 18px" }}>
          <div className="serif-h mono" style={{ fontSize: 28, lineHeight: 1, marginBottom: 6 }}>
            {jury ? `${jury.approves}-${jury.rejects}` : "..."}
          </div>
          <div className="eyebrow">Tally (A-R)</div>
        </div>
        <div className="paper-card" style={{ padding: "16px 18px" }}>
          <div className="serif-h mono" style={{ fontSize: 22, lineHeight: 1, marginBottom: 6 }}>
            {jury && jury.assigned ? fmtCountdown(countdown) : "—"}
          </div>
          <div className="eyebrow">Deadline</div>
        </div>
      </div>

      <div className="paper-card" style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)" }}>
              <th style={{ padding: "12px 16px" }} className="eyebrow">Juror</th>
              <th style={{ padding: "12px 16px" }} className="eyebrow">Wallet</th>
              <th style={{ padding: "12px 16px" }} className="eyebrow">Vote</th>
            </tr>
          </thead>
          <tbody>
            {jury?.members.map((addr, i) => (
              <tr key={addr + i} style={{ borderBottom: "1px solid var(--rule)" }}>
                <td style={{ padding: "12px 16px" }} className="mono">#{i + 1}</td>
                <td style={{ padding: "12px 16px" }}>
                  <a
                    className="mono"
                    href={`${EXPLORER}/address/${addr}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: "none", color: "var(--ink)" }}
                  >
                    {short(addr)}
                  </a>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span className={VOTE_STATUS_CLASS[jury.votes[i] ?? 0]}>
                    {VOTE_LABEL[jury.votes[i] ?? 0]}
                  </span>
                </td>
              </tr>
            ))}
            {!jury?.assigned && !loading && (
              <tr>
                <td
                  colSpan={3}
                  style={{ padding: "28px 16px", color: "var(--ink-3)", textAlign: "center" }}
                >
                  Jury not seated yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {jury?.resolved && (
        <div className="paper-card-soft" style={{ marginBottom: 20 }}>
          <div className="eyebrow accent" style={{ marginBottom: 8 }}>
            Settlement
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ink-2)" }}>
            The jury has resolved on-chain. Bridge the outcome to the ERC-8183
            job (server evaluator wallet calls complete or reject).
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={bridge}
            disabled={bridging}
            style={{ height: 38, padding: "0 14px", fontSize: 13 }}
          >
            {bridging ? "Bridging…" : "Bridge to ERC-8183"}
          </button>
          {bridgeMsg && (
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--ink-2)" }}>
              {bridgeMsg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
