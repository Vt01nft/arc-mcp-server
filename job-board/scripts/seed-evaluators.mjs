// Seed the v2 jury pool with 3 project-controlled evaluators.
// Idempotent: re-running skips funding/registration that already happened.
// Run from job-board/: node scripts/seed-evaluators.mjs
//
// First run: generates EVALUATOR_PK_1/2/3, appends them to .env.local
// (which is gitignored), funds each ~10.05 native USDC from PRIVATE_KEY,
// and calls registry.register() with msg.value = 10 USDC native (MIN_STAKE).
//
// Private keys are never echoed; only addresses + on-chain status are printed.
import { readFileSync, appendFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  parseUnits,
  formatUnits,
  getAddress,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const REGISTRY = "0x49fD54E3713CFa32f7A041E3d328FfB0380dd3A6";
const STAKE = parseUnits("10", 18);          // MIN_STAKE = 10 USDC native
const GAS_BUFFER = parseUnits("0.05", 18);   // headroom for future castVote()
const FUND_PER = STAKE + GAS_BUFFER;         // 10.05 native USDC per evaluator
const ENV_PATH = new URL("../.env.local", import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  "$1"
);

const REGISTRY_ABI = [
  { name: "register", type: "function", stateMutability: "payable", inputs: [], outputs: [] },
  { name: "isActive", type: "function", stateMutability: "view",
    inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },
  { name: "activeCount", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ type: "uint256" }] },
  { name: "evaluators", type: "function", stateMutability: "view",
    inputs: [{ type: "address" }], outputs: [
      { name: "stake", type: "uint256" }, { name: "totalVotes", type: "uint256" },
      { name: "correctVotes", type: "uint256" }, { name: "active", type: "bool" } ] },
];

function envFromFile(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]\s*$/g, "").trim();
  }
  return out;
}

function ensureKey(env, name) {
  let pk = env[name];
  if (!pk) {
    pk = generatePrivateKey();
    appendFileSync(ENV_PATH, `\n${name}=${pk}\n`);
    console.log(`  generated ${name} (appended to .env.local)`);
  }
  return pk.startsWith("0x") ? pk : `0x${pk}`;
}

const env = envFromFile(ENV_PATH);
const SERVER_PK = env.PRIVATE_KEY;
if (!SERVER_PK) throw new Error("PRIVATE_KEY missing in .env.local");

const arc = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  testnet: true,
});
const pub = createPublicClient({ chain: arc, transport: http() });
const serverAccount = privateKeyToAccount(SERVER_PK.startsWith("0x") ? SERVER_PK : `0x${SERVER_PK}`);
const serverWallet = createWalletClient({ account: serverAccount, chain: arc, transport: http() });

console.log("server:", serverAccount.address);
console.log("server native balance:", formatUnits(await pub.getBalance({ address: serverAccount.address }), 18), "USDC");
console.log("registry:", REGISTRY);

const slots = ["EVALUATOR_PK_1", "EVALUATOR_PK_2", "EVALUATOR_PK_3"];
const evaluators = [];
console.log("\n— preparing 3 evaluator wallets —");
for (const name of slots) {
  const pk = ensureKey(env, name);
  const acc = privateKeyToAccount(pk);
  evaluators.push({ name, account: acc });
  console.log(`  ${name} => ${acc.address}`);
}

console.log("\n— funding (if needed) —");
for (const { name, account } of evaluators) {
  const bal = await pub.getBalance({ address: account.address });
  if (bal >= FUND_PER) {
    console.log(`  ${name} already has ${formatUnits(bal, 18)} USDC, skip fund`);
    continue;
  }
  const need = FUND_PER - bal;
  const hash = await serverWallet.sendTransaction({ to: account.address, value: need });
  await pub.waitForTransactionReceipt({ hash });
  console.log(`  ${name} +${formatUnits(need, 18)} USDC  tx=${hash}`);
}

console.log("\n— register (if not active) —");
for (const { name, account } of evaluators) {
  const active = await pub.readContract({
    address: REGISTRY, abi: REGISTRY_ABI, functionName: "isActive", args: [account.address],
  });
  if (active) {
    console.log(`  ${name} already active, skip register`);
    continue;
  }
  const wallet = createWalletClient({ account, chain: arc, transport: http() });
  const hash = await wallet.writeContract({
    address: REGISTRY, abi: REGISTRY_ABI, functionName: "register", args: [], value: STAKE,
  });
  await pub.waitForTransactionReceipt({ hash });
  console.log(`  ${name} staked 10 USDC  tx=${hash}`);
}

console.log("\n— final state —");
const active = await pub.readContract({
  address: REGISTRY, abi: REGISTRY_ABI, functionName: "activeCount",
});
console.log("activeCount =", active.toString());
for (const { name, account } of evaluators) {
  const [stake, total, correct, isAct] = await pub.readContract({
    address: REGISTRY, abi: REGISTRY_ABI, functionName: "evaluators", args: [account.address],
  });
  console.log(
    `  ${name} ${getAddress(account.address)}` +
    ` stake=${formatUnits(stake, 18)} active=${isAct} votes=${correct}/${total}`
  );
}
console.log("\njury-ready:", active >= 3n ? "YES" : `NO (need ${3n - active} more)`);
