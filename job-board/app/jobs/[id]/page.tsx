"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAccount, useWriteContract } from "wagmi";
import { keccak256, toBytes, parseUnits } from "viem";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ADDRESSES } from "@/contracts/addresses";
import { ERC8183_ABI, USDC_ABI } from "@/contracts/abis";
import { publicClient } from "@/lib/viem";
import type { EvaluateResponse } from "@/lib/types";

type JobData = {
  chain: {
    id: number;
    client: string;
    provider: string;
    evaluator: string;
    expiry: number;
    amount: string;
    budgetRaw: string;
    status: number;
    statusLabel: string;
    deliverable: string;
    hook: string;
  };
  metadata: {
    description: string;
    category: string;
    client_address: string;
  } | null;
  evaluation: {
    decision: string;
    reasoning: string;
    confidence: number;
    evaluated_at: string;
  } | null;
  deliverable: {
    ipfs_cid: string | null;
    content_preview: string | null;
    submitted_at: string;
  } | null;
};

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { address } = useAccount();
  const { writeContract, writeContractAsync, isPending: isTxPending } =
    useWriteContract();

  const [job, setJob] = useState<JobData | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<EvaluateResponse | null>(null);
  const [deliverableInput, setDeliverableInput] = useState("");
  const [reason, setReason] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [funding, setFunding] = useState(false);
  const [escrowErr, setEscrowErr] = useState<string | null>(null);

  // `loading` is derived: true until the fetch for the current `id` resolves.
  // When `id` changes, loadedId is stale so this flips back to true on render,
  // same UX as before, without a synchronous setState inside the effect.
  const loading = loadedId !== id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch(`/api/jobs/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setJob(data.error ? null : data);
      })
      .catch(() => {
        if (!cancelled) setJob(null);
      })
      .finally(() => {
        if (!cancelled) setLoadedId(id);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleEvaluate() {
    if (!job?.metadata || !job.deliverable) return;
    setEvaluating(true);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.chain.id,
          description: job.metadata.description,
          deliverable: job.deliverable.content_preview ?? job.chain.deliverable,
        }),
      });
      const result: EvaluateResponse = await res.json();
      setEvalResult(result);
    } catch {
      // silent - user can retry
    }
    setEvaluating(false);
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 0 0" }}>
        <div
          style={{
            height: 24,
            width: 160,
            background: "var(--paper-2)",
            border: "1px solid var(--rule)",
            marginBottom: 16,
          }}
        />
        <div
          style={{
            height: 280,
            background: "var(--paper-2)",
            border: "1px solid var(--rule)",
          }}
        />
      </div>
    );
  }

  if (!job) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "96px 0",
          color: "var(--ink-3)",
        }}
      >
        <p className="serif-h" style={{ fontSize: 32, margin: "0 0 16px" }}>
          Job not found
        </p>
        <Link href="/jobs" className="link-underline">
          Back to the classifieds
        </Link>
      </div>
    );
  }

  const { chain, metadata, deliverable } = job;
  const isProvider =
    address && chain.provider !== ZERO_BYTES32
      ? address.toLowerCase() === chain.provider.toLowerCase()
      : false;
  const isEvaluator =
    address && chain.evaluator !== ZERO_BYTES32
      ? address.toLowerCase() === chain.evaluator.toLowerCase()
      : false;
  const isClient =
    address && chain.client !== ZERO_BYTES32
      ? address.toLowerCase() === chain.client.toLowerCase()
      : false;
  const budgetRaw = BigInt(chain.budgetRaw || "0");
  const isOpen = chain.status === 0;

  // Client funds escrow: approve USDC for the job contract, then fund().
  // fund() pulls job.budget via USDC.transferFrom, so an allowance is required.
  async function handleFund() {
    if (!isClient || budgetRaw <= 0n) return;
    setEscrowErr(null);
    setFunding(true);
    try {
      const approveHash = await writeContractAsync({
        address: ADDRESSES.USDC,
        abi: USDC_ABI,
        functionName: "approve",
        args: [ADDRESSES.ERC8183_JOB, budgetRaw],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      const fundHash = await writeContractAsync({
        address: ADDRESSES.ERC8183_JOB,
        abi: ERC8183_ABI,
        functionName: "fund",
        args: [BigInt(chain.id), "0x"],
      });
      await publicClient.waitForTransactionReceipt({ hash: fundHash });
      window.location.reload();
    } catch (e) {
      const m = e as Error & { shortMessage?: string };
      setEscrowErr(m.shortMessage || m.message || "Funding failed.");
    } finally {
      setFunding(false);
    }
  }

  const hasDeliverable =
    chain.deliverable && chain.deliverable !== ZERO_BYTES32;
  const activeEvaluation = evalResult ?? job.evaluation;
  const expiryDate = new Date(chain.expiry * 1000).toLocaleString();

  const fmtAddr = (value: string) =>
    value.startsWith("0x") ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;

  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "40px 0 0",
        display: "flex",
        flexDirection: "column",
        gap: 28,
      }}
    >
      <Link
        href="/jobs"
        className="eyebrow"
        style={{ width: "fit-content" }}
      >
        ← All Jobs
      </Link>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 24,
          borderBottom: "1px solid var(--ink)",
          paddingBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 12,
            }}
          >
            <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>
              No. {chain.id}
            </span>
            <StatusBadge status={chain.status} />
            {metadata?.category && <span className="tag">{metadata.category}</span>}
          </div>
          <h1 className="serif-h" style={{ fontSize: 34, margin: 0 }}>
            {metadata?.description ?? `Job #${chain.id}`}
          </h1>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p className="lst-b" style={{ fontSize: 34 }}>
            {chain.amount}
            <span className="u">USDC</span>
          </p>
          <p className="eyebrow" style={{ marginTop: 6 }}>
            Escrowed
          </p>
        </div>
      </div>

      {/* Parties */}
      <div className="ledger">
        <table>
          <tbody>
            {[
              { label: "Client", value: chain.client },
              { label: "Provider", value: chain.provider },
              { label: "Evaluator", value: chain.evaluator },
              { label: "Expires", value: expiryDate },
            ].map(({ label, value }) => (
              <tr key={label}>
                <td className="role" style={{ width: 140 }}>
                  {label}
                </td>
                <td className="addr">{fmtAddr(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Provider sets the budget (price) while the job is Open */}
      {isOpen && isProvider && budgetRaw === 0n && (
        <div
          className="paper-card"
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <h2 className="serif-h" style={{ fontSize: 22, margin: 0 }}>
            Set Your Budget
          </h2>
          <p
            className="eyebrow"
            style={{ textTransform: "none", letterSpacing: 0 }}
          >
            You are the assigned provider. Quote the USDC bounty for this job;
            the client funds it into escrow next.
          </p>
          <input
            className="field"
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount in USDC"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
          />
          <button
            className="btn btn-primary"
            style={{ alignSelf: "flex-start" }}
            disabled={!budgetInput || Number(budgetInput) <= 0 || isTxPending}
            onClick={() =>
              writeContract({
                address: ADDRESSES.ERC8183_JOB,
                abi: ERC8183_ABI,
                functionName: "setBudget",
                args: [
                  BigInt(chain.id),
                  parseUnits(budgetInput || "0", 6),
                  "0x",
                ],
              })
            }
          >
            {isTxPending ? "Setting…" : "Set Budget"}
          </button>
        </div>
      )}

      {/* Client funds the escrow while the job is Open */}
      {isOpen && isClient && (
        <div
          className="paper-card"
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <h2 className="serif-h" style={{ fontSize: 22, margin: 0 }}>
            Fund Escrow
          </h2>
          {budgetRaw > 0n ? (
            <>
              <p
                className="eyebrow"
                style={{ textTransform: "none", letterSpacing: 0 }}
              >
                Lock <b>{chain.amount} USDC</b> into ERC-8183 escrow. This
                approves USDC, then funds the job (two wallet transactions).
              </p>
              {escrowErr && (
                <div className="notice notice-bad">{escrowErr}</div>
              )}
              <button
                className="btn btn-primary"
                style={{ alignSelf: "flex-start" }}
                disabled={funding}
                onClick={handleFund}
              >
                {funding
                  ? "Funding…"
                  : `Approve & Fund ${chain.amount} USDC`}
              </button>
            </>
          ) : (
            <p
              className="eyebrow"
              style={{ textTransform: "none", letterSpacing: 0 }}
            >
              Waiting for the provider to set a budget before you can fund.
            </p>
          )}
        </div>
      )}

      {/* Provider: submit deliverable - visible when Funded (status 1) and connected as provider */}
      {chain.status === 1 && isProvider && (
        <div
          className="paper-card"
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <h2 className="serif-h" style={{ fontSize: 22, margin: 0 }}>
            Submit Deliverable
          </h2>
          <textarea
            value={deliverableInput}
            onChange={(e) => setDeliverableInput(e.target.value)}
            rows={4}
            placeholder="Paste your deliverable content or an IPFS URI (ipfs://bafkrei…)"
            className="field"
          />
          <button
            disabled={!deliverableInput || isTxPending}
            onClick={() =>
              writeContract({
                address: ADDRESSES.ERC8183_JOB,
                abi: ERC8183_ABI,
                functionName: "submit",
                args: [
                  BigInt(chain.id),
                  keccak256(toBytes(deliverableInput)),
                  "0x",
                ],
              })
            }
            className="btn btn-primary"
            style={{ alignSelf: "flex-start" }}
          >
            {isTxPending ? "Submitting…" : "Submit to Chain"}
          </button>
          <p className="eyebrow" style={{ textTransform: "none", letterSpacing: 0 }}>
            Deliverable is hashed to bytes32 and stored on Arc Testnet.
          </p>
        </div>
      )}

      {/* Submitted deliverable view */}
      {deliverable && (
        <div className="paper-card-soft">
          <h2 className="eyebrow accent" style={{ marginBottom: 12 }}>
            Submitted Deliverable
          </h2>
          {deliverable.content_preview && (
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.6,
                color: "var(--ink-2)",
                marginBottom: 12,
              }}
            >
              {deliverable.content_preview}
            </p>
          )}
          {deliverable.ipfs_cid && (
            <a
              href={`https://ipfs.io/ipfs/${deliverable.ipfs_cid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mono link-underline"
              style={{ fontSize: 12 }}
            >
              ipfs://{deliverable.ipfs_cid}
            </a>
          )}
          <p
            className="eyebrow"
            style={{ marginTop: 10, textTransform: "none", letterSpacing: 0 }}
          >
            Submitted {new Date(deliverable.submitted_at).toLocaleString()}
          </p>
        </div>
      )}

      {/* Evaluator panel - visible when Submitted (status 2) */}
      {chain.status === 2 && (
        <div
          className="paper-card"
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <h2 className="serif-h" style={{ fontSize: 22, margin: 0 }}>
              Evaluator Panel
            </h2>
            {isEvaluator && (
              <span className="status status-submitted">
                <span className="pill" />
                You are the evaluator
              </span>
            )}
          </div>

          {hasDeliverable && (
            <div
              className="mono"
              style={{
                background: "var(--paper-3)",
                padding: "12px 14px",
                fontSize: 12,
                color: "var(--ink-2)",
                wordBreak: "break-all",
              }}
            >
              <div className="eyebrow" style={{ marginBottom: 6 }}>
                On-chain deliverable hash
              </div>
              {chain.deliverable}
            </div>
          )}

          {/* Trigger Claude evaluation */}
          {!activeEvaluation && (
            <button
              onClick={handleEvaluate}
              disabled={evaluating || !hasDeliverable}
              className="btn btn-ghost"
              style={{ alignSelf: "flex-start" }}
            >
              {evaluating ? "Evaluating…" : "Evaluate with Claude"}
            </button>
          )}

          {/* Claude result */}
          {activeEvaluation && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{ display: "flex", alignItems: "center", gap: 14 }}
              >
                <span
                  className={`status ${
                    activeEvaluation.decision === "approve"
                      ? "status-completed"
                      : "status-rejected"
                  }`}
                >
                  <span className="pill" />
                  Claude:{" "}
                  {activeEvaluation.decision === "approve"
                    ? "Approve"
                    : "Reject"}
                </span>
                <span className="eyebrow">
                  {Math.round((activeEvaluation.confidence ?? 0) * 100)}%
                  confidence
                </span>
              </div>
              <p
                style={{
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: "var(--ink-2)",
                }}
              >
                {activeEvaluation.reasoning}
              </p>
            </div>
          )}

          {/* Approve / Reject - evaluator only, after Claude evaluates */}
          {isEvaluator && activeEvaluation && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                paddingTop: 16,
                borderTop: "1px solid var(--rule)",
              }}
            >
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional)"
                className="field"
              />
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  disabled={isTxPending}
                  onClick={() =>
                    writeContract({
                      address: ADDRESSES.ERC8183_JOB,
                      abi: ERC8183_ABI,
                      functionName: "complete",
                      args: [
                        BigInt(chain.id),
                        keccak256(toBytes(reason || "Deliverable accepted")),
                        "0x",
                      ],
                    })
                  }
                  className="btn btn-primary"
                >
                  {isTxPending ? "Signing…" : "Approve & Release USDC"}
                </button>
                <button
                  disabled={isTxPending}
                  onClick={() =>
                    writeContract({
                      address: ADDRESSES.ERC8183_JOB,
                      abi: ERC8183_ABI,
                      functionName: "reject",
                      args: [
                        BigInt(chain.id),
                        keccak256(toBytes(reason || "Deliverable rejected")),
                        "0x",
                      ],
                    })
                  }
                  className="btn btn-ghost"
                >
                  Reject & Refund
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Completed / Rejected state */}
      {(chain.status === 3 || chain.status === 4) && (
        <div
          className={`notice ${
            chain.status === 3 ? "notice-good" : "notice-bad"
          }`}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>
            {chain.status === 3
              ? "Job completed. USDC released to provider"
              : "Job rejected. USDC refunded to client"}
          </p>
          {job.evaluation && (
            <p
              style={{
                marginTop: 8,
                fontSize: 13,
                lineHeight: 1.6,
                color: "var(--ink-3)",
              }}
            >
              {job.evaluation.reasoning}
            </p>
          )}
        </div>
      )}

      <a
        href={`https://testnet.arcscan.app/address/${ADDRESSES.ERC8183_JOB}`}
        target="_blank"
        rel="noopener noreferrer"
        className="eyebrow"
        style={{ textAlign: "center", padding: "8px 0 40px" }}
      >
        View ERC-8183 contract on ArcScan ↗
      </a>
    </div>
  );
}
