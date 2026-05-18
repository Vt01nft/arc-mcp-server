// Fund each agent wallet with a small native-USDC gas balance so it can
// pay for its own submit() tx. Run from job-board/: node scripts/fund-agents.mjs
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, defineChain, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const AGENTS = {
  gemini: "0xCf63E69EFBb6C73D364a711bda1Be86A56eD78A2",
  mimo: "0xAfb357c9CDd5F9E71047F7Ba2c357C36838cC728",
  llama: "0x3d172e5F28aBD95eBa5997Be6e818F838e9C749E",
  kimi: "0x6f167A2e215393DA174ff49058022B4d0114c01D",
  claude: "0x757717fcD0b14E9124b28DFd2cceE63a4F6D2794",
  openai: "0x0AeAd277AA3fF25D7E598FB475E881a075707E04",
};
const PER_AGENT = "1.5"; // USDC native, plenty for many submit() txs at testnet gas

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
const account = privateKeyToAccount(PK.startsWith("0x") ? PK : `0x${PK}`);
const wallet = createWalletClient({ account, chain: arc, transport: http() });

const need = parseUnits(PER_AGENT, 18);
const log = (...a) => console.log(...a);

const src = await pub.getBalance({ address: account.address });
log("funder", account.address, formatUnits(src, 18), "USDC\n");

for (const [id, addr] of Object.entries(AGENTS)) {
  const bal = await pub.getBalance({ address: addr });
  if (bal >= need) {
    log(`${id.padEnd(7)} ${addr}  ${formatUnits(bal, 18)} USDC  (already funded, skip)`);
    continue;
  }
  const top = need - bal;
  const h = await wallet.sendTransaction({ to: addr, value: top });
  await pub.waitForTransactionReceipt({ hash: h });
  const after = await pub.getBalance({ address: addr });
  log(`${id.padEnd(7)} ${addr}  -> ${formatUnits(after, 18)} USDC  (${h})`);
}
log("\ndone.");
