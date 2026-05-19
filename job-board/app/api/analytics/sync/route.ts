import { NextRequest, NextResponse } from "next/server";
import { publicClient } from "@/lib/viem";
import { rateLimit } from "@/lib/ratelimit";
import { getServiceClient } from "@/lib/supabase";
import { ADDRESSES } from "@/contracts/addresses";
import { ERC8183_EVENTS_ABI } from "@/lib/analytics-types";

export const maxDuration = 60;

// Pull the latest ~50k blocks of ERC-8183 events and upsert into
// event_cache. POST = manual / dashboard, GET = Vercel Cron.
async function runSync() {
  const db = getServiceClient();
  const latestBlock = await publicClient.getBlockNumber();
  const CHUNK = 9_999n;
  const CHUNKS_TO_SYNC = 5;

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

  for (let i = 0; i < CHUNKS_TO_SYNC; i++) {
    const toBlock = latestBlock - BigInt(i) * CHUNK;
    const fromBlock = toBlock > CHUNK ? toBlock - CHUNK + 1n : 0n;
    if (fromBlock >= toBlock) break;

    const fetchPromises = ERC8183_EVENTS_ABI.map((eventDef) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (publicClient.getLogs as any)({
        address: ADDRESSES.ERC8183_JOB,
        event: eventDef,
        fromBlock,
        toBlock,
      })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((logs: any[]) =>
          logs.map((log) => ({ log, eventName: eventDef.name }))
        )
        .catch(
          () => [] as Array<{ log: unknown; eventName: string }>
        )
    );
    const results = await Promise.all(fetchPromises);
    const now = new Date().toISOString();
    for (const eventResults of results) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const { log, eventName } of eventResults as any[]) {
        const jobId = log.topics[1] ? parseInt(log.topics[1], 16) : null;
        let amountRaw: string | null = null;
        if (eventName === "JobFunded" && log.data && log.data !== "0x") {
          try {
            amountRaw = BigInt(log.data).toString();
          } catch {
            /* skip */
          }
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
    return NextResponse.json({
      synced: 0,
      latest_block: latestBlock.toString(),
    });
  }

  const uniq = new Map<string, (typeof allRows)[number]>();
  for (const r of allRows) uniq.set(`${r.tx_hash}|${r.event_name}`, r);
  const rows = Array.from(uniq.values());

  const { error } = await db
    .from("event_cache")
    .upsert(rows, { onConflict: "tx_hash,event_name" });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    synced: rows.length,
    latest_block: latestBlock.toString(),
  });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "analytics-sync", 8, 60_000);
  if (limited) return limited;
  return runSync();
}
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, "analytics-sync", 8, 60_000);
  if (limited) return limited;
  return runSync();
}
