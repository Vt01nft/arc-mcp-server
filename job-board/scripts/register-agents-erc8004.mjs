// Register each worker agent in the ERC-8004 Identity Registry so the runner
// can record reputation for it on settlement. Each agent calls register()
// from its OWN wallet, so the agent owns its identity. Idempotent: an agent
// that already has an agentId in lib/agents.ts AGENT_IDS is skipped.
//
// Run from job-board/: node scripts/register-agents-erc8004.mjs
// Prints the AGENT_IDS object to paste into lib/agents.ts.
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

const IDENTITY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const MIN_GAS = 50000000000000000n; // 0.05 native USDC; register() is cheap

const AGENTS = [
  { id: "gemini", pkEnv: "AGENT_PK_GEMINI" },
  { id: "mimo", pkEnv: "AGENT_PK_MIMO" },
  { id: "llama", pkEnv: "AGENT_PK_LLAMA" },
  { id: "kimi", pkEnv: "AGENT_PK_KIMI" },
  { id: "claude", pkEnv: "AGENT_PK_CLAUDE" },
  { id: "openai", pkEnv: "AGENT_PK_OPENAI" },
];

const IDENTITY_ABI = [
  { name: "register", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "getAgentWallet", type: "function", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
  { name: "Registered", type: "event", inputs: [
    { name: "agentId", type: "uint256", indexed: true },
    { name: "agentURI", type: "string", indexed: false },
    { name: "owner", type: "address", indexed: true } ] },
];

function envFromFile(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]\s*$/g, "").trim();
  }
  return out;
}
const env = envFromFile(new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

// Parse the already-registered ids out of lib/agents.ts so re-runs are no-ops.
const agentsSrc = readFileSync(
  new URL("../lib/agents.ts", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  "utf8"
);
const known = {};
const block = agentsSrc.match(/AGENT_IDS[^=]*=\s*\{([\s\S]*?)\}/);
if (block) {
  for (const m of block[1].matchAll(/(\w+)\s*:\s*(\d+)/g)) known[m[1]] = Number(m[2]);
}

const arc = defineChain({
  id: 5042002, name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } }, testnet: true,
});
const pub = createPublicClient({ chain: arc, transport: http() });

const results = { ...known };
for (const { id, pkEnv } of AGENTS) {
  if (results[id] != null) {
    console.log(`${id}: already agentId ${results[id]}, skip`);
    continue;
  }
  const pk = env[pkEnv];
  if (!pk) { console.log(`${id}: ${pkEnv} missing, skip`); continue; }
  const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
  const bal = await pub.getBalance({ address: account.address });
  if (bal < MIN_GAS) {
    console.log(`${id}: ${account.address} low gas (${formatUnits(bal, 18)} USDC), skip — fund and re-run`);
    continue;
  }
  const wallet = createWalletClient({ account, chain: arc, transport: http() });
  try {
    const hash = await wallet.writeContract({ address: IDENTITY, abi: IDENTITY_ABI, functionName: "register", args: [] });
    const receipt = await pub.waitForTransactionReceipt({ hash });
    const ev = parseEventLogs({ abi: IDENTITY_ABI, eventName: "Registered", logs: receipt.logs })
      .find((e) => e.args.owner.toLowerCase() === account.address.toLowerCase());
    if (!ev) { console.log(`${id}: registered tx ${hash} but no Registered event found`); continue; }
    const agentId = Number(ev.args.agentId);
    // sanity: the identity's wallet should be the agent wallet
    const wal = await pub.readContract({ address: IDENTITY, abi: IDENTITY_ABI, functionName: "getAgentWallet", args: [BigInt(agentId)] });
    const okWallet = wal.toLowerCase() === account.address.toLowerCase();
    results[id] = agentId;
    console.log(`${id}: agentId ${agentId}  wallet=${wal} ${okWallet ? "OK" : "WALLET-MISMATCH"}  tx=${hash}`);
  } catch (e) {
    console.log(`${id}: register failed: ${(e.shortMessage || e.message || "").slice(0, 160)}`);
  }
}

console.log("\n=== paste into lib/agents.ts AGENT_IDS ===");
console.log("export const AGENT_IDS: Partial<Record<AgentId, number>> = {");
for (const { id } of AGENTS) if (results[id] != null) console.log(`  ${id}: ${results[id]},`);
console.log("};");
