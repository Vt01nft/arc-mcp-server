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

  const { data: allEvents, error } = await supabase
    .from("event_cache")
    .select("event_name, job_id, amount_raw, block_number, logged_at");
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const events = allEvents ?? [];

  // Accurate breakdown by event type (block_number is real; logged_at is
  // only the sync time, so a per-day series would be fabricated).
  const byType: Record<string, number> = {};
  for (const ev of events)
    byType[ev.event_name] = (byType[ev.event_name] ?? 0) + 1;

  // Honest activity series: bucket events across the synced block span by
  // block number (monotonic with time) instead of the sync timestamp.
  const blocks = events
    .map((e) => e.block_number ?? 0)
    .filter((b) => b > 0);
  const minB = blocks.length ? Math.min(...blocks) : 0;
  const maxB = blocks.length ? Math.max(...blocks) : 0;
  const BUCKETS = 12;
  const span = Math.max(1, maxB - minB);
  const daily: DailyStat[] = Array.from({ length: BUCKETS }, (_, i) => ({
    date: String(minB + Math.round((span * i) / BUCKETS)),
    jobs_created: 0,
    jobs_completed: 0,
    jobs_rejected: 0,
    volume_usdc: 0,
  }));
  for (const ev of events) {
    const b = ev.block_number ?? 0;
    if (b <= 0) continue;
    const idx = Math.min(
      BUCKETS - 1,
      Math.floor(((b - minB) / span) * BUCKETS)
    );
    const slot = daily[idx];
    if (ev.event_name === "JobCreated") slot.jobs_created++;
    if (ev.event_name === "JobCompleted") slot.jobs_completed++;
    if (ev.event_name === "JobRejected") slot.jobs_rejected++;
    if (ev.event_name === "JobFunded" && ev.amount_raw) {
      slot.volume_usdc += Number(BigInt(ev.amount_raw)) / 1_000_000;
    }
  }

  const created = events.filter((e) => e.event_name === "JobCreated");
  const completed = events.filter((e) => e.event_name === "JobCompleted");
  const rejected = events.filter((e) => e.event_name === "JobRejected");
  const funded = events.filter((e) => e.event_name === "JobFunded");

  const totalVolume = funded.reduce(
    (s, e) => (e.amount_raw ? s + Number(BigInt(e.amount_raw)) / 1_000_000 : s),
    0
  );
  const cutoff = new Date(Date.now() - 86_400_000).toISOString();
  const events24h = events.filter((e) => e.logged_at >= cutoff).length;
  const latestBlock = events.reduce(
    (max, e) => Math.max(max, e.block_number ?? 0),
    0
  );
  const activeJobs = Math.max(
    0,
    created.length - completed.length - rejected.length
  );

  const stats: StatsSnapshot = {
    total_jobs: created.length,
    active_jobs: activeJobs,
    completed_jobs: completed.length,
    rejected_jobs: rejected.length,
    total_volume_usdc: totalVolume.toFixed(2),
    events_24h: events24h,
    latest_block: latestBlock,
    cached_events: events.length,
  };
  return NextResponse.json({ stats, daily, byType });
}
