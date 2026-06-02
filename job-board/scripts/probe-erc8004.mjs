// Probe whether ERC-8004 giveFeedback can be called for an agent keyed by a
// deterministic id derived from its wallet, WITHOUT prior identity registration.
// Pure simulation (eth_call) — no gas, no state change. Settles how (or whether)
// to wire "reputation on jury resolution" before writing any runner code.
import { readFileSync } from "node:fs";
import { createPublicClient, http, defineChain, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const REPUTATION = "0x8004B663056A597Dffe9eCcC1965A193B7388713";
const GEMINI_AGENT = "0xCf63E69EFBb6C73D364a711bda1Be86A56eD78A2";

function envFromFile(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]\s*$/g, "").trim();
  }
  return out;
}
const env = envFromFile(new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const account = privateKeyToAccount(
  env.PRIVATE_KEY.startsWith("0x") ? env.PRIVATE_KEY : `0x${env.PRIVATE_KEY}`
);

const arc = defineChain({
  id: 5042002, name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } }, testnet: true,
});
const pub = createPublicClient({ chain: arc, transport: http() });

const ABI = [
  { name: "giveFeedback", type: "function", stateMutability: "nonpayable", inputs: [
    { name: "agentId", type: "uint256" }, { name: "score", type: "int128" },
    { name: "feedbackType", type: "uint8" }, { name: "tag", type: "string" },
    { name: "strengths", type: "string" }, { name: "improvements", type: "string" },
    { name: "context", type: "string" }, { name: "feedbackHash", type: "bytes32" } ], outputs: [] },
  { name: "getReputation", type: "function", stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "totalScore", type: "int256" }, { name: "eventCount", type: "uint256" }] },
];

// Candidate agentId derivations to test.
const candidates = {
  "uint160(address)": BigInt(GEMINI_AGENT),
  "1 (low int)": 1n,
};

console.log("caller (server wallet):", account.address);
console.log("reputation registry   :", REPUTATION, "\n");

for (const [label, agentId] of Object.entries(candidates)) {
  process.stdout.write(`agentId via ${label} = ${agentId}\n`);
  // 1) read current reputation
  try {
    const [total, count] = await pub.readContract({
      address: REPUTATION, abi: ABI, functionName: "getReputation", args: [agentId],
    });
    console.log(`  getReputation -> totalScore=${total} eventCount=${count}`);
  } catch (e) {
    console.log(`  getReputation reverted: ${(e.shortMessage || e.message || "").slice(0, 140)}`);
  }
  // 2) simulate giveFeedback (no gas) to see if it would succeed
  try {
    await pub.simulateContract({
      account, address: REPUTATION, abi: ABI, functionName: "giveFeedback",
      args: [
        agentId, 50n, 0, "jury", "passed jury", "", "probe only",
        keccak256(toBytes("probe")),
      ],
    });
    console.log("  simulate giveFeedback -> OK (would succeed)\n");
  } catch (e) {
    console.log(`  simulate giveFeedback -> REVERT: ${(e.shortMessage || e.message || "").slice(0, 200)}\n`);
  }
}
