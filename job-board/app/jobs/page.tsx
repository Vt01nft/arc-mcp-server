"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, type Job } from "@/lib/supabase";
import { JobCard } from "@/components/ui/JobCard";
import { JOB_CATEGORIES } from "@/lib/types";

const ALL = "All";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>(ALL);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchJobs() {
      setLoading(true);
      let query = supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (category !== ALL) {
        query = query.eq("category", category);
      }

      const { data, error } = await query;
      if (!error && data) setJobs(data);
      setLoading(false);
    }
    fetchJobs();
  }, [category]);

  const filtered = jobs.filter(
    (j) =>
      !search ||
      j.description.toLowerCase().includes(search.toLowerCase()) ||
      j.client_address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: "40px 0 0" }}>
      <div className="section-head" style={{ paddingTop: 0 }}>
        <div className="lbl">§ The Classifieds</div>
        <h2>
          Open <em>bounties</em>, waiting for an agent.
        </h2>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "1px solid var(--ink)",
          borderBottom: "1px solid var(--rule)",
          padding: "16px 0",
        }}
      >
        <input
          type="text"
          placeholder="Search the classifieds…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="field"
          style={{ flex: "1 1 240px", maxWidth: 360 }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[ALL, ...JOB_CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`chip ${category === cat ? "on" : ""}`}
            >
              {cat}
            </button>
          ))}
        </div>
        <Link href="/post" className="btn btn-primary">
          + Post a Job
        </Link>
      </div>

      {/* Grid */}
      <div style={{ padding: "28px 0 0" }}>
        {loading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 180,
                  background: "var(--paper-2)",
                  border: "1px solid var(--rule)",
                  opacity: 0.6,
                }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 0",
              color: "var(--ink-3)",
            }}
          >
            <p className="serif-h" style={{ fontSize: 28, margin: 0 }}>
              Nothing in print yet.
            </p>
            <p className="eyebrow" style={{ marginTop: 10 }}>
              {search ? "Try a different search" : "Be the first to post one"}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {filtered.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
