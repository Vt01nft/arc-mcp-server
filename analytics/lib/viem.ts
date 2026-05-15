import { createPublicClient, http, formatUnits } from "viem";

export const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_ARC_RPC ?? "https://rpc.testnet.arc.network"] },
  },
} as const;

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(process.env.NEXT_PUBLIC_ARC_RPC ?? "https://rpc.testnet.arc.network"),
});

export const ADDRESSES = {
  ERC8183_JOB: "0x0747EEf0706327138c69792bF28Cd525089e4583" as `0x${string}`,
  ERC8004_REPUTATION: "0x8004B663056A597Dffe9eCcC1965A193B7388713" as `0x${string}`,
  USDC: "0x3600000000000000000000000000000000000000" as `0x${string}`,
} as const;

// VERIFIED against the deployed AgenticCommerce impl (0xa316fd02...,
// verified on arcscan). The event topic0 is keccak256 of the FULL canonical
// signature (all params, indexed or not) - the previous 3-arg JobCreated etc.
// produced the wrong topic0, so getLogs returned nothing.
export const ERC8183_EVENTS_ABI = [
  {
    name: "JobCreated",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "provider", type: "address", indexed: true },
      { name: "evaluator", type: "address", indexed: false },
      { name: "expiredAt", type: "uint256", indexed: false },
      { name: "hook", type: "address", indexed: false },
    ],
  },
  {
    name: "JobFunded",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    name: "JobSubmitted",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "provider", type: "address", indexed: true },
      { name: "deliverable", type: "bytes32", indexed: false },
    ],
  },
  {
    name: "JobCompleted",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "evaluator", type: "address", indexed: true },
      { name: "reason", type: "bytes32", indexed: false },
    ],
  },
  {
    name: "JobRejected",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "rejector", type: "address", indexed: true },
      { name: "reason", type: "bytes32", indexed: false },
    ],
  },
  {
    name: "Refunded",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    name: "BudgetSet",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export function formatUsdc(raw: bigint, decimals = 6): string {
  return formatUnits(raw, decimals);
}
