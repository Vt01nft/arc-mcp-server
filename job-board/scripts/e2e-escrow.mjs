// Full client-funded ERC-8183 escrow loop, on-chain, against production.
// Client = local PRIVATE_KEY wallet (no Circle PIN needed for viem signing).
// Proves: client USDC debited into escrow -> agent works -> complete()
// releases escrow to the agent automatically -> pool NOT used.
// Run from job-board/: node scripts/e2e-escrow.mjs
import { readFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  parseEventLogs,
  parseUnits,
  formatUnits,
  zeroAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const BASE = process.env.BASE ?? "https://arc-job-board.vercel.app";
const AGENT = process.env.AGENT ?? "gemini";
const AGENT_WALLETS = {
  gemini: "0xCf63E69EFBb6C73D364a711bda1Be86A56eD78A2",
  llama: "0x3d172e5F28aBD95eBa5997Be6e818F838e9C749E",
};
const PROVIDER = AGENT_WALLETS[AGENT];
const JOB = "0x0747EEf0706327138c69792bF28Cd525089e4583";
const USDC = "0x3600000000000000000000000000000000000000";
const AMOUNT = process.env.AMOUNT ?? "1";

const env = {};
for (const l of readFileSync(
  new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  "utf8"
).split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]\s*$/g, "").trim();
}
const PK = env.PRIVATE_KEY;

const arc = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  testnet: true,
});
const pub = createPublicClient({ chain: arc, transport: http() });
const account = privateKeyToAccount(PK.startsWith("0x") ? PK : `0x${PK}`);
const wallet = createWalletClient({ account, chain: arc, transport: http() });

const JOB_ABI = [
  { name: "createJob", type: "function", stateMutability: "nonpayable",
    inputs: [
      { name: "provider", type: "address" }, { name: "evaluator", type: "address" },
      { name: "expiredAt", type: "uint256" }, { name: "description", type: "string" },
      { name: "hook", type: "address" }],
    outputs: [{ name: "jobId", type: "uint256" }] },
  { name: "fund", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }, { name: "optParams", type: "bytes" }], outputs: [] },
  { name: "getJob", type: "function", stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [{ name: "", type: "tuple", components: [
      { name: "id", type: "uint256" }, { name: "client", type: "address" },
      { name: "provider", type: "address" }, { name: "evaluator", type: "address" },
      { name: "description", type: "string" }, { name: "budget", type: "uint256" },
      { name: "expiredAt", type: "uint256" }, { name: "status", type: "uint8" },
      { name: "hook", type: "address" }] }] },
  { name: "JobCreated", type: "event", inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "provider", type: "address", indexed: true },
      { name: "evaluator", type: "address", indexed: false },
      { name: "expiredAt", type: "uint256", indexed: false },
      { name: "hook", type: "address", indexed: false }] },
];
const USDC_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{ name: "a", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "s", type: "address" }, { name: "v", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] },
];
const ST = { 0: "Open", 1: "Funded", 2: "Submitted", 3: "Completed", 4: "Rejected", 5: "Expired" };
const log = (...a) => console.log(...a);
const usdc = (a) => (addr) =>
  pub.readContract({ address: USDC, abi: USDC_ABI, functionName: "balanceOf", args: [addr] });
const bal = usdc();

async function main() {
  log(`client/evaluator: ${account.address}`);
  log(`provider (${AGENT}): ${PROVIDER}\n`);
  const raw = parseUnits(AMOUNT, 6);

  const cBefore = await bal(account.address);
  const aBefore = await bal(PROVIDER);
  log(`client USDC: ${formatUnits(cBefore, 6)}   agent USDC: ${formatUnits(aBefore, 6)}`);

  // 1) createJob (client)
  const desc =
    "Build a single self-contained index.html: a tip jar page for a street musician named Rosa, with a hero, a short story paragraph, three preset tip buttons, and a footer. Inline CSS/JS, real copy, renders standalone.";
  const h1 = await wallet.writeContract({
    address: JOB, abi: JOB_ABI, functionName: "createJob",
    args: [PROVIDER, account.address, BigInt(Math.floor(Date.now() / 1000) + 86400), desc, zeroAddress],
  });
  const r1 = await pub.waitForTransactionReceipt({ hash: h1 });
  const jobId = Number(parseEventLogs({ abi: JOB_ABI, eventName: "JobCreated", logs: r1.logs })[0].args.jobId);
  log(`\n1) createJob -> jobId ${jobId}`);

  // 2) server (agent wallet) quotes the budget
  const sb = await fetch(`${BASE}/api/agent/set-budget`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, amountUsdc: AMOUNT }),
  }).then((x) => x.json());
  log(`2) /api/agent/set-budget -> ${JSON.stringify(sb)}`);
  if (!sb.ok) throw new Error("set-budget failed");

  // 3) client approve + fund (the debit into escrow)
  const ha = await wallet.writeContract({
    address: USDC, abi: USDC_ABI, functionName: "approve", args: [JOB, raw] });
  await pub.waitForTransactionReceipt({ hash: ha });
  const hf = await wallet.writeContract({
    address: JOB, abi: JOB_ABI, functionName: "fund", args: [BigInt(jobId), "0x"] });
  await pub.waitForTransactionReceipt({ hash: hf });
  const jAfterFund = await pub.readContract({ address: JOB, abi: JOB_ABI, functionName: "getJob", args: [BigInt(jobId)] });
  log(`3) approve + fund -> status ${jAfterFund.status} ${ST[jAfterFund.status]}, budget ${formatUnits(jAfterFund.budget, 6)} USDC`);

  // 4) run the agent (submit -> evaluate -> complete releases escrow)
  const run = await fetch(`${BASE}/api/agent/run`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, amountUsdc: AMOUNT }),
  });
  const rt = await run.text();
  log(`4) /api/agent/run -> ${run.status}\n   ${rt.slice(0, 500)}`);

  // 5) verify money moved via escrow, not pool
  const job = await pub.readContract({ address: JOB, abi: JOB_ABI, functionName: "getJob", args: [BigInt(jobId)] });
  const cAfter = await bal(account.address);
  const aAfter = await bal(PROVIDER);
  log(`\n5) final status: ${job.status} ${ST[job.status]}`);
  log(`   client USDC ${formatUnits(cBefore, 6)} -> ${formatUnits(cAfter, 6)} (delta ${formatUnits(cAfter - cBefore, 6)})`);
  log(`   agent  USDC ${formatUnits(aBefore, 6)} -> ${formatUnits(aAfter, 6)} (delta ${formatUnits(aAfter - aBefore, 6)})`);
  let payoutTx = null;
  try { payoutTx = JSON.parse(rt).payoutTx; } catch {}
  log(`   pool payoutTx: ${payoutTx}  (must be null - escrow paid, not pool)`);
}
main().catch((e) => { console.error("ESCROW E2E FAILED:", e?.shortMessage || e?.message || e); process.exit(1); });
