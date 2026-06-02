// CCTP v2 test burn on Optimism Sepolia -> Arc. Burns USDC on Optimism so the
// /cctp page (or /api/cctp/receive) can complete the mint on Arc.
//
// Run from job-board/:
//   OP_PK=0x... ARC_RECIPIENT=0x... AMOUNT=1 node scripts/cctp-burn.mjs
//
// Needs an Optimism Sepolia wallet with testnet USDC + ETH for gas.
// USDC (OP Sepolia): 0x5fd84259d66Cd46123540766Be93DFE6D43130D7 (Circle docs).
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  parseUnits,
  pad,
  parseEventLogs,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const TOKEN_MESSENGER = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA";
const USDC_OP = "0x5fd84259d66Cd46123540766Be93DFE6D43130D7";
const ARC_DOMAIN = 26;
const STANDARD_FINALITY = 2000; // CCTP v2: 2000 = standard (slower, no fast fee)

const OP_PK = process.env.OP_PK;
const ARC_RECIPIENT = process.env.ARC_RECIPIENT;
const AMOUNT = process.env.AMOUNT ?? "1";
if (!OP_PK || !ARC_RECIPIENT) {
  console.error("Set OP_PK and ARC_RECIPIENT (and optional AMOUNT).");
  process.exit(2);
}

const opSepolia = defineChain({
  id: 11155420,
  name: "Optimism Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://sepolia.optimism.io"] } },
  testnet: true,
});
const account = privateKeyToAccount(OP_PK.startsWith("0x") ? OP_PK : `0x${OP_PK}`);
const pub = createPublicClient({ chain: opSepolia, transport: http() });
const wallet = createWalletClient({ account, chain: opSepolia, transport: http() });

const ERC20 = [
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
];
const MESSENGER = [
  { name: "depositForBurn", type: "function", stateMutability: "nonpayable", inputs: [
    { name: "amount", type: "uint256" }, { name: "destinationDomain", type: "uint32" },
    { name: "mintRecipient", type: "bytes32" }, { name: "burnToken", type: "address" },
    { name: "destinationCaller", type: "bytes32" }, { name: "maxFee", type: "uint256" },
    { name: "minFinalityThreshold", type: "uint32" } ], outputs: [] },
];

const amount = parseUnits(AMOUNT, 6);
console.log("burner:", account.address);
console.log("burning", AMOUNT, "USDC -> Arc recipient", ARC_RECIPIENT);

const allowance = await pub.readContract({ address: USDC_OP, abi: ERC20, functionName: "allowance", args: [account.address, TOKEN_MESSENGER] });
if (allowance < amount) {
  const a = await wallet.writeContract({ address: USDC_OP, abi: ERC20, functionName: "approve", args: [TOKEN_MESSENGER, amount] });
  await pub.waitForTransactionReceipt({ hash: a });
  console.log("approved:", a);
}

const burn = await wallet.writeContract({
  address: TOKEN_MESSENGER, abi: MESSENGER, functionName: "depositForBurn",
  args: [amount, ARC_DOMAIN, pad(ARC_RECIPIENT, { size: 32 }), USDC_OP, pad("0x0", { size: 32 }), 0n, STANDARD_FINALITY],
});
const receipt = await pub.waitForTransactionReceipt({ hash: burn });
console.log("\nBURN TX:", burn, "(status", receipt.status + ")");
console.log("Now complete on Arc: paste this hash into /cctp, or");
console.log(`  curl -XPOST localhost:3000/api/cctp/receive -H 'content-type: application/json' -d '{"burnTxHash":"${burn}"}'`);
