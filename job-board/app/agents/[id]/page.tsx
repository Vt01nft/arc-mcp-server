"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { publicClient } from "@/lib/viem";
import { ADDRESSES } from "@/contracts/addresses";
import { ERC8004_REPUTATION_ABI } from "@/contracts/abis";
import { supabase, type Job } from "@/lib/supabase";
import { JobCard } from "@/components/ui/JobCard";

type ReputationData = {
  totalScore: bigint;
  eventCount: bigint;
};

export default function AgentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const agentId = parseInt(id, 10);

  const [reputation, setReputation] = useState<ReputationData | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isNaN(agentId)) return;
    async function fetchAgent() {
      setLoading(true);
      try {
        const [rep, jobsRes] = await Promise.all([
          publicClient.readContract({
            address: ADDRESSES.ERC8004_REPUTATION,
            abi: ERC8004_REPUTATION_ABI,
            functionName: "getReputation",
            args: [BigInt(agentId)],
          }) as Promise<[bigint, bigint]>,
          supabase
            .from("jobs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(20),
        ]);
        setReputation({ totalScore: rep[0], eventCount: rep[1] });
        if (jobsRes.data) setJobs(jobsRes.data);
      } catch {
        // show error state below
      }
      setLoading(false);
    }
    fetchAgent();
  }, [agentId]);

  const score =
    reputation && reputation.eventCount > 0n
      ? Number(reputation.totalScore) / Number(reputation.eventCount)
      : 0;

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <div className="h-32 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
        <div className="h-64 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <a href="/jobs" className="text-sm text-zinc-400 hover:text-white transition-colors">
        ← Browse Jobs
      </a>

      {/* Agent card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-zinc-500 mb-1">Agent ID</p>
            <h1 className="text-2xl font-bold text-white font-mono">#{agentId}</h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500 mb-1">Reputation Score</p>
            <p
              className={`text-3xl font-bold ${
                score >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {score >= 0 ? "+" : ""}
              {score.toFixed(1)}
            </p>
          </div>
        </div>

        {reputation && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
            <div>
              <p className="text-xs text-zinc-500">Total Score</p>
              <p className="text-sm font-semibold text-zinc-200">
                {reputation.totalScore.toString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Feedback Events</p>
              <p className="text-sm font-semibold text-zinc-200">
                {reputation.eventCount.toString()}
              </p>
            </div>
          </div>
        )}

        <div className="mt-4">
          <a
            href={`https://testnet.arcscan.app/address/${ADDRESSES.ERC8004_REPUTATION}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            View on ArcScan →
          </a>
        </div>
      </div>

      {/* Job history placeholder */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Recent Jobs
        </h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-zinc-500">No job history found.</p>
        ) : (
          <div className="grid gap-4">
            {jobs.slice(0, 5).map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
