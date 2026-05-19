"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAccount, useWriteContract } from "wagmi";
import { useCircle } from "@/components/CircleProvider";
import { keccak256, toBytes, parseUnits } from "viem";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ADDRESSES } from "@/contracts/addresses";
import { ERC8183_ABI, USDC_ABI } from "@/contracts/abis";
import { publicClient } from "@/lib/viem";
import { agentByWallet } from "@/lib/agents";
import type { EvaluateResponse } from "@/lib/types";

type JobData = {
  chain: {
    id: number;
    client: string;
    provider: string;
    evaluator: string;
    description: string;
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

function looksLikeHtml(c: string): boolean {
  const s = c.trim();
  return (
    /^<!doctype html/i.test(s) ||
    /<html[\s>][\s\S]*<\/html>/i.test(s) ||
    (/<body[\s>]/i.test(s) && /<\/body>/i.test(s))
  );
}

// Renders the agent's deliverable: live sandboxed preview for single-file
// HTML, readable source for everything else, plus a one-click download.
function DeliverableView({
  jobId,
  deliverable,
}: {
  jobId: number;
  deliverable: {
    ipfs_cid: string | null;
    content_preview: string | null;
    submitted_at: string;
  };
}) {
  const content = deliverable.content_preview ?? "";
  const isHtml = content.length > 0 && looksLikeHtml(content);
  const [showSource, setShowSource] = useState(!isHtml);
  const [copied, setCopied] = useState(false);
  const ext = isHtml ? "html" : "md";

  function download() {
    const blob = new Blob([content], {
      type: isHtml ? "text/html" : "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deliverable-job-${jobId}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; download still works */
    }
  }

  return (
    <div className="paper-card-soft">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h2 className="eyebrow accent" style={{ margin: 0 }}>
          Submitted Deliverable
        </h2>
        {content && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {isHtml && (
              <button
                className="btn btn-ghost"
                style={{ height: 34, padding: "0 12px", fontSize: 12 }}
                onClick={() => setShowSource((v) => !v)}
              >
                {showSource ? "Preview" : "Source"}
              </button>
            )}
            <button
              className="btn btn-ghost"
              style={{ height: 34, padding: "0 12px", fontSize: 12 }}
              onClick={copy}
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              className="btn btn-primary"
              style={{ height: 34, padding: "0 12px", fontSize: 12 }}
              onClick={download}
            >
              Download .{ext}
            </button>
          </div>
        )}
      </div>

      {content ? (
        isHtml && !showSource ? (
          <iframe
            title={`Deliverable preview for job ${jobId}`}
            srcDoc={content}
            sandbox="allow-scripts allow-forms allow-popups"
            style={{
              width: "100%",
              height: 480,
              border: "1px solid var(--rule)",
              background: "#fff",
              borderRadius: 0,
            }}
          />
        ) : (
          <pre
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--ink-2)",
              background: "var(--paper-2, rgba(0,0,0,0.03))",
              padding: 14,
              maxHeight: 480,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
              fontFamily: "var(--mono)",
            }}
          >
            {content}
          </pre>
        )
      ) : (
        <p style={{ fontSize: 14, color: "var(--ink-2)" }}>
          The deliverable hash is on-chain. Readable content was not stored
          off-chain for this job.
        </p>
      )}

      {content.length >= 200000 && (
        <p
          className="eyebrow"
          style={{ marginTop: 10, textTransform: "none", letterSpacing: 0 }}
        >
          Preview is truncated to the stored excerpt. Large multi-file output
          is hosted in a later phase.
        </p>
      )}
      {deliverable.ipfs_cid && (
        <a
          href={`https://ipfs.io/ipfs/${deliverable.ipfs_cid}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mono link-underline"
          style={{ fontSize: 12, display: "inline-block", marginTop: 10 }}
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
  );
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { address } = useAccount();
  const { writeContract, writeContractAsync, isPending: isTxPending } =
    useWriteContract();
  const circle = useCircle();
  const circleReady = circle.status === "ready";

  // One write path for both wallets. Circle is primary (only login now);
  // wagmi remains a fallback if a wallet is ever connected.
  async function act(
    p: {
      address: `0x${string}`;
      abi: readonly unknown[];
      functionName: string;
      args: readonly unknown[];
    },
    onDone?: () => Promise<void>
  ) {
    if (circleReady) {
      await circle.execute(p);
      if (onDone) await onDone().catch(() => {});
      window.location.reload();
    } else {
      writeContract(p as Parameters<typeof writeContract>[0]);
      if (onDone) onDone().catch(() => {});
    }
  }

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

  const refetch = useCallback(async () => {
    if (!id) return;
    try {
      const r = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
      const data = await r.json();
      if (!data.error) setJob(data);
    } catch {
      /* keep current state on transient failure */
    }
  }, [id]);

  // While an autonomous agent job is mid-flight, poll until it settles so the
  // poster watches it complete without manually refreshing.
  useEffect(() => {
    if (!job) return;
    const st = job.chain.status;
    const isAgent = !!agentByWallet(job.chain.provider);
    if (!isAgent || st === 3 || st === 4 || st === 5) return;
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      if (n > 80) {
        clearInterval(t);
        return;
      }
      refetch();
    }, 6000);
    return () => clearInterval(t);
  }, [job, refetch]);

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
  // Effective account: Circle wallet (primary login) or a connected wallet.
  const acct = (circle.address ?? address ?? null) as string | null;
  const isProvider =
    acct && chain.provider !== ZERO_BYTES32
      ? acct.toLowerCase() === chain.provider.toLowerCase()
      : false;
  const isEvaluator =
    acct && chain.evaluator !== ZERO_BYTES32
      ? acct.toLowerCase() === chain.evaluator.toLowerCase()
      : false;
  const isClient =
    acct && chain.client !== ZERO_BYTES32
      ? acct.toLowerCase() === chain.client.toLowerCase()
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
      if (circleReady) {
        await circle.execute({
          address: ADDRESSES.USDC,
          abi: USDC_ABI,
          functionName: "approve",
          args: [ADDRESSES.ERC8183_JOB, budgetRaw],
        });
        await circle.execute({
          address: ADDRESSES.ERC8183_JOB,
          abi: ERC8183_ABI,
          functionName: "fund",
          args: [BigInt(chain.id), "0x"],
        });
        window.location.reload();
      } else {
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
      }
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
            {metadata?.description ?? chain.description ?? `Job #${chain.id}`}
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
              ...(agentByWallet(chain.provider)
                ? [
                    {
                      label: "Agent",
                      value: agentByWallet(chain.provider)!.name,
                      raw: true,
                    },
                  ]
                : []),
              { label: "Evaluator", value: chain.evaluator },
              { label: "Expires", value: expiryDate },
            ].map(({ label, value, raw }) => (
              <tr key={label}>
                <td className="role" style={{ width: 140 }}>
                  {label}
                </td>
                <td className="addr">{raw ? value : fmtAddr(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Live state — autonomous agent working / evaluating */}
      {agentByWallet(chain.provider) &&
        (chain.status === 0 || chain.status === 1 || chain.status === 2) && (
          <div
            className="paper-card-soft"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              borderLeft: "3px solid var(--accent)",
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 999,
                background: "var(--accent)",
                animation: "pulse 1.2s ease-in-out infinite",
                flexShrink: 0,
              }}
            />
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--ink-2)" }}>
              {chain.status === 2 ? (
                <>
                  <b>{agentByWallet(chain.provider)!.name}</b> submitted the work.
                  The evaluator is reviewing it now. This page updates
                  automatically.
                </>
              ) : (
                <>
                  <b>{agentByWallet(chain.provider)!.name}</b> is working on this
                  job now. It will submit, get reviewed, and pay out on its own.
                  This page updates automatically, no refresh needed.
                </>
              )}
            </p>
          </div>
        )}

      {/* How this works — status + role aware */}
      <div className="paper-card-soft" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="eyebrow accent">How this job works</div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--ink-2)" }}>
          Lifecycle: <b>Open</b> &rarr; provider sets budget &rarr; client funds
          escrow (<b>Funded</b>) &rarr; provider submits work (<b>Submitted</b>)
          &rarr; evaluator approves (<b>Completed</b>, USDC released to provider)
          or rejects (<b>Rejected</b>, USDC refunded). The provider is the wallet
          assigned when the job was created.
        </p>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
          {chain.status === 0 && budgetRaw === 0n &&
            (isProvider
              ? "Your move: you are the provider. Set your USDC budget below."
              : "Next: the assigned provider sets a budget (price).")}
          {chain.status === 0 && budgetRaw > 0n &&
            (isClient
              ? "Your move: you are the client. Approve & fund the escrow below."
              : "Next: the client funds the escrow.")}
          {chain.status === 1 &&
            (isProvider
              ? "Your move: you are the provider. Do the work and submit the deliverable below."
              : "Next: the provider submits the deliverable.")}
          {chain.status === 2 &&
            (isEvaluator
              ? "Your move: you are the evaluator. Review and approve or reject below."
              : "Next: Gemini evaluates and the evaluator approves or rejects.")}
          {chain.status === 3 && "Done. USDC was released to the provider."}
          {chain.status === 4 && "Closed. USDC was refunded to the client."}
          {chain.status === 5 && "Expired. The client can claim a refund."}
        </p>
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
              act({
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
              act(
                {
                  address: ADDRESSES.ERC8183_JOB,
                  abi: ERC8183_ABI,
                  functionName: "submit",
                  args: [
                    BigInt(chain.id),
                    keccak256(toBytes(deliverableInput)),
                    "0x",
                  ],
                },
                // Save the readable deliverable off-chain so the client and
                // evaluator can actually see the work on this page.
                async () => {
                  await fetch("/api/jobs/deliverable", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chainJobId: chain.id,
                      content: deliverableInput,
                      hash: keccak256(toBytes(deliverableInput)),
                    }),
                  });
                }
              )
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
        <DeliverableView jobId={chain.id} deliverable={deliverable} />
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

          {/* Trigger Gemini evaluation */}
          {!activeEvaluation && (
            <button
              onClick={handleEvaluate}
              disabled={evaluating || !hasDeliverable}
              className="btn btn-ghost"
              style={{ alignSelf: "flex-start" }}
            >
              {evaluating ? "Evaluating…" : "Evaluate with Gemini"}
            </button>
          )}

          {/* Gemini result */}
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
                  Gemini:{" "}
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

          {/* Approve / Reject - evaluator only, after Gemini evaluates */}
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
                    act({
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
                    act({
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
