/**
 * Arc Multi-Evaluator Demo
 * ─────────────────────────────────────────────────────────────────────────────
 * Demonstrates the 3-agent jury lifecycle on Arc Testnet:
 *   1. 3 evaluators stake and register
 *   2. An ERC-8183 job is created with the MultiEvaluatorHook as the hook address
 *   3. A deliverable is submitted → hook assigns a jury
 *   4. Jury members vote (2-of-3)
 *   5. Hook resolves: USDC released or refunded, fee split, minority slashed
 *
 * Requirements:
 *   - Deployed contracts (run forge script Deploy.s.sol first)
 *   - PRIVATE_KEY env var (evaluator 1 wallet)
 *   - PRIVATE_KEY_2, PRIVATE_KEY_3 for evaluators 2 & 3
 *
 * Run: npx tsx demo.ts
 */

import { createPublicClient, createWalletClient, http, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ADDRESSES } from "./addresses.js";

// ── Arc Testnet chain definition ──────────────────────────────────────────────
const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
} as const;

// ── ABIs (minimal subset for demo) ────────────────────────────────────────────
const REGISTRY_ABI = [
  { name: "register", type: "function", stateMutability: "payable", inputs: [], outputs: [] },
  { name: "isActive", type: "function", stateMutability: "view", inputs: [{ name: "evaluator", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { name: "getStake", type: "function", stateMutability: "view", inputs: [{ name: "evaluator", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "activeCount", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "count", type: "uint256" }] },
] as const;

const HOOK_ABI = [
  { name: "onDeliverableSubmitted", type: "function", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "uint256" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "castVote", type: "function", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "uint256" }, { name: "approve", type: "bool" }], outputs: [] },
  {
    name: "getJury", type: "function", stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      { name: "members", type: "address[3]" },
      { name: "votes", type: "uint8[3]" },
      { name: "deadline", type: "uint256" },
      { name: "resolved", type: "bool" },
      { name: "approves", type: "uint8" },
      { name: "rejects", type: "uint8" },
    ],
  },
  { name: "getVoteStatus", type: "function", stateMutability: "view", inputs: [{ name: "jobId", type: "uint256" }], outputs: [{ name: "approves", type: "uint8" }, { name: "rejects", type: "uint8" }, { name: "pending", type: "uint8" }, { name: "canResolve", type: "bool" }] },
] as const;

// ── Setup clients ─────────────────────────────────────────────────────────────
const transport = http("https://rpc.testnet.arc.network");
const publicClient = createPublicClient({ chain: arcTestnet, transport });

function getWallet(pk: string) {
  const account = privateKeyToAccount(pk as `0x${string}`);
  return { account, client: createWalletClient({ account, chain: arcTestnet, transport }) };
}

// ── Main demo ─────────────────────────────────────────────────────────────────
async function main() {
  const pk1 = process.env.PRIVATE_KEY;
  const pk2 = process.env.PRIVATE_KEY_2;
  const pk3 = process.env.PRIVATE_KEY_3;

  if (!pk1 || !pk2 || !pk3) {
    console.error("Set PRIVATE_KEY, PRIVATE_KEY_2, PRIVATE_KEY_3 in environment");
    process.exit(1);
  }

  if (ADDRESSES.EVALUATOR_REGISTRY === "0x0000000000000000000000000000000000000000") {
    console.error("Update demo/addresses.ts with deployed contract addresses first.");
    process.exit(1);
  }

  const ev1 = getWallet(pk1);
  const ev2 = getWallet(pk2);
  const ev3 = getWallet(pk3);

  console.log("\n=== Arc Multi-Evaluator Demo ===");
  console.log(`Evaluator 1: ${ev1.account.address}`);
  console.log(`Evaluator 2: ${ev2.account.address}`);
  console.log(`Evaluator 3: ${ev3.account.address}`);

  // ── Step 1: Register evaluators ──────────────────────────────────────────
  console.log("\n── 1. Registering evaluators (10 USDC stake each) ───");
  for (const [label, ev] of [["Evaluator 1", ev1], ["Evaluator 2", ev2], ["Evaluator 3", ev3]] as const) {
    const active = await publicClient.readContract({
      address: ADDRESSES.EVALUATOR_REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "isActive",
      args: [ev.account.address],
    });

    if (!active) {
      const hash = await (ev as typeof ev1).client.writeContract({
        address: ADDRESSES.EVALUATOR_REGISTRY,
        abi: REGISTRY_ABI,
        functionName: "register",
        value: parseEther("10"),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  ✓ ${label} registered - tx: ${hash.slice(0, 10)}…`);
    } else {
      console.log(`  ✓ ${label} already registered`);
    }
  }

  const activeCount = await publicClient.readContract({
    address: ADDRESSES.EVALUATOR_REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "activeCount",
  });
  console.log(`  Active evaluators in registry: ${activeCount}`);

  // ── Step 2: Simulate deliverable submission (trigger jury assignment) ────
  const jobId = 1n; // Use a real jobId from an active ERC-8183 job
  const jobValue = parseEther("100"); // 100 USDC

  console.log(`\n── 2. Triggering jury assignment for job #${jobId} ───`);
  const assignHash = await ev1.client.writeContract({
    address: ADDRESSES.MULTI_EVALUATOR_HOOK,
    abi: HOOK_ABI,
    functionName: "onDeliverableSubmitted",
    args: [jobId, jobValue],
  });
  await publicClient.waitForTransactionReceipt({ hash: assignHash });
  console.log(`  ✓ Jury assigned - tx: ${assignHash.slice(0, 10)}…`);

  // ── Step 3: Read jury ────────────────────────────────────────────────────
  const jury = await publicClient.readContract({
    address: ADDRESSES.MULTI_EVALUATOR_HOOK,
    abi: HOOK_ABI,
    functionName: "getJury",
    args: [jobId],
  });
  console.log(`  Jury members:`);
  for (const m of jury[0]) console.log(`    - ${m}`);
  console.log(`  Deadline: ${new Date(Number(jury[2]) * 1000).toLocaleString()}`);

  // ── Step 4: Cast votes (2 approve → resolve) ─────────────────────────────
  console.log(`\n── 3. Casting votes ───`);

  // Map juror addresses back to their wallets
  const walletMap = new Map([
    [ev1.account.address.toLowerCase(), ev1],
    [ev2.account.address.toLowerCase(), ev2],
    [ev3.account.address.toLowerCase(), ev3],
  ]);

  let votesCast = 0;
  for (const member of jury[0]) {
    const wallet = walletMap.get(member.toLowerCase());
    if (!wallet || votesCast >= 2) break;

    const hash = await wallet.client.writeContract({
      address: ADDRESSES.MULTI_EVALUATOR_HOOK,
      abi: HOOK_ABI,
      functionName: "castVote",
      args: [jobId, true], // approve
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  ✓ ${member.slice(0, 8)}… voted Approve - tx: ${hash.slice(0, 10)}…`);
    votesCast++;
  }

  // ── Step 5: Check resolution ─────────────────────────────────────────────
  const [,, , resolved, approves, rejects] = await publicClient.readContract({
    address: ADDRESSES.MULTI_EVALUATOR_HOOK,
    abi: HOOK_ABI,
    functionName: "getJury",
    args: [jobId],
  });

  console.log(`\n── Result ───`);
  console.log(`  Resolved: ${resolved}`);
  console.log(`  Approves: ${approves} / Rejects: ${rejects}`);
  console.log(`  Outcome: ${resolved ? (approves > rejects ? "✅ APPROVED" : "❌ REJECTED") : "⏳ PENDING"}`);
  console.log(`\n✅ Multi-evaluator demo complete\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
