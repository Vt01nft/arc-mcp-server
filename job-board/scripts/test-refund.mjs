// Determine ERC-8183 reject/refund behavior: does reject() auto-return the
// escrow to the client, or must the client call claimRefund()? No LLM used.
import { readFileSync } from "node:fs";
import {
  createPublicClient, createWalletClient, http, defineChain,
  parseEventLogs, parseUnits, formatUnits, keccak256, toBytes, zeroAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const BASE = "https://arc-job-board.vercel.app";
const PROVIDER = "0xCf63E69EFBb6C73D364a711bda1Be86A56eD78A2"; // gemini agent
const JOB = "0x0747EEf0706327138c69792bF28Cd525089e4583";
const USDC = "0x3600000000000000000000000000000000000000";
const AMT = "0.5";

const env = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]\s*$/g, "").trim();
}
const arc = defineChain({ id: 5042002, name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } }, testnet: true });
const pub = createPublicClient({ chain: arc, transport: http() });
const mk = (pk) => createWalletClient({ account: privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`), chain: arc, transport: http() });
const client = mk(env.PRIVATE_KEY);          // also evaluator
const agent = mk(env.AGENT_PK_GEMINI);

const ABI = [
  { name: "createJob", type: "function", stateMutability: "nonpayable", inputs: [
    { name: "provider", type: "address" }, { name: "evaluator", type: "address" },
    { name: "expiredAt", type: "uint256" }, { name: "description", type: "string" },
    { name: "hook", type: "address" }], outputs: [{ name: "jobId", type: "uint256" }] },
  { name: "fund", type: "function", stateMutability: "nonpayable", inputs: [{ name: "j", type: "uint256" }, { name: "p", type: "bytes" }], outputs: [] },
  { name: "submit", type: "function", stateMutability: "nonpayable", inputs: [{ name: "j", type: "uint256" }, { name: "d", type: "bytes32" }, { name: "p", type: "bytes" }], outputs: [] },
  { name: "reject", type: "function", stateMutability: "nonpayable", inputs: [{ name: "j", type: "uint256" }, { name: "r", type: "bytes32" }, { name: "p", type: "bytes" }], outputs: [] },
  { name: "claimRefund", type: "function", stateMutability: "nonpayable", inputs: [{ name: "j", type: "uint256" }], outputs: [] },
  { name: "getJob", type: "function", stateMutability: "view", inputs: [{ name: "j", type: "uint256" }],
    outputs: [{ name: "", type: "tuple", components: [
      { name: "id", type: "uint256" }, { name: "client", type: "address" }, { name: "provider", type: "address" },
      { name: "evaluator", type: "address" }, { name: "description", type: "string" }, { name: "budget", type: "uint256" },
      { name: "expiredAt", type: "uint256" }, { name: "status", type: "uint8" }, { name: "hook", type: "address" }] }] },
  { name: "JobCreated", type: "event", inputs: [
    { name: "jobId", type: "uint256", indexed: true }, { name: "client", type: "address", indexed: true },
    { name: "provider", type: "address", indexed: true }, { name: "evaluator", type: "address", indexed: false },
    { name: "expiredAt", type: "uint256", indexed: false }, { name: "hook", type: "address", indexed: false }] },
];
const UABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
];
const bal = (a) => pub.readContract({ address: USDC, abi: UABI, functionName: "balanceOf", args: [a] });
const get = (j) => pub.readContract({ address: JOB, abi: ABI, functionName: "getJob", args: [BigInt(j)] });
const ST = { 0: "Open", 1: "Funded", 2: "Submitted", 3: "Completed", 4: "Rejected", 5: "Expired" };
const f = (x) => formatUnits(x, 6);

const caddr = client.account.address;
const raw = parseUnits(AMT, 6);

const h1 = await client.writeContract({ address: JOB, abi: ABI, functionName: "createJob",
  args: [PROVIDER, caddr, BigInt(Math.floor(Date.now() / 1000) + 86400), "refund-behavior probe", zeroAddress] });
const r1 = await pub.waitForTransactionReceipt({ hash: h1 });
const jobId = Number(parseEventLogs({ abi: ABI, eventName: "JobCreated", logs: r1.logs })[0].args.jobId);
console.log("job", jobId, "created");

const sb = await fetch(`${BASE}/api/agent/set-budget`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, amountUsdc: AMT }) }).then((x) => x.json());
console.log("set-budget:", sb.ok ? "ok" : sb);

await pub.waitForTransactionReceipt({ hash: await client.writeContract({ address: USDC, abi: UABI, functionName: "approve", args: [JOB, raw] }) });
await pub.waitForTransactionReceipt({ hash: await client.writeContract({ address: JOB, abi: ABI, functionName: "fund", args: [BigInt(jobId), "0x"] }) });
const afterFund = await bal(caddr);
console.log(`funded. status ${ST[(await get(jobId)).status]}. client USDC after fund: ${f(afterFund)}`);

await pub.waitForTransactionReceipt({ hash: await agent.writeContract({ address: JOB, abi: ABI, functionName: "submit", args: [BigInt(jobId), keccak256(toBytes("x")), "0x"] }) });
await pub.waitForTransactionReceipt({ hash: await client.writeContract({ address: JOB, abi: ABI, functionName: "reject", args: [BigInt(jobId), keccak256(toBytes("probe reject")), "0x"] }) });
const afterReject = await bal(caddr);
console.log(`rejected. status ${ST[(await get(jobId)).status]}. client USDC after reject: ${f(afterReject)}  (delta vs post-fund: ${f(afterReject - afterFund)})`);

const autoRefunded = afterReject - afterFund >= raw - parseUnits("0.02", 6);
if (autoRefunded) {
  console.log("\nCONCLUSION: reject() AUTO-REFUNDS the client. No claimRefund button needed.");
} else {
  console.log("\nreject() did NOT auto-refund. Trying claimRefund()...");
  try {
    await pub.waitForTransactionReceipt({ hash: await client.writeContract({ address: JOB, abi: ABI, functionName: "claimRefund", args: [BigInt(jobId)] }) });
    const afterClaim = await bal(caddr);
    console.log(`after claimRefund: ${f(afterClaim)} (delta vs post-fund: ${f(afterClaim - afterFund)})`);
    console.log(afterClaim - afterFund >= raw - parseUnits("0.02", 6)
      ? "\nCONCLUSION: client must call claimRefund() after a reject. Wire a Claim Refund button."
      : "\nCONCLUSION: claimRefund did not return funds either. Investigate contract.");
  } catch (e) {
    console.log("claimRefund reverted:", e?.shortMessage || e?.message);
  }
}
