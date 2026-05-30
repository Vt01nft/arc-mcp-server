// Read-only post-flight verification of a jury job. Pass JOBID env to inspect.
//   JOBID=68647 node scripts/verify-jury-job.mjs
import { createPublicClient, http, defineChain, formatUnits } from "viem";

const ERC8183 = "0x0747EEf0706327138c69792bF28Cd525089e4583";
const HOOK = "0x876E0cC973B36946CAb30Bd01d4F9C1cC0847D38";
const REGISTRY = "0x49fD54E3713CFa32f7A041E3d328FfB0380dd3A6";
const jobId = BigInt(process.env.JOBID ?? "68647");

const arc = defineChain({
  id: 5042002, name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } }, testnet: true,
});
const pub = createPublicClient({ chain: arc, transport: http() });

const ERC8183_ABI = [{ name: "getJob", type: "function", stateMutability: "view",
  inputs: [{ type: "uint256" }],
  outputs: [{ type: "tuple", components: [
    { name: "id", type: "uint256" }, { name: "client", type: "address" },
    { name: "provider", type: "address" }, { name: "evaluator", type: "address" },
    { name: "description", type: "string" }, { name: "budget", type: "uint256" },
    { name: "expiredAt", type: "uint256" }, { name: "status", type: "uint8" },
    { name: "hook", type: "address" } ] }] }];
const HOOK_ABI = [{ name: "getJury", type: "function", stateMutability: "view",
  inputs: [{ type: "uint256" }], outputs: [
    { name: "members", type: "address[3]" }, { name: "votes", type: "uint8[3]" },
    { name: "deadline", type: "uint256" }, { name: "resolved", type: "bool" },
    { name: "approves", type: "uint8" }, { name: "rejects", type: "uint8" } ] }];
const REG_ABI = [{ name: "evaluators", type: "function", stateMutability: "view",
  inputs: [{ type: "address" }], outputs: [
    { name: "stake", type: "uint256" }, { name: "totalVotes", type: "uint256" },
    { name: "correctVotes", type: "uint256" }, { name: "active", type: "bool" } ] }];
const STATUS = { 0: "Open", 1: "Funded", 2: "Submitted", 3: "Completed", 4: "Rejected", 5: "Expired" };

const job = await pub.readContract({ address: ERC8183, abi: ERC8183_ABI, functionName: "getJob", args: [jobId] });
console.log("=== ERC-8183 job", jobId.toString(), "===");
console.log("status     :", STATUS[job.status], `(${job.status})`);
console.log("provider   :", job.provider);
console.log("evaluator  :", job.evaluator);
console.log("budget     :", formatUnits(job.budget, 18), "native USDC");
console.log("hook (8183):", job.hook);

const juryRaw = await pub.readContract({ address: HOOK, abi: HOOK_ABI, functionName: "getJury", args: [jobId] });
const [members, votes, deadline, resolved, approves, rejects] = juryRaw;
console.log("\n=== MultiEvaluatorHook jury for", jobId.toString(), "===");
console.log("seated     :", deadline > 0n);
console.log("deadline   :", deadline > 0n ? new Date(Number(deadline) * 1000).toISOString() : "—");
console.log("resolved   :", resolved);
console.log("tally      :", `approves=${approves}  rejects=${rejects}`);
console.log("members + votes:");
members.forEach((m, i) =>
  console.log(`  #${i + 1} ${m}  ${["Pending", "Approve", "Reject"][votes[i]]}`)
);

console.log("\n=== EvaluatorRegistry tallies for the 3 jurors ===");
for (const m of members) {
  const [stake, totalVotes, correctVotes, active] = await pub.readContract({
    address: REGISTRY, abi: REG_ABI, functionName: "evaluators", args: [m],
  });
  console.log(`  ${m}  stake=${formatUnits(stake, 18)}  votes=${correctVotes}/${totalVotes}  active=${active}`);
}

const ok = resolved && approves + rejects >= 2 && (job.status === 3 || job.status === 4);
console.log("\nresult:", ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
