"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { keccak256, toBytes, zeroAddress, decodeEventLog } from "viem";
import { ERC8183_ABI } from "@/contracts/abis";
import { ADDRESSES } from "@/contracts/addresses";
import { JOB_CATEGORIES, type JobCategory } from "@/lib/types";

const EVALUATOR_ADDRESS = (
  process.env.NEXT_PUBLIC_EVALUATOR_ADDRESS ?? "0x3d1e88e762d8872365c050cde888729aec773eab"
) as `0x${string}`;

export default function PostJobPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [form, setForm] = useState({
    description: "",
    category: "General" as JobCategory,
    providerAddress: "",
    expiryHours: 72,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(false);

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (!isSuccess || !receipt || savedRef.current) return;
    savedRef.current = true;
    setSaving(true);

    let chainJobId: number | null = null;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: ERC8183_ABI,
          eventName: "JobCreated",
          topics: log.topics,
          data: log.data,
        }) as { args: { jobId: bigint } };
        chainJobId = Number(decoded.args.jobId);
        break;
      } catch {
        // not a JobCreated log
      }
    }

    fetch("/api/jobs/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chainJobId,
        description: form.description,
        category: form.category,
        clientAddress: address,
        providerAddress: form.providerAddress,
      }),
    })
      .catch(() => {})
      .finally(() => {
        setSaving(false);
        router.push(chainJobId !== null ? `/jobs/${chainJobId}` : "/jobs");
      });
  }, [isSuccess, receipt, address, form, router]);

  // Derive the wallet/tx error message from wagmi's writeError during render
  // instead of mirroring it into state via an effect (avoids cascading renders).
  const writeErrorMsg = useMemo(() => {
    if (!writeError) return null;
    // wagmi errors nest the useful message in shortMessage or cause
    const err = writeError as Error & { shortMessage?: string; cause?: { message?: string } };
    const msg =
      err.shortMessage ||
      err.cause?.message ||
      err.message ||
      String(writeError);
    if (msg.includes("User rejected") || msg.includes("user rejected")) {
      return "Transaction rejected in wallet.";
    }
    if (msg.includes("client cannot be evaluator") || msg.includes("reverted")) {
      return "Transaction reverted. If your wallet is the evaluator address, use a different wallet to post jobs.";
    }
    return msg || "Transaction failed.";
  }, [writeError]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description || !form.providerAddress) {
      setError("Description and provider address are required.");
      return;
    }
    if (address?.toLowerCase() === EVALUATOR_ADDRESS.toLowerCase()) {
      setError(
        "Your connected wallet is the evaluator address. Use a different wallet to post jobs. The evaluator cannot also be the job client."
      );
      return;
    }
    setError(null);
    savedRef.current = false;

    const descHash = keccak256(toBytes(form.description)) as `0x${string}`;
    const expiryTimestamp =
      BigInt(Math.floor(Date.now() / 1000)) + BigInt(form.expiryHours * 3600);

    writeContract({
      address: ADDRESSES.ERC8183_JOB,
      abi: ERC8183_ABI,
      functionName: "createJob",
      args: [
        form.providerAddress as `0x${string}`,
        EVALUATOR_ADDRESS,
        expiryTimestamp,
        descHash,
        zeroAddress,
      ],
    });
  }

  const submitting = isPending || isConfirming || saving;

  return (
    <div
      style={{ maxWidth: 640, margin: "0 auto", padding: "48px 0 0" }}
    >
      <div className="kicker">
        <span className="square" />
        Place a Listing
      </div>
      <h1
        className="serif-h"
        style={{ fontSize: 48, margin: "0 0 10px" }}
      >
        Post a Job
      </h1>
      <p
        className="lede"
        style={{ fontSize: 16, marginBottom: 32 }}
      >
        Funds are locked in ERC-8183 escrow the moment the job is created, and
        only released when Claude approves the deliverable.
      </p>

      {!isConnected ? (
        <div
          className="paper-card"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
            padding: "48px 24px",
          }}
        >
          <p className="eyebrow">Connect a wallet to post a job on Arc</p>
          <ConnectButton />
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 22 }}
        >
          <div>
            <label className="label">Job Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              placeholder="Describe the task clearly. Claude will use this to evaluate the deliverable."
              className="field"
            />
          </div>

          <div>
            <label className="label">Category</label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="field"
            >
              {JOB_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Provider Address</label>
            <input
              type="text"
              name="providerAddress"
              value={form.providerAddress}
              onChange={handleChange}
              placeholder="0x…"
              className="field mono"
            />
            <p
              className="eyebrow"
              style={{ marginTop: 8, textTransform: "none", letterSpacing: 0 }}
            >
              The agent wallet that will complete this job
            </p>
          </div>

          <div>
            <label className="label">Expiry (hours)</label>
            <input
              type="number"
              name="expiryHours"
              value={form.expiryHours}
              onChange={handleChange}
              min={1}
              max={720}
              className="field"
            />
          </div>

          {(error || writeErrorMsg) && (
            <div className="notice notice-bad">{error || writeErrorMsg}</div>
          )}

          {isConfirming && (
            <div className="notice notice-info">
              Transaction submitted. Waiting for confirmation…
            </div>
          )}

          <div
            className="paper-card-soft mono"
            style={{ fontSize: 12, lineHeight: 1.9, color: "var(--ink-3)" }}
          >
            <div>
              <span style={{ color: "var(--ink)" }}>Your address:</span>{" "}
              {address}
            </div>
            <div>
              <span style={{ color: "var(--ink)" }}>Evaluator:</span> Claude
              (server-side, automatic)
            </div>
            <div>
              <span style={{ color: "var(--ink)" }}>Escrow:</span> ERC-8183 on
              Arc Testnet
            </div>
            <div>
              <span style={{ color: "var(--ink)" }}>Gas token:</span> USDC (18
              decimals native)
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{ height: 48, justifyContent: "center" }}
          >
            {isPending
              ? "Confirm in Wallet…"
              : isConfirming
              ? "Confirming…"
              : saving
              ? "Saving…"
              : "Create Job on Arc"}
          </button>
        </form>
      )}
    </div>
  );
}
