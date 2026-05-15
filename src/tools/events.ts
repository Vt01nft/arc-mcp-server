import { z } from "zod";
import { getPublicClient, formatUsdc } from "../arc-client.js";
import { ADDRESSES, USDC_DECIMALS } from "../contracts/addresses.js";
import { ERC8183_ABI, ERC8004_REPUTATION_ABI, USDC_ABI, JOB_STATUS } from "../contracts/abis.js";

// ── arc_get_events ─────────────────────────────────────────────────────────────
export const getEventsSchema = z.object({
  contract: z
    .enum(["jobs", "reputation", "usdc"])
    .describe("Which contract to fetch events from"),
  event: z
    .string()
    .optional()
    .describe(
      "Specific event name, e.g. 'JobCreated', 'JobCompleted', 'FeedbackGiven', 'Transfer'. " +
      "Leave empty to get all events from the contract."
    ),
  fromBlock: z
    .number()
    .optional()
    .describe("Start block. Omit to use latest 1000 blocks."),
  toBlock: z
    .number()
    .optional()
    .describe("End block. Omit for latest."),
  limit: z
    .number()
    .optional()
    .default(20)
    .describe("Max number of events to return (default: 20)"),
});

export async function arcGetEvents(args: z.infer<typeof getEventsSchema>) {
  const client = getPublicClient();

  const latestBlock = await client.getBlockNumber();
  const fromBlock = args.fromBlock
    ? BigInt(args.fromBlock)
    : latestBlock - 1000n;
  const toBlock = args.toBlock ? BigInt(args.toBlock) : latestBlock;

  const contractMap = {
    jobs: ADDRESSES.ERC8183_JOB,
    reputation: ADDRESSES.ERC8004_REPUTATION,
    usdc: ADDRESSES.USDC,
  };

  const abiMap = {
    jobs: ERC8183_ABI,
    reputation: ERC8004_REPUTATION_ABI,
    usdc: USDC_ABI,
  };

  const address = contractMap[args.contract];
  const abi = abiMap[args.contract];

  const logs = await client.getLogs({
    address,
    fromBlock,
    toBlock,
  });

  // Parse and format logs
  const parsed = logs
    .slice(-args.limit) // most recent first
    .reverse()
    .map((log) => ({
      blockNumber: log.blockNumber?.toString(),
      transactionHash: log.transactionHash,
      logIndex: log.logIndex,
      topics: log.topics,
      data: log.data,
      explorer: log.transactionHash
        ? `https://testnet.arcscan.app/tx/${log.transactionHash}`
        : null,
    }));

  return {
    contract: args.contract,
    address,
    range: {
      from: fromBlock.toString(),
      to: toBlock.toString(),
      latest: latestBlock.toString(),
    },
    total: logs.length,
    returned: parsed.length,
    events: parsed,
    note:
      "Raw log data is returned. Use viem's decodeEventLog with the contract ABI for structured output.",
  };
}

// ── arc_get_job_events ─────────────────────────────────────────────────────────
// More ergonomic: get all events for a specific jobId
export const getJobEventsSchema = z.object({
  jobId: z.number().describe("ERC-8183 job ID to fetch event history for"),
});

export async function arcGetJobEvents(args: z.infer<typeof getJobEventsSchema>) {
  const client = getPublicClient();

  const latestBlock = await client.getBlockNumber();
  const fromBlock = 1n; // scan full history for the job

  const jobIdHex = ("0x" + args.jobId.toString(16).padStart(64, "0")) as `0x${string}`;

  // Fetch all job-related events filtered by jobId topic
  const [created, funded, submitted, completed, rejected] = await Promise.all([
    client.getLogs({
      address: ADDRESSES.ERC8183_JOB,
      event: ERC8183_ABI.find((x) => x.type === "event" && x.name === "JobCreated") as any,
      args: { jobId: BigInt(args.jobId) },
      fromBlock,
      toBlock: latestBlock,
    }).catch(() => []),
    client.getLogs({
      address: ADDRESSES.ERC8183_JOB,
      event: ERC8183_ABI.find((x) => x.type === "event" && x.name === "JobFunded") as any,
      args: { jobId: BigInt(args.jobId) },
      fromBlock,
      toBlock: latestBlock,
    }).catch(() => []),
    client.getLogs({
      address: ADDRESSES.ERC8183_JOB,
      event: ERC8183_ABI.find((x) => x.type === "event" && x.name === "JobSubmitted") as any,
      args: { jobId: BigInt(args.jobId) },
      fromBlock,
      toBlock: latestBlock,
    }).catch(() => []),
    client.getLogs({
      address: ADDRESSES.ERC8183_JOB,
      event: ERC8183_ABI.find((x) => x.type === "event" && x.name === "JobCompleted") as any,
      args: { jobId: BigInt(args.jobId) },
      fromBlock,
      toBlock: latestBlock,
    }).catch(() => []),
    client.getLogs({
      address: ADDRESSES.ERC8183_JOB,
      event: ERC8183_ABI.find((x) => x.type === "event" && x.name === "JobRejected") as any,
      args: { jobId: BigInt(args.jobId) },
      fromBlock,
      toBlock: latestBlock,
    }).catch(() => []),
  ]);

  const timeline = [
    ...created.map((l) => ({ event: "JobCreated", block: l.blockNumber?.toString(), tx: l.transactionHash })),
    ...funded.map((l) => ({ event: "JobFunded", block: l.blockNumber?.toString(), tx: l.transactionHash })),
    ...submitted.map((l) => ({ event: "JobSubmitted", block: l.blockNumber?.toString(), tx: l.transactionHash })),
    ...completed.map((l) => ({ event: "JobCompleted", block: l.blockNumber?.toString(), tx: l.transactionHash })),
    ...rejected.map((l) => ({ event: "JobRejected", block: l.blockNumber?.toString(), tx: l.transactionHash })),
  ].sort((a, b) => Number(BigInt(a.block ?? "0") - BigInt(b.block ?? "0")));

  return {
    jobId: args.jobId,
    timeline,
    totalEvents: timeline.length,
  };
}
