// One-shot rotation of the historically leaked deployer/evaluator key.
// Generates a fresh key, moves the testnet USDC to it, and rewrites
// .env.local (PRIVATE_KEY + NEXT_PUBLIC_EVALUATOR_ADDRESS). The new private
// key is NEVER printed; only public info (addresses, tx, balances).
// A 1 USDC reserve is left on the old wallet so any in-flight job created
// with the old evaluator can still be settled manually if ever needed.
import { readFileSync, writeFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  parseUnits,
  formatUnits,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const ENV_PATH = new URL("../.env.local", import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  "$1"
);
const raw = readFileSync(ENV_PATH, "utf8");
const env = {};
for (const l of raw.split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]\s*$/g, "").trim();
}

const arc = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  testnet: true,
});
const pub = createPublicClient({ chain: arc, transport: http() });

const oldPk = env.PRIVATE_KEY.startsWith("0x")
  ? env.PRIVATE_KEY
  : `0x${env.PRIVATE_KEY}`;
const oldAcct = privateKeyToAccount(oldPk);
const oldWallet = createWalletClient({
  account: oldAcct,
  chain: arc,
  transport: http(),
});

const newPk = generatePrivateKey();
const newAcct = privateKeyToAccount(newPk);

const bal = await pub.getBalance({ address: oldAcct.address });
console.log("old wallet:", oldAcct.address);
console.log("new wallet:", newAcct.address);
console.log("old balance:", formatUnits(bal, 18), "USDC");

const reserve = parseUnits("1", 18); // left on old for any straggler cleanup
if (bal <= reserve) {
  console.log("balance <= reserve, skipping transfer");
} else {
  const value = bal - reserve;
  const hash = await oldWallet.sendTransaction({
    to: newAcct.address,
    value,
  });
  await pub.waitForTransactionReceipt({ hash });
  console.log("moved", formatUnits(value, 18), "USDC -> new  tx:", hash);
}

// Rewrite .env.local: replace PRIVATE_KEY, set/replace the evaluator address.
let lines = raw.split(/\r?\n/);
let sawEval = false;
lines = lines.map((line) => {
  if (/^\s*PRIVATE_KEY\s*=/.test(line)) return `PRIVATE_KEY=${newPk}`;
  if (/^\s*NEXT_PUBLIC_EVALUATOR_ADDRESS\s*=/.test(line)) {
    sawEval = true;
    return `NEXT_PUBLIC_EVALUATOR_ADDRESS=${newAcct.address}`;
  }
  return line;
});
if (!sawEval) {
  lines.push(`NEXT_PUBLIC_EVALUATOR_ADDRESS=${newAcct.address}`);
}
writeFileSync(ENV_PATH, lines.join("\n"), "utf8");

const newBal = await pub.getBalance({ address: newAcct.address });
console.log(".env.local updated (PRIVATE_KEY + NEXT_PUBLIC_EVALUATOR_ADDRESS)");
console.log("new wallet balance:", formatUnits(newBal, 18), "USDC");
console.log("NEW_EVALUATOR_ADDRESS=" + newAcct.address);
