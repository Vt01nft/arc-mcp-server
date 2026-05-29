// Read-only diagnostic for the v2 jury layer (Sprint 2).
// Run from job-board/: node scripts/jury-status.mjs
// Prints server-wallet balance + the registry/hook wiring invariants so we
// can confirm the redeploy is healthy before wiring the runner.
import { readFileSync } from "node:fs";
import { createPublicClient, http, defineChain, formatUnits, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const REGISTRY = "0x49fD54E3713CFa32f7A041E3d328FfB0380dd3A6";
const HOOK = "0x876E0cC973B36946CAb30Bd01d4F9C1cC0847D38";

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

const arc = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  testnet: true,
});
const pub = createPublicClient({ chain: arc, transport: http() });
const server = privateKeyToAccount(PK.startsWith("0x") ? PK : `0x${PK}`);

const REGISTRY_ABI = [
  { name: "hook", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "activeCount", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "MIN_STAKE", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "evaluatorList", type: "function", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
  { name: "evaluators", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [
    { name: "stake", type: "uint256" }, { name: "totalVotes", type: "uint256" },
    { name: "correctVotes", type: "uint256" }, { name: "active", type: "bool" } ] },
];
const HOOK_ABI = [
  { name: "authorizedCaller", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "registry", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
];

const r = (fn, args = []) => pub.readContract({ address: REGISTRY, abi: REGISTRY_ABI, functionName: fn, args });
const h = (fn, args = []) => pub.readContract({ address: HOOK, abi: HOOK_ABI, functionName: fn, args });

console.log("server wallet:", server.address);
console.log("native balance:", formatUnits(await pub.getBalance({ address: server.address }), 18), "USDC");

const [regHook, hookCaller, hookReg, hookOwner, minStake, active] = await Promise.all([
  r("hook"), h("authorizedCaller"), h("registry"), h("owner"), r("MIN_STAKE"), r("activeCount"),
]);
console.log("\n— wiring —");
console.log("registry.hook()       =", regHook, regHook.toLowerCase() === HOOK.toLowerCase() ? "OK" : "MISMATCH");
console.log("hook.registry()       =", hookReg, hookReg.toLowerCase() === REGISTRY.toLowerCase() ? "OK" : "MISMATCH");
console.log("hook.owner()          =", hookOwner);
console.log("hook.authorizedCaller =", hookCaller, hookCaller.toLowerCase() === server.address.toLowerCase() ? "OK (= server)" : "NOT server");
console.log("MIN_STAKE             =", formatUnits(minStake, 18), "USDC");

console.log("\n— evaluator pool —");
console.log("activeCount =", active.toString());
for (let i = 0; i < 50; i++) {
  let addr;
  try { addr = await r("evaluatorList", [BigInt(i)]); } catch { break; }
  const [stake, total, correct, isActive] = await r("evaluators", [addr]);
  console.log(`#${i} ${getAddress(addr)} stake=${formatUnits(stake, 18)} votes=${total}/${correct} active=${isActive}`);
}
console.log("\njury-ready:", active >= 3n ? "YES" : `NO (need ${3n - active} more active)`);
