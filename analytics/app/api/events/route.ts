import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { StatsSnapshot, DailyStat, CachedEvent } from "@/lib/types";

// GET /api/events?type=stats   → StatsSnapshot + DailyStat[]
// GET /api/events?type=feed&limit=N → CachedEvent[]
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "feed";
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10);

  if (type === "feed") {
    const { data, error } = await supabase
      .from("event_cache")
      .select("*")
      .order("block_number", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ events: data as CachedEvent[] });
  }

  // type=stats: aggregate from event_cache
  const { data: allEvents, error } = await supabase
    .from("event_cache")
    .select("event_name, job_id, amount_raw, block_number, logged_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const events = allEvents ?? [];

  // Build daily stats from logged_at
  const dailyMap = new Map<string, DailyStat>();
  for (const ev of events) {
    const date = ev.logged_at.slice(0, 10);
    const day = dailyMap.get(date) ?? {
      date,
      jobs_created: 0,
      jobs_completed: 0,
      jobs_rejected: 0,
      volume_usdc: 0,
    };
    if (ev.event_name === "JobCreated") day.jobs_created++;
    if (ev.event_name === "JobCompleted") day.jobs_completed++;
    if (ev.event_name === "JobRejected") day.jobs_rejected++;
    if (ev.event_name === "JobFunded" && ev.amount_raw) {
      // amount_raw is the ERC-20 USDC interface (6 decimals)
      day.volume_usdc += Number(BigInt(ev.amount_raw)) / 1_000_000;
    }
    dailyMap.set(date, day);
  }
  const daily: DailyStat[] = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // Summary stats
  const created = events.filter((e) => e.event_name === "JobCreated");
  const completed = events.filter((e) => e.event_name === "JobCompleted");
  const rejected = events.filter((e) => e.event_name === "JobRejected");
  const funded = events.filter((e) => e.event_name === "JobFunded");

  const totalVolume = funded.reduce((s, e) => {
    if (!e.amount_raw) return s;
    return s + Number(BigInt(e.amount_raw)) / 1_000_000;
  }, 0);

  // 24h events
  const cutoff = new Date(Date.now() - 86_400_000).toISOString();
  const events24h = events.filter((e) => e.logged_at >= cutoff).length;

  // Latest block (max block_number in cache)
  const latestBlock = events.reduce((max, e) => Math.max(max, e.block_number ?? 0), 0);

  // Active jobs = created - completed - rejected (rough)
  const activeJobs = Math.max(0, created.length - completed.length - rejected.length);

  const stats: StatsSnapshot = {
    total_jobs: created.length,
    active_jobs: activeJobs,
    completed_jobs: completed.length,
    rejected_jobs: rejected.length,
    total_volume_usdc: totalVolume.toFixed(2),
    events_24h: events24h,
    latest_block: latestBlock,
  };

  return NextResponse.json({ stats, daily });
}
