// Manually top up the MultiEvaluatorHook's native USDC reserve. The hook pays
// the 5% jury reward to winning jurors via registry.reward{value:...} on
// budget>0 jobs, so it needs a small native balance. Funding is a privileged
// spend kept OUT of all request paths (see lib/jury.ts seatJuryFor); this is
// the manual/ops way to refill it.
//
// Run from job-board/: [TARGET=0.5] node scripts/fund-hook.mjs
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, defineChain, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const HOOK = "0x876E0cC973B36946CAb30Bd01d4F9C1cC0847D38";
const TARGET = parseUnits(process.env.TARGET ?? "0.5", 18); // top up to this

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
  id: 5042002, name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } }, testnet: true,
});
const pub = createPublicClient({ chain: arc, transport: http() });
const account = privateKeyToAccount(PK.startsWith("0x") ? PK : `0x${PK}`);
const wallet = createWalletClient({ account, chain: arc, transport: http() });

const bal = await pub.getBalance({ address: HOOK });
console.log("hook balance:", formatUnits(bal, 18), "USDC  (target", formatUnits(TARGET, 18) + ")");
if (bal >= TARGET) {
  console.log("already at/above target, nothing to do.");
  process.exit(0);
}
const need = TARGET - bal;
const tx = await wallet.sendTransaction({ to: HOOK, value: need });
await pub.waitForTransactionReceipt({ hash: tx });
const fresh = await pub.getBalance({ address: HOOK });
console.log(`topped up +${formatUnits(need, 18)} USDC  tx=${tx}`);
console.log("hook balance now:", formatUnits(fresh, 18), "USDC");
