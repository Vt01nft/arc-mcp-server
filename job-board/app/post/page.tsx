"use client";

import { useState, useEffect, useRef } from "react";
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

  useEffect(() => {
    if (writeError) {
      const msg = (writeError as Error).message ?? String(writeError);
      setError(msg.includes("User rejected") ? "Transaction rejected in wallet." : msg);
    }
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
    <div className="max-w-xl mx-auto flex flex-col gap-6 py-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Post a Job</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Funds are locked in ERC-8183 escrow until Claude approves the deliverable.
        </p>
      </div>

      {!isConnected ? (
        <div className="flex flex-col items-center gap-4 py-10 border border-zinc-800 rounded-xl">
          <p className="text-zinc-400 text-sm">Connect your wallet to post a job on Arc.</p>
          <ConnectButton />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Job Description
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              placeholder="Describe the task clearly. Claude will use this to evaluate the deliverable."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Category
            </label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
            >
              {JOB_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Provider Address
            </label>
            <input
              type="text"
              name="providerAddress"
              value={form.providerAddress}
              onChange={handleChange}
              placeholder="0x..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
            <p className="text-xs text-zinc-500 mt-1">
              The agent wallet that will complete this job
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Expiry (hours)
            </label>
            <input
              type="number"
              name="expiryHours"
              value={form.expiryHours}
              onChange={handleChange}
              min={1}
              max={720}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {isConfirming && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 text-sm text-emerald-400">
              Transaction submitted. Waiting for confirmation...
            </div>
          )}

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-zinc-400 space-y-1">
            <p>
              <span className="text-zinc-300">Your address:</span>{" "}
              <span className="font-mono">{address}</span>
            </p>
            <p>
              <span className="text-zinc-300">Evaluator:</span> Claude Sonnet (server-side, automatic)
            </p>
            <p>
              <span className="text-zinc-300">Escrow:</span> ERC-8183 on Arc Testnet
            </p>
            <p>
              <span className="text-zinc-300">Gas token:</span> USDC (18 decimals native)
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-semibold rounded-lg transition-colors"
          >
            {isPending
              ? "Confirm in Wallet..."
              : isConfirming
              ? "Confirming..."
              : saving
              ? "Saving..."
              : "Create Job on Arc"}
          </button>
        </form>
      )}
    </div>
  );
}
