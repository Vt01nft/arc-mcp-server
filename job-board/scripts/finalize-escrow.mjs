// Finalize a Funded escrow job to prove ERC-8183 complete() releases the
// escrowed USDC to the provider (agent), with the pool untouched.
// Agent submits (AGENT_PK_GEMINI), evaluator completes (PRIVATE_KEY).
// Usage: JOBID=26442 node scripts/finalize-escrow.mjs
import { readFileSync } from "node:fs";
import {
  createPublicClient, createWalletClient, http, defineChain,
  keccak256, toBytes, formatUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const JOBID = Number(process.env.JOBID);
const PROVIDER = "0xCf63E69EFBb6C73D364a711bda1Be86A56eD78A2"; // gemini agent
const JOB = "0x0747EEf0706327138c69792bF28Cd525089e4583";
const USDC = "0x3600000000000000000000000000000000000000";

const env = {};
for (const l of readFileSync(
  new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  "utf8"
).split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]\s*$/g, "").trim();
}
const arc = defineChain({
  id: 5042002, name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } }, testnet: true,
});
const pub = createPublicClient({ chain: arc, transport: http() });
const mk = (pk) => createWalletClient({
  account: privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`),
  chain: arc, transport: http(),
});
const agent = mk(env.AGENT_PK_GEMINI);
const evaluator = mk(env.PRIVATE_KEY);

const ABI = [
  { name: "submit", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }, { name: "deliverable", type: "bytes32" }, { name: "optParams", type: "bytes" }], outputs: [] },
  { name: "complete", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }, { name: "reason", type: "bytes32" }, { name: "optParams", type: "bytes" }], outputs: [] },
  { name: "getJob", type: "function", stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [{ name: "", type: "tuple", components: [
      { name: "id", type: "uint256" }, { name: "client", type: "address" },
      { name: "provider", type: "address" }, { name: "evaluator", type: "address" },
      { name: "description", type: "string" }, { name: "budget", type: "uint256" },
      { name: "expiredAt", type: "uint256" }, { name: "status", type: "uint8" },
      { name: "hook", type: "address" }] }] },
];
const UABI = [{ name: "balanceOf", type: "function", stateMutability: "view",
  inputs: [{ name: "a", type: "address" }], outputs: [{ name: "", type: "uint256" }] }];
const bal = (a) => pub.readContract({ address: USDC, abi: UABI, functionName: "balanceOf", args: [a] });
const ST = { 0: "Open", 1: "Funded", 2: "Submitted", 3: "Completed", 4: "Rejected" };

const before = await bal(PROVIDER);
let job = await pub.readContract({ address: JOB, abi: ABI, functionName: "getJob", args: [BigInt(JOBID)] });
console.log(`job ${JOBID}: status ${job.status} ${ST[job.status]}, budget ${formatUnits(job.budget, 6)} USDC`);
console.log(`agent USDC before: ${formatUnits(before, 6)}`);

if (Number(job.status) === 1) {
  const hs = await agent.writeContract({ address: JOB, abi: ABI, functionName: "submit",
    args: [BigInt(JOBID), keccak256(toBytes("Rosa tip jar - delivered")), "0x"] });
  await pub.waitForTransactionReceipt({ hash: hs });
  console.log(`submitted: ${hs}`);
  job = await pub.readContract({ address: JOB, abi: ABI, functionName: "getJob", args: [BigInt(JOBID)] });
}
if (Number(job.status) === 2) {
  const hc = await evaluator.writeContract({ address: JOB, abi: ABI, functionName: "complete",
    args: [BigInt(JOBID), keccak256(toBytes("escrow release verification")), "0x"] });
  await pub.waitForTransactionReceipt({ hash: hc });
  console.log(`completed: ${hc}`);
}
job = await pub.readContract({ address: JOB, abi: ABI, functionName: "getJob", args: [BigInt(JOBID)] });
const after = await bal(PROVIDER);
console.log(`\nfinal status: ${job.status} ${ST[job.status]}`);
console.log(`agent USDC ${formatUnits(before, 6)} -> ${formatUnits(after, 6)} (delta ${formatUnits(after - before, 6)})`);
console.log(`escrow released to agent from contract: ${after - before > 0n ? "YES" : "NO"}`);
