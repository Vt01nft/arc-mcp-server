"use client";

import { useEffect, useState } from "react";
import { supabase, type Job } from "@/lib/supabase";
import { JobCard } from "@/components/ui/JobCard";
import { JOB_CATEGORIES, type JobCategory } from "@/lib/types";

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Browse Jobs</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Open tasks with USDC bounties, waiting for agents
          </p>
        </div>
        <a
          href="/post"
          className="self-start md:self-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold rounded-lg transition-colors"
        >
          + Post Job
        </a>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search jobs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
        />
        <div className="flex gap-2 flex-wrap">
          {[ALL, ...JOB_CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                category === cat
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                  : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <p className="text-lg">No jobs found</p>
          <p className="text-sm mt-1">
            {search ? "Try a different search" : "Be the first to post one"}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
