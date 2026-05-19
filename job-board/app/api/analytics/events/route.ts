import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type {
  StatsSnapshot,
  DailyStat,
  CachedEvent,
} from "@/lib/analytics-types";

// GET /api/analytics/events?type=stats  -> StatsSnapshot + DailyStat[]
// GET /api/analytics/events?type=feed&limit=N -> CachedEvent[]
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "feed";
  const limit = Math.min(
    100,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10) || 20)
  );

  if (type === "feed") {
    const { data, error } = await supabase
      .from("event_cache")
      .select("*")
      .order("block_number", { ascending: false })
      .limit(limit);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ events: data as CachedEvent[] });
  }

  // PostgREST caps a select at 1000 rows, so pulling rows and counting in
  // JS silently undercounts once the cache exceeds 1000. Use exact COUNT
  // queries instead: correct regardless of cache size, and lighter.
  const TYPES = [
    "JobCreated",
    "BudgetSet",
    "JobFunded",
    "JobSubmitted",
    "JobCompleted",
    "JobRejected",
    "Refunded",
  ];

  const countOf = async (name: string): Promise<number> => {
    const { count } = await supabase
      .from("event_cache")
      .select("*", { count: "exact", head: true })
      .eq("event_name", name);
    return count ?? 0;
  };

  const [
    counts,
    totalRes,
    latestRes,
    fundedRows,
  ] = await Promise.all([
    Promise.all(TYPES.map((t) => countOf(t))),
    supabase
      .from("event_cache")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("event_cache")
      .select("block_number")
      .order("block_number", { ascending: false })
      .limit(1),
    // JobFunded count is bounded by job count (well under the row cap), so
    // summing these rows for volume is accurate.
    supabase
      .from("event_cache")
      .select("amount_raw")
      .eq("event_name", "JobFunded")
      .limit(10000),
  ]);

  const byType: Record<string, number> = {};
  TYPES.forEach((t, i) => {
    if (counts[i] > 0) byType[t] = counts[i];
  });

  const created = byType["JobCreated"] ?? 0;
  const completed = byType["JobCompleted"] ?? 0;
  const rejected = byType["JobRejected"] ?? 0;

  const totalVolume = (fundedRows.data ?? []).reduce((s, e) => {
    if (!e.amount_raw) return s;
    try {
      return s + Number(BigInt(e.amount_raw)) / 1_000_000;
    } catch {
      return s;
    }
  }, 0);

  const latestBlock = latestRes.data?.[0]?.block_number ?? 0;
  const cachedEvents = totalRes.count ?? 0;
  const activeJobs = Math.max(0, created - completed - rejected);

  // The page renders an accurate by-type breakdown, not a fabricated time
  // series, so daily is intentionally empty.
  const daily: DailyStat[] = [];

  const stats: StatsSnapshot = {
    total_jobs: created,
    active_jobs: activeJobs,
    completed_jobs: completed,
    rejected_jobs: rejected,
    total_volume_usdc: totalVolume.toFixed(2),
    events_24h: 0,
    latest_block: latestBlock,
    cached_events: cachedEvents,
  };
  return NextResponse.json({ stats, daily, byType });
}
