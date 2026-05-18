// Phase A end-to-end: post a job assigned to the Gemini agent, trigger the
// deployed autonomous runner, verify the full on-chain lifecycle + payout.
// Run from job-board/: node scripts/e2e-agent.mjs
import { readFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  parseEventLogs,
  zeroAddress,
  formatUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const BASE = process.env.BASE ?? "https://arc-job-board.vercel.app";
const AGENT_WALLETS = {
  gemini: "0xCf63E69EFBb6C73D364a711bda1Be86A56eD78A2",
  mimo: "0xAfb357c9CDd5F9E71047F7Ba2c357C36838cC728",
  llama: "0x3d172e5F28aBD95eBa5997Be6e818F838e9C749E",
  kimi: "0x6f167A2e215393DA174ff49058022B4d0114c01D",
  claude: "0x757717fcD0b14E9124b28DFd2cceE63a4F6D2794",
  openai: "0x0AeAd277AA3fF25D7E598FB475E881a075707E04",
};
const AGENT_ID = process.env.AGENT ?? "gemini";
const GEMINI_WALLET = AGENT_WALLETS[AGENT_ID];
if (!GEMINI_WALLET) throw new Error(`unknown AGENT ${AGENT_ID}`);
const JOB = "0x0747EEf0706327138c69792bF28Cd525089e4583";

function envFromFile(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^['"]|['"]\s*$/g, "").trim();
  }
  return out;
}

const env = envFromFile(new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const PK = env.PRIVATE_KEY;
if (!PK || PK.length < 64) throw new Error("PRIVATE_KEY missing in .env.local");

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
  {
    name: "createJob",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "provider", type: "address" },
      { name: "evaluator", type: "address" },
      { name: "expiredAt", type: "uint256" },
      { name: "description", type: "string" },
      { name: "hook", type: "address" },
    ],
    outputs: [{ name: "jobId", type: "uint256" }],
  },
  {
    name: "getJob",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "client", type: "address" },
          { name: "provider", type: "address" },
          { name: "evaluator", type: "address" },
          { name: "description", type: "string" },
          { name: "budget", type: "uint256" },
          { name: "expiredAt", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "hook", type: "address" },
        ],
      },
    ],
  },
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
];
const STATUS = { 0: "Open", 1: "Funded", 2: "Submitted", 3: "Completed", 4: "Rejected", 5: "Expired" };

const log = (...a) => console.log(...a);

async function main() {
  log("client/evaluator:", account.address);
  log(`provider (${AGENT_ID} agent):`, GEMINI_WALLET);

  const description =
    "Build a single self-contained index.html landing page for a fictional coffee subscription called Northbound Roasters. " +
    "Inline CSS and JS only, one file, no external assets or CDNs. Include a hero with the brand name and a one line value " +
    "proposition, three subscription tiers with prices and a Choose button, a short how it works section with three steps, " +
    "and a footer. Modern clean responsive design, real copy not lorem ipsum. The file must render correctly opened directly " +
    "in a browser.";

  // 1) Create the job on-chain (the poster action).
  const balBefore = await pub.getBalance({ address: GEMINI_WALLET });
  log("\n1) createJob ...");
  const expiredAt = BigInt(Math.floor(Date.now() / 1000) + 86400);
  const hash = await wallet.writeContract({
    address: JOB,
    abi: JOB_ABI,
    functionName: "createJob",
    args: [GEMINI_WALLET, account.address, expiredAt, description, zeroAddress],
  });
  log("   tx:", hash);
  const rcpt = await pub.waitForTransactionReceipt({ hash });
  const logs = parseEventLogs({ abi: JOB_ABI, eventName: "JobCreated", logs: rcpt.logs });
  const jobId = Number(logs[0].args.jobId);
  log("   JobCreated jobId =", jobId, "block", rcpt.blockNumber.toString());

  // 2) Persist the job row so the runner can attach deliverable/notification.
  log("\n2) /api/jobs/save ...");
  const saveRes = await fetch(`${BASE}/api/jobs/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chainJobId: jobId,
      description,
      category: "General",
      clientAddress: account.address,
      providerAddress: GEMINI_WALLET,
      clientEmail: null,
      agent: AGENT_ID,
    }),
  });
  log("   ->", saveRes.status, (await saveRes.text()).slice(0, 200));

  // 3) Trigger the deployed autonomous runner.
  log("\n3) /api/agent/run (this runs the model, submits, evaluates, settles) ...");
  const t0 = Date.now();
  const runRes = await fetch(`${BASE}/api/agent/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, amountUsdc: "1" }),
  });
  const runText = await runRes.text();
  log(`   -> ${runRes.status} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  log("   body:", runText.slice(0, 1200));

  // 4) Verify final on-chain state + payout.
  log("\n4) verify ...");
  const job = await pub.readContract({ address: JOB, abi: JOB_ABI, functionName: "getJob", args: [BigInt(jobId)] });
  log("   on-chain status:", Number(job.status), STATUS[Number(job.status)]);
  const balAfter = await pub.getBalance({ address: GEMINI_WALLET });
  log(
    "   Gemini wallet:",
    formatUnits(balBefore, 18),
    "->",
    formatUnits(balAfter, 18),
    "USDC (delta",
    formatUnits(balAfter - balBefore, 18) + ")"
  );
  const notif = await fetch(`${BASE}/api/notifications?address=${account.address}`);
  log("   notifications:", (await notif.text()).slice(0, 600));
}

main().catch((e) => {
  console.error("E2E FAILED:", e?.shortMessage || e?.message || e);
  process.exit(1);
});
