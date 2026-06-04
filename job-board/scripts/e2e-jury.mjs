// End-to-end jury rehearsal against a LOCAL dev server.
// Run from job-board/:
//   1. start the dev server: npx next dev
//   2. node scripts/e2e-jury.mjs
//
// Creates a small jury job (budget=0 so no USDC transfer is needed), waits
// for the agent runner to seat the jury, 3 jurors to vote independently,
// and the server to bridge the result to ERC-8183. Then asserts final state.
import { readFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  formatUnits,
  parseEventLogs,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const ERC8183 = "0x0747EEf0706327138c69792bF28Cd525089e4583";
const HOOK = "0x876E0cC973B36946CAb30Bd01d4F9C1cC0847D38";
const REGISTRY = "0x49fD54E3713CFa32f7A041E3d328FfB0380dd3A6";
const AGENT_WALLETS = {
  gemini: "0xCf63E69EFBb6C73D364a711bda1Be86A56eD78A2",
  mimo: "0xAfb357c9CDd5F9E71047F7Ba2c357C36838cC728",
  llama: "0x3d172e5F28aBD95eBa5997Be6e818F838e9C749E",
  kimi: "0x6f167A2e215393DA174ff49058022B4d0114c01D",
  claude: "0x757717fcD0b14E9124b28DFd2cceE63a4F6D2794",
  openai: "0x0AeAd277AA3fF25D7E598FB475E881a075707E04",
};
const GEMINI_PROVIDER = AGENT_WALLETS[process.env.PROVIDER ?? "gemini"] ?? AGENT_WALLETS.gemini;
const RUNNER = process.env.RUNNER_URL ?? "http://localhost:3000/api/agent/run";

function envFromFile(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]\s*$/g, "").trim();
  }
  return out;
}
const env = envFromFile(new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const PK = env.PRIVATE_KEY;
if (!PK) throw new Error("PRIVATE_KEY missing");

const arc = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  testnet: true,
});
const pub = createPublicClient({ chain: arc, transport: http() });
const server = privateKeyToAccount(PK.startsWith("0x") ? PK : `0x${PK}`);
const serverWallet = createWalletClient({ account: server, chain: arc, transport: http() });

const ERC8183_ABI = [
  { name: "createJob", type: "function", stateMutability: "nonpayable",
    inputs: [
      { name: "provider", type: "address" }, { name: "evaluator", type: "address" },
      { name: "expiredAt", type: "uint256" }, { name: "description", type: "string" },
      { name: "hook", type: "address" }, ],
    outputs: [{ type: "uint256" }] },
  { name: "getJob", type: "function", stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "tuple", components: [
      { name: "id", type: "uint256" }, { name: "client", type: "address" },
      { name: "provider", type: "address" }, { name: "evaluator", type: "address" },
      { name: "description", type: "string" }, { name: "budget", type: "uint256" },
      { name: "expiredAt", type: "uint256" }, { name: "status", type: "uint8" },
      { name: "hook", type: "address" }, ] }] },
  { name: "JobCreated", type: "event", inputs: [
    { name: "jobId", type: "uint256", indexed: true },
    { name: "client", type: "address", indexed: true },
    { name: "provider", type: "address", indexed: true },
    { name: "evaluator", type: "address" }, { name: "expiredAt", type: "uint256" },
    { name: "hook", type: "address" }, ] },
];
const HOOK_ABI = [
  { name: "getJury", type: "function", stateMutability: "view",
    inputs: [{ type: "uint256" }], outputs: [
      { name: "members", type: "address[3]" }, { name: "votes", type: "uint8[3]" },
      { name: "deadline", type: "uint256" }, { name: "resolved", type: "bool" },
      { name: "approves", type: "uint8" }, { name: "rejects", type: "uint8" }, ] },
];
const REG_ABI = [
  { name: "evaluators", type: "function", stateMutability: "view",
    inputs: [{ type: "address" }], outputs: [
      { name: "stake", type: "uint256" }, { name: "totalVotes", type: "uint256" },
      { name: "correctVotes", type: "uint256" }, { name: "active", type: "bool" }, ] },
];
const STATUS = { 0: "Open", 1: "Funded", 2: "Submitted", 3: "Completed", 4: "Rejected", 5: "Expired" };

