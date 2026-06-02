// Prove ERC-8004 feedback now works for a registered agent: simulate, send,
// read back. Run from job-board/: AGENTID=32861 node scripts/test-erc8004-feedback.mjs
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, defineChain, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const REPUTATION = "0x8004B663056A597Dffe9eCcC1965A193B7388713";
const agentId = BigInt(process.env.AGENTID ?? "32861");

function envFromFile(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]\s*$/g, "").trim();
  }
  return out;
}
const env = envFromFile(new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const account = privateKeyToAccount(env.PRIVATE_KEY.startsWith("0x") ? env.PRIVATE_KEY : `0x${env.PRIVATE_KEY}`);

const arc = defineChain({
  id: 5042002, name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } }, testnet: true,
});
const pub = createPublicClient({ chain: arc, transport: http() });
const wallet = createWalletClient({ account, chain: arc, transport: http() });

const ABI = [
  { name: "giveFeedback", type: "function", stateMutability: "nonpayable", inputs: [
    { name: "agentId", type: "uint256" }, { name: "value", type: "int128" },
    { name: "valueDecimals", type: "uint8" }, { name: "tag1", type: "string" },
    { name: "tag2", type: "string" }, { name: "endpoint", type: "string" },
    { name: "feedbackURI", type: "string" }, { name: "feedbackHash", type: "bytes32" } ], outputs: [] },
  { name: "readAllFeedback", type: "function", stateMutability: "view", inputs: [
    { name: "agentId", type: "uint256" }, { name: "clientAddresses", type: "address[]" },
    { name: "tag1", type: "string" }, { name: "tag2", type: "string" },
    { name: "includeRevoked", type: "bool" } ], outputs: [
    { name: "clients", type: "address[]" }, { name: "feedbackIndexes", type: "uint64[]" },
    { name: "values", type: "int128[]" }, { name: "valueDecimals", type: "uint8[]" },
    { name: "tag1s", type: "string[]" }, { name: "tag2s", type: "string[]" },
    { name: "revokedStatuses", type: "bool[]" } ] },
];

const args = [agentId, 100n, 0, "arc-job", "jury", "", "https://arc-job-board.vercel.app/jobs/test", keccak256(toBytes("on-chain test feedback"))];

console.log("caller:", account.address, "\nagentId:", agentId.toString());
console.log("\n1) simulate giveFeedback ...");
await pub.simulateContract({ account, address: REPUTATION, abi: ABI, functionName: "giveFeedback", args });
console.log("   OK (would succeed)");

console.log("\n2) send giveFeedback ...");
const tx = await wallet.writeContract({ address: REPUTATION, abi: ABI, functionName: "giveFeedback", args });
await pub.waitForTransactionReceipt({ hash: tx });
console.log("   tx:", tx);

console.log("\n3) readAllFeedback ...");
const r = await pub.readContract({ address: REPUTATION, abi: ABI, functionName: "readAllFeedback", args: [agentId, [], "", "", false] });
const [clients, idxs, values, decs, t1, t2] = r;
console.log("   feedback count:", clients.length);
clients.forEach((c, i) => console.log(`   [${i}] from=${c} value=${values[i]} dec=${decs[i]} tag1=${t1[i]} tag2=${t2[i]}`));
const mine = clients.some((c) => c.toLowerCase() === account.address.toLowerCase());
console.log("\nresult:", mine ? "PASS (our feedback is on-chain)" : "FAIL (not found)");
process.exit(mine ? 0 : 1);
