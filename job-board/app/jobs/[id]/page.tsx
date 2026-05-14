"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAccount, useWriteContract } from "wagmi";
import { keccak256, toBytes } from "viem";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ADDRESSES } from "@/contracts/addresses";
import { ERC8183_ABI } from "@/contracts/abis";
import type { EvaluateResponse } from "@/lib/types";

type JobData = {
  chain: {
    id: number;
    client: string;
    provider: string;
    evaluator: string;
    expiry: number;
    amount: string;
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
  const { writeContract, isPending: isTxPending } = useWriteContract();

  const [job, setJob] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<EvaluateResponse | null>(null);
  const [deliverableInput, setDeliverableInput] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/jobs/${id}`)
      .then((r) => r.json())
      .then((data) => setJob(data.error ? null : data))
      .catch(() => setJob(null))
      .finally(() => setLoading(false));
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
      // silent — user can retry
    }
    setEvaluating(false);
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="h-6 w-40 bg-zinc-800 rounded animate-pulse" />
        <div className="h-64 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-16 text-zinc-500">
        <p className="text-lg mb-4">Job not found</p>
        <Link href="/jobs" className="text-sm text-emerald-400 hover:underline">
          Back to jobs
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
  const hasDeliverable =
    chain.deliverable && chain.deliverable !== ZERO_BYTES32;
  const activeEvaluation = evalResult ?? job.evaluation;
  const expiryDate = new Date(chain.expiry * 1000).toLocaleString();

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <Link href="/jobs" className="text-sm text-zinc-400 hover:text-white transition-colors w-fit">
        ← All Jobs
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-mono text-zinc-500">#{chain.id}</span>
            <StatusBadge status={chain.status} />
            {metadata?.category && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700">
                {metadata.category}
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-white leading-snug">
            {metadata?.description ?? `Job #${chain.id}`}
          </h1>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-emerald-400">{chain.amount}</p>
          <p className="text-xs text-zinc-500 mt-1">USDC escrowed</p>
        </div>
      </div>

      {/* Parties */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 grid grid-cols-2 gap-4">
        {[
          { label: "Client", value: chain.client },
          { label: "Provider", value: chain.provider },
          { label: "Evaluator", value: chain.evaluator },
          { label: "Expires", value: expiryDate },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs text-zinc-500 mb-1">{label}</p>
            <p className="text-sm font-mono text-zinc-200">
              {value.startsWith("0x")
                ? `${value.slice(0, 6)}…${value.slice(-4)}`
                : value}
            </p>
          </div>
        ))}
      </div>

      {/* Provider: submit deliverable — visible when Funded (status 1) and connected as provider */}
      {chain.status === 1 && isProvider && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-zinc-100">Submit Deliverable</h2>
          <textarea
            value={deliverableInput}
            onChange={(e) => setDeliverableInput(e.target.value)}
            rows={4}
            placeholder="Paste your deliverable content or an IPFS URI (ipfs://bafkrei…)"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none"
          />
          <button
            disabled={!deliverableInput || isTxPending}
            onClick={() =>
              writeContract({
                address: ADDRESSES.ERC8183_JOB,
                abi: ERC8183_ABI,
                functionName: "submitDeliverable",
                args: [BigInt(chain.id), keccak256(toBytes(deliverableInput))],
              })
            }
            className="self-start px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black text-sm font-semibold rounded-lg transition-colors"
          >
            {isTxPending ? "Submitting…" : "Submit to Chain"}
          </button>
          <p className="text-xs text-zinc-600">
            Deliverable is hashed to bytes32 and stored on Arc Testnet.
          </p>
        </div>
      )}

      {/* Submitted deliverable view */}
      {deliverable && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">Submitted Deliverable</h2>
          {deliverable.content_preview && (
            <p className="text-sm text-zinc-300 leading-relaxed mb-3">
              {deliverable.content_preview}
            </p>
          )}
          {deliverable.ipfs_cid && (
            <a
              href={`https://ipfs.io/ipfs/${deliverable.ipfs_cid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-400 hover:underline font-mono"
            >
              ipfs://{deliverable.ipfs_cid}
            </a>
          )}
          <p className="text-xs text-zinc-600 mt-2">
            Submitted {new Date(deliverable.submitted_at).toLocaleString()}
          </p>
        </div>
      )}

      {/* Evaluator panel — visible when Submitted (status 2) */}
      {chain.status === 2 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">Evaluator Panel</h2>
            {isEvaluator && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                You are the evaluator
              </span>
            )}
          </div>

          {hasDeliverable && (
            <div className="bg-zinc-800 rounded-lg px-3 py-2">
              <p className="text-xs text-zinc-500 mb-1">On-chain deliverable hash</p>
              <p className="text-xs font-mono text-zinc-300 break-all">{chain.deliverable}</p>
            </div>
          )}

          {/* Trigger Claude evaluation */}
          {!activeEvaluation && (
            <button
              onClick={handleEvaluate}
              disabled={evaluating || !hasDeliverable}
              className="self-start px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {evaluating ? "Evaluating…" : "Evaluate with Claude"}
            </button>
          )}

          {/* Claude result */}
          {activeEvaluation && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    activeEvaluation.decision === "approve"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-red-500/20 text-red-400 border border-red-500/30"
                  }`}
                >
                  Claude: {activeEvaluation.decision === "approve" ? "Approve" : "Reject"}
                </span>
                <span className="text-xs text-zinc-500">
                  {Math.round((activeEvaluation.confidence ?? 0) * 100)}% confidence
                </span>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">
                {activeEvaluation.reasoning}
              </p>
            </div>
          )}

          {/* Approve / Reject — evaluator only, after Claude evaluates */}
          {isEvaluator && activeEvaluation && (
            <div className="flex flex-col gap-3 pt-3 border-t border-zinc-800">
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional)"
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              />
              <div className="flex gap-3">
                <button
                  disabled={isTxPending}
                  onClick={() =>
                    writeContract({
                      address: ADDRESSES.ERC8183_JOB,
                      abi: ERC8183_ABI,
                      functionName: "completeJob",
                      args: [
                        BigInt(chain.id),
                        keccak256(toBytes(reason || "Deliverable accepted")),
                      ],
                    })
                  }
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black text-sm font-semibold rounded-lg transition-colors"
                >
                  {isTxPending ? "Signing…" : "Approve & Release USDC"}
                </button>
                <button
                  disabled={isTxPending}
                  onClick={() =>
                    writeContract({
                      address: ADDRESSES.ERC8183_JOB,
                      abi: ERC8183_ABI,
                      functionName: "rejectJob",
                      args: [
                        BigInt(chain.id),
                        keccak256(toBytes(reason || "Deliverable rejected")),
                      ],
                    })
                  }
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 disabled:opacity-40 border border-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors"
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
          className={`rounded-xl p-5 border ${
            chain.status === 3
              ? "bg-emerald-500/10 border-emerald-500/20"
              : "bg-red-500/10 border-red-500/20"
          }`}
        >
          <p className={`text-sm font-semibold ${chain.status === 3 ? "text-emerald-400" : "text-red-400"}`}>
            {chain.status === 3
              ? "Job completed — USDC released to provider"
              : "Job rejected — USDC refunded to client"}
          </p>
          {job.evaluation && (
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              {job.evaluation.reasoning}
            </p>
          )}
        </div>
      )}

      <a
        href={`https://testnet.arcscan.app/address/${ADDRESSES.ERC8183_JOB}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors text-center"
      >
        View ERC-8183 contract on ArcScan →
      </a>
    </div>
  );
}
