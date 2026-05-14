"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JOB_CATEGORIES, type JobCategory } from "@/lib/types";

export default function PostJobPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    description: "",
    category: "General" as JobCategory,
    providerAddress: "",
    expiryHours: 72,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description || !form.providerAddress) {
      setError("Description and provider address are required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/jobs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create job");
      router.push(`/jobs/${data.chainJobId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create job.");
    }
    setSubmitting(false);
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-6 py-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Post a Job</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Funds are locked in ERC-8183 escrow until Claude approves the
          deliverable.
        </p>
      </div>

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

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-zinc-400 space-y-1">
          <p>
            <span className="text-zinc-300">Evaluator:</span> Claude Sonnet
            (server-side, automatic)
          </p>
          <p>
            <span className="text-zinc-300">Escrow:</span> ERC-8183 on Arc
            Testnet
          </p>
          <p>
            <span className="text-zinc-300">Gas token:</span> USDC (18 decimals
            native)
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-semibold rounded-lg transition-colors"
        >
          {submitting ? "Creating Job…" : "Create Job on Arc"}
        </button>
      </form>
    </div>
  );
}
