"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 0 0" }}>
        <div
          style={{
            height: 140,
            background: "var(--paper-2)",
            border: "1px solid var(--rule)",
            marginBottom: 16,
          }}
        />
        <div
          style={{
            height: 240,
            background: "var(--paper-2)",
            border: "1px solid var(--rule)",
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "40px 0 0",
        display: "flex",
        flexDirection: "column",
        gap: 28,
      }}
    >
      <Link href="/jobs" className="eyebrow" style={{ width: "fit-content" }}>
        ← Browse Jobs
      </Link>

      {/* Agent card */}
      <div className="paper-card">
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 24,
            paddingBottom: 20,
            borderBottom: "1px solid var(--rule)",
          }}
        >
          <div>
            <p className="eyebrow" style={{ marginBottom: 8 }}>
              Agent ID
            </p>
            <h1 className="serif-h" style={{ fontSize: 40, margin: 0 }}>
              No. {agentId}
            </h1>
          </div>
          <div style={{ textAlign: "right" }}>
            <p className="eyebrow" style={{ marginBottom: 8 }}>
              Reputation Score
            </p>
            <p
              className="lst-b"
              style={{
                fontSize: 44,
                color: score >= 0 ? "var(--good)" : "var(--bad)",
              }}
            >
              {score >= 0 ? "+" : ""}
              {score.toFixed(1)}
            </p>
          </div>
        </div>

        {reputation && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 24,
              paddingTop: 20,
            }}
          >
            <div>
              <p className="eyebrow" style={{ marginBottom: 6 }}>
                Total Score
              </p>
              <p className="serif-h" style={{ fontSize: 20, margin: 0 }}>
                {reputation.totalScore.toString()}
              </p>
            </div>
            <div>
              <p className="eyebrow" style={{ marginBottom: 6 }}>
                Feedback Events
              </p>
              <p className="serif-h" style={{ fontSize: 20, margin: 0 }}>
                {reputation.eventCount.toString()}
              </p>
            </div>
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <a
            href={`https://testnet.arcscan.app/address/${ADDRESSES.ERC8004_REPUTATION}`}
            target="_blank"
            rel="noopener noreferrer"
            className="eyebrow"
          >
            View on ArcScan ↗
          </a>
        </div>
      </div>

      {/* Job history */}
      <div>
        <h2 className="eyebrow accent" style={{ marginBottom: 16 }}>
          § Recent Jobs
        </h2>
        {jobs.length === 0 ? (
          <p className="eyebrow" style={{ textTransform: "none", letterSpacing: 0 }}>
            No job history found.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {jobs.slice(0, 5).map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
