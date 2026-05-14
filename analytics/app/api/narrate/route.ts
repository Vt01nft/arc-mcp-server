import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { StatsSnapshot, DailyStat, NarrationResponse } from "@/lib/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { stats, daily }: { stats: StatsSnapshot; daily: DailyStat[] } = await req.json();

  const last7 = daily.slice(-7);
  const trend7 = last7.reduce((s, d) => s + d.jobs_created, 0);
  const prev7 = daily.slice(-14, -7).reduce((s, d) => s + d.jobs_created, 0);

  const prompt = `You are an analyst narrating live activity on Arc Testnet — a stablecoin-native L1 blockchain by Circle where USDC is the native gas token.

Current stats:
- Total jobs ever created: ${stats.total_jobs}
- Active jobs right now: ${stats.active_jobs}
- Completed jobs: ${stats.completed_jobs}
- Rejected jobs: ${stats.rejected_jobs}
- Total volume escrowed: ${stats.total_volume_usdc} USDC
- Events in last 24h: ${stats.events_24h}
- Latest block: ${stats.latest_block}

Last 7-day job creation: ${trend7} jobs
Prior 7-day job creation: ${prev7} jobs
Week-over-week change: ${prev7 > 0 ? `${Math.round((trend7 - prev7) / prev7 * 100)}%` : "N/A (no prior data)"}

Write a CONCISE 2-sentence headline + summary for developers following Arc ecosystem activity.
Reply in this exact JSON format (no markdown, no explanation):
{
  "headline": "one punchy headline (max 10 words)",
  "summary": "2-sentence summary of current state and trend",
  "trend": "up" | "down" | "neutral"
}`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (msg.content[0] as { type: string; text: string }).text;
  const parsed = JSON.parse(raw) as { headline: string; summary: string; trend: "up" | "down" | "neutral" };

  const response: NarrationResponse = {
    ...parsed,
    generated_at: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
