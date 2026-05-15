import { NextResponse } from "next/server";
import { publicClient, ADDRESSES, ERC8183_EVENTS_ABI } from "@/lib/viem";
import { getServiceClient } from "@/lib/supabase";

// Fetches the latest ~50k blocks of ERC-8183 events and upserts into
// event_cache. Exposed as POST (manual / dashboard) and GET (Vercel Cron).
async function runSync() {
  const db = getServiceClient();

  const latestBlock = await publicClient.getBlockNumber();
  const CHUNK = 9_999n;
  const CHUNKS_TO_SYNC = 5; // ~50k blocks ≈ ~1 week of activity

  const allRows: Array<{
    block_number: number;
    tx_hash: string;
    event_name: string;
    job_id: number | null;
    amount_raw: string | null;
    from_address: string | null;
    to_address: string | null;
    logged_at: string;
  }> = [];

  const eventNames = ERC8183_EVENTS_ABI.map((e) => e.name);

  for (let i = 0; i < CHUNKS_TO_SYNC; i++) {
    const toBlock = latestBlock - BigInt(i) * CHUNK;
    // +1 so adjacent chunks don't both include the boundary block
    const fromBlock = toBlock > CHUNK ? toBlock - CHUNK + 1n : 0n;
    if (fromBlock >= toBlock) break;

    // Fetch each event type individually (viem filters by topic[0])
    const fetchPromises = ERC8183_EVENTS_ABI.map((eventDef) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (publicClient.getLogs as any)({
        address: ADDRESSES.ERC8183_JOB,
        event: eventDef,
        fromBlock,
        toBlock,
      }).then((logs: any[]) => logs.map((log: any) => ({ log, eventName: eventDef.name })))
       .catch(() => [] as Array<{ log: any; eventName: string }>)
    );

    const results = await Promise.all(fetchPromises);

    const now = new Date().toISOString();
    for (const eventResults of results) {
      for (const { log, eventName } of eventResults) {
        // Extract jobId from first indexed topic (all our events have jobId as first indexed)
        const jobId = log.topics[1] ? parseInt(log.topics[1], 16) : null;

        // amount_raw from data (for JobFunded) or null
        let amountRaw: string | null = null;
        if (eventName === "JobFunded" && log.data && log.data !== "0x") {
          try { amountRaw = BigInt(log.data).toString(); } catch { /* skip */ }
        }

        allRows.push({
          block_number: Number(log.blockNumber ?? 0),
          tx_hash: log.transactionHash ?? "",
          event_name: eventName,
          job_id: jobId,
          amount_raw: amountRaw,
          from_address: log.topics[2] ? `0x${log.topics[2].slice(-40)}` : null,
          to_address: log.topics[3] ? `0x${log.topics[3].slice(-40)}` : null,
          logged_at: now,
        });
      }
    }
  }

  if (allRows.length === 0) {
    return NextResponse.json({ synced: 0, latest_block: latestBlock.toString() });
  }

  // Dedupe by the unique key (tx_hash, event_name): a single Postgres
  // ON CONFLICT upsert cannot touch the same conflict target twice, and
  // chunk boundaries / multi-log txs can otherwise repeat a key.
  const uniq = new Map<string, (typeof allRows)[number]>();
  for (const r of allRows) uniq.set(`${r.tx_hash}|${r.event_name}`, r);
  const rows = Array.from(uniq.values());

  const { error } = await db
    .from("event_cache")
    .upsert(rows, { onConflict: "tx_hash,event_name" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    synced: rows.length,
    latest_block: latestBlock.toString(),
  });
}

export async function POST() {
  return runSync();
}

// Vercel Cron hits this endpoint with GET on the schedule in vercel.json
export async function GET() {
  return runSync();
}
