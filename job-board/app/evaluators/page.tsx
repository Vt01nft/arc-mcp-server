"use client";

import { useCallback, useEffect, useState } from "react";
import type { EvaluatorPool } from "@/lib/jury";
import { useCircle } from "@/components/CircleProvider";
import { ADDRESSES } from "@/contracts/addresses";
import { EVALUATOR_REGISTRY_ABI } from "@/contracts/abis";

const EXPLORER = "https://testnet.arcscan.app";
const MIN_STAKE = "10"; // native USDC; matches EvaluatorRegistry.MIN_STAKE

function short(h: string) {
  return h ? `${h.slice(0, 6)}...${h.slice(-4)}` : "";
}

export default function EvaluatorsPage() {
  const circle = useCircle();
  const [pool, setPool] = useState<EvaluatorPool | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState<string | null>(null);

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

  const myAddr = circle.address?.toLowerCase();
  const me = pool?.evaluators.find((e) => e.address.toLowerCase() === myAddr);
  const isActiveJuror = !!me?.active;

  async function enroll() {
    if (circle.status !== "ready") {
      setEnrollMsg("Sign in with Circle first (button in the header).");
      return;
    }
    setEnrolling(true);
    setEnrollMsg(null);
    try {
      // register() is payable: msg.value = 10 native USDC stake.
      await circle.execute({
        address: ADDRESSES.EVALUATOR_REGISTRY,
        abi: EVALUATOR_REGISTRY_ABI,
        functionName: "register",
        args: [],
        amount: MIN_STAKE,
      });
      setEnrollMsg("Staked 10 USDC. You are now in the juror pool.");
      setTimeout(load, 2500);
    } catch (e) {
      setEnrollMsg(e instanceof Error ? e.message : "Enrollment failed.");
    } finally {
      setEnrolling(false);
    }
  }

  async function resign() {
    setEnrolling(true);
    setEnrollMsg(null);
    try {
      await circle.execute({
        address: ADDRESSES.EVALUATOR_REGISTRY,
        abi: EVALUATOR_REGISTRY_ABI,
        functionName: "deregister",
        args: [],
      });
      setEnrollMsg("Deregistered. Your 10 USDC stake was returned.");
      setTimeout(load, 2500);
    } catch (e) {
      setEnrollMsg(e instanceof Error ? e.message : "Deregister failed.");
    } finally {
      setEnrolling(false);
    }
  }

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

      {/* Become a juror — Circle-signed register() staking 10 USDC native. */}
      <div className="paper-card" style={{ marginBottom: 24, padding: "20px 22px" }}>
        <div className="eyebrow accent" style={{ marginBottom: 8 }}>
          {isActiveJuror ? "You are a juror" : "Become a juror"}
        </div>
        {isActiveJuror ? (
          <>
            <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.65, color: "var(--ink-2)" }}>
              Your wallet is in the active pool with {Number(me?.stake ?? 0).toFixed(0)}{" "}
              USDC staked
              {me && me.totalVotes > 0
                ? ` and ${me.correctVotes}/${me.totalVotes} correct votes`
                : ""}
              . You may be drawn onto any job&rsquo;s jury; vote from the job&rsquo;s{" "}
              <span className="mono">/jury</span> page. Deregistering returns your
              stake (blocked while you sit on an active jury).
            </p>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={resign}
              disabled={enrolling}
              style={{ height: 38, padding: "0 14px", fontSize: 13 }}
            >
              {enrolling ? "Working…" : "Deregister & withdraw stake"}
            </button>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.65, color: "var(--ink-2)" }}>
              Stake 10 USDC to join the jury pool. You will be drawn at random
              onto job juries, earn a share of the 5% fee for voting with the
              majority, and lose part of your stake for minority votes. Signed
              with your Circle wallet, one PIN.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={enroll}
              disabled={enrolling || circle.status !== "ready"}
              style={{ height: 40, padding: "0 16px", fontSize: 13 }}
            >
              {enrolling
                ? "Staking…"
                : circle.status !== "ready"
                ? "Sign in with Circle to join"
                : "Stake 10 USDC & join the pool"}
            </button>
          </>
        )}
        {enrollMsg && (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--ink-2)" }}>
            {enrollMsg}
          </p>
        )}
      </div>

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