const log = (...a) => console.log(...a);
const stamp = () => new Date().toISOString().slice(11, 19);

log("server wallet:", server.address);
log("server native:", formatUnits(await pub.getBalance({ address: server.address }), 18), "USDC");

const brief =
  process.env.BRIEF ??
  "Build a one-page HTML site for a fictional company called 'Arbor Tea' that sells loose-leaf tea. Include a hero, a short story section, and a contact form. Self-contained HTML+CSS, no external dependencies.";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const expiry = BigInt(Math.floor(Date.now() / 1000) + 24 * 3600);
log(`\n[${stamp()}] step 1: createJob with hook=zeroAddress (whitelist) ...`);
const createTx = await serverWallet.writeContract({
  address: ERC8183, abi: ERC8183_ABI, functionName: "createJob",
  args: [GEMINI_PROVIDER, server.address, expiry, brief, ZERO_ADDR],
});
const createReceipt = await pub.waitForTransactionReceipt({ hash: createTx });
const created = parseEventLogs({ abi: ERC8183_ABI, eventName: "JobCreated", logs: createReceipt.logs });
if (!created.length) throw new Error("no JobCreated log");
const jobId = created[0].args.jobId;
log(`  jobId=${jobId} tx=${createTx}`);

const j1 = await pub.readContract({ address: ERC8183, abi: ERC8183_ABI, functionName: "getJob", args: [jobId] });
log(`  status=${STATUS[j1.status]} hook=${j1.hook} budget=${formatUnits(j1.budget, 18)}`);

log(`\n[${stamp()}] step 2: kick the runner with useJury:true ...`);
const runRes = await fetch(RUNNER, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jobId: Number(jobId), amountUsdc: "0", useJury: true }),
});
const runData = await runRes.json();
log("  runner status:", runRes.status);
log("  runner body:", JSON.stringify(runData, null, 2).slice(0, 2200));
if (!runData.ok) throw new Error(`runner failed: ${runData.error ?? "unknown"}`);

log(`\n[${stamp()}] step 3: read final jury + job state ...`);
const juryRaw = await pub.readContract({ address: HOOK, abi: HOOK_ABI, functionName: "getJury", args: [jobId] });
// viem returns the 6-output tuple positionally; destructure to canonical names.
const [members, votes, deadline, resolved, approves, rejects] = juryRaw;
log("  jury members:");
members.forEach((m, i) => log(`    #${i + 1} ${m}  vote=${["Pending","Approve","Reject"][votes[i]]}`));
log(`  approves=${approves} rejects=${rejects} resolved=${resolved} deadline=${deadline}`);
const j2 = await pub.readContract({ address: ERC8183, abi: ERC8183_ABI, functionName: "getJob", args: [jobId] });
log(`  job final status=${STATUS[j2.status]} (${j2.status})`);

log(`\n[${stamp()}] step 4: confirm registry tallies updated for the 3 jurors ...`);
for (const m of members) {
  const [stake, total, correct, active] = await pub.readContract({ address: REGISTRY, abi: REG_ABI, functionName: "evaluators", args: [m] });
  log(`  ${m} stake=${formatUnits(stake, 18)} votes=${correct}/${total} active=${active}`);
}

const ok =
  resolved &&
  approves + rejects >= 2 &&
  (j2.status === 3 || j2.status === 4);

log(`\n[${stamp()}] result:`, ok ? "PASS" : "FAIL");
log("  jobId:", jobId.toString());
log("  final job status:", STATUS[j2.status]);
log("  jury approves-rejects:", `${approves}-${rejects}`);
process.exit(ok ? 0 : 1);
