import { NextResponse } from "next/server";
import { parseAbiItem } from "viem";
import { publicClient } from "@/lib/viem";
import { ADDRESSES } from "@/contracts/addresses";
import { ERC8183_ABI } from "@/contracts/abis";

// The ERC-8183 contract is shared/global (jobCounter is chain-wide). "This
// app's" jobs are the ones whose evaluator is our evaluator address. evaluator
// is NOT an indexed event arg, so we fetch JobCreated logs over a bounded
// recent window and filter by it. The Arc RPC caps eth_getLogs at a 10k-block
// range, so we page backward in 10k chunks.

const EVALUATOR = (
  process.env.NEXT_PUBLIC_EVALUATOR_ADDRESS ??
  "0x3d1e88e762d8872365c050cde888729aec773eab"
).toLowerCase();

const CHUNK = 10_000n;
const MAX_CHUNKS = Number(process.env.ONCHAIN_SCAN_CHUNKS ?? 12); // ~120k blocks
const CACHE_TTL_MS = 60_000;

const JOB_CREATED = parseAbiItem(
  "event JobCreated(uint256 indexed jobId, address indexed client, address indexed provider, address evaluator, uint256 expiredAt, address hook)"
);

type OnchainJobRow = {
  id: string;
  chain_job_id: number;
  description: string;
  category: string;
  client_address: string;
  provider_address: string | null;
  created_at: string;
  updated_at: string;
  status: number;
  onchain: true;
};

let cache: { at: number; data: OnchainJobRow[] } | null = null;

export async function GET() {
  try {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
      return NextResponse.json({ jobs: cache.data, cached: true });
    }

    const latest = await publicClient.getBlockNumber();

    // Collect JobCreated logs across the recent window, newest chunk first.
    const matches: { jobId: bigint; client: string; provider: string }[] = [];
    for (let i = 0; i < MAX_CHUNKS; i++) {
      const toBlock = latest - CHUNK * BigInt(i);
      if (toBlock <= 0n) break;
      const fromBlock = toBlock - CHUNK + 1n > 0n ? toBlock - CHUNK + 1n : 0n;
      try {
        const logs = await publicClient.getLogs({
          address: ADDRESSES.ERC8183_JOB,
          event: JOB_CREATED,
          fromBlock,
          toBlock,
        });
        for (const log of logs) {
          const a = log.args as {
            jobId: bigint;
            client: string;
            provider: string;
            evaluator: string;
          };
          if (a.evaluator && a.evaluator.toLowerCase() === EVALUATOR) {
            matches.push({
              jobId: a.jobId,
              client: a.client,
              provider: a.provider,
            });
          }
        }
      } catch {
        // Skip a chunk the RPC rejects rather than failing the whole route.
      }
    }

    // Enrich with live status + description from getJob.
    const jobs: OnchainJobRow[] = (
      await Promise.all(
        matches.map(async (m): Promise<OnchainJobRow | null> => {
          try {
            const j = (await publicClient.readContract({
              address: ADDRESSES.ERC8183_JOB,
              abi: ERC8183_ABI,
              functionName: "getJob",
              args: [m.jobId],
            })) as {
              description: string;
              client: string;
              provider: string;
              status: number;
            };
            return {
              id: `onchain-${m.jobId}`,
              chain_job_id: Number(m.jobId),
              description: j.description || `Job #${m.jobId}`,
              category: "Onchain",
              client_address: j.client ?? m.client,
              provider_address: j.provider ?? m.provider ?? null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              status: Number(j.status),
              onchain: true as const,
            };
          } catch {
            return null;
          }
        })
      )
    ).filter((x): x is OnchainJobRow => x !== null);

    // Newest first, unique by chain_job_id.
    const seen = new Set<number>();
    const deduped = jobs
      .sort((a, b) => b.chain_job_id - a.chain_job_id)
      .filter((j) =>
        seen.has(j.chain_job_id) ? false : (seen.add(j.chain_job_id), true)
      );

    cache = { at: Date.now(), data: deduped };
    return NextResponse.json({ jobs: deduped, cached: false });
  } catch (err) {
    console.error("onchain jobs error:", err);
    return NextResponse.json({ jobs: [], error: "scan failed" });
  }
}
