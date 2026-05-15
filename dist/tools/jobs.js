import { z } from "zod";
import { isAddress, keccak256, toHex, decodeEventLog } from "viem";
import { getPublicClient, getWalletClient, formatUsdc, parseUsdc, txLink, } from "../arc-client.js";
import { ADDRESSES, USDC_DECIMALS } from "../contracts/addresses.js";
import { ERC8183_ABI, USDC_ABI, JOB_STATUS } from "../contracts/abis.js";
// Deployed contract is AgenticCommerce (ERC-8183) at
// 0x0747EEf0706327138c69792bF28Cd525089e4583. Verified flow:
//   createJob (client) -> setBudget (provider) -> approve+fund (client)
//   -> submit (provider) -> complete | reject (evaluator)
// Budget/USDC use the 6-decimal ERC-20 interface.
const NO_OPT = "0x";
const ZERO = "0x0000000000000000000000000000000000000000";
// deliverable / reason are bytes32 onchain; description is a plain string.
function toBytes32(text) {
    if (text.startsWith("0x") && text.length === 66)
        return text;
    return keccak256(toHex(text));
}
// ── arc_create_job ─────────────────────────────────────────────────────────────
export const createJobSchema = z.object({
    provider: z.string().describe("Address of the agent/person who will do the work"),
    evaluator: z.string().describe("Address of the evaluator who approves/rejects the deliverable. May equal the client for self-evaluation."),
    description: z.string().describe("Job description, stored onchain as a string"),
    expiryHours: z
        .number()
        .min(1)
        .max(720)
        .default(48)
        .describe("Hours until job expires and USDC can be refunded (default: 48)"),
    hook: z
        .string()
        .optional()
        .describe("Optional hook contract address. Leave empty for none."),
});
export async function arcCreateJob(args) {
    const client = getPublicClient();
    const { client: walletClient, account } = getWalletClient();
    if (!isAddress(args.provider))
        throw new Error(`Invalid provider: ${args.provider}`);
    if (!isAddress(args.evaluator))
        throw new Error(`Invalid evaluator: ${args.evaluator}`);
    if (args.hook && !isAddress(args.hook))
        throw new Error(`Invalid hook: ${args.hook}`);
    const expiredAt = BigInt(Math.floor(Date.now() / 1000) + args.expiryHours * 3600);
    const hookAddress = (args.hook ?? ZERO);
    const hash = await walletClient.writeContract({
        address: ADDRESSES.ERC8183_JOB,
        abi: ERC8183_ABI,
        functionName: "createJob",
        args: [args.provider, args.evaluator, expiredAt, args.description, hookAddress],
        account,
        chain: walletClient.chain,
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    // Decode JobCreated to recover the jobId
    let jobId = null;
    for (const log of receipt.logs) {
        try {
            const decoded = decodeEventLog({
                abi: ERC8183_ABI,
                eventName: "JobCreated",
                topics: log.topics,
                data: log.data,
            });
            jobId = decoded.args.jobId.toString();
            break;
        }
        catch {
            /* not JobCreated */
        }
    }
    return {
        success: receipt.status === "success",
        hash,
        explorer: txLink(hash),
        jobId,
        job: {
            client: account.address,
            provider: args.provider,
            evaluator: args.evaluator,
            description: args.description,
            expiry: new Date(Number(expiredAt) * 1000).toISOString(),
            status: "Open",
            hook: args.hook ?? "none",
        },
        next_step: "Job is Open with budget 0. The provider calls arc_set_budget, then the client calls arc_fund_job.",
        note: "No USDC is locked until the budget is set and the job is funded.",
    };
}
// ── arc_get_job ────────────────────────────────────────────────────────────────
export const getJobSchema = z.object({
    jobId: z.number().describe("ERC-8183 job ID"),
});
export async function arcGetJob(args) {
    const client = getPublicClient();
    const job = await client.readContract({
        address: ADDRESSES.ERC8183_JOB,
        abi: ERC8183_ABI,
        functionName: "getJob",
        args: [BigInt(args.jobId)],
    });
    const statusLabel = JOB_STATUS[job.status] ?? "Unknown";
    const expiryDate = new Date(Number(job.expiredAt) * 1000).toISOString();
    const isExpired = Date.now() > Number(job.expiredAt) * 1000;
    return {
        id: job.id.toString(),
        client: job.client,
        provider: job.provider,
        evaluator: job.evaluator,
        status: statusLabel,
        status_code: job.status,
        budget: `${formatUsdc(job.budget, USDC_DECIMALS)} USDC`,
        budget_raw: job.budget.toString(),
        description: job.description,
        expiry: expiryDate,
        expired: isExpired,
        hook: job.hook !== ZERO ? job.hook : null,
        explorer: `https://testnet.arcscan.app/address/${ADDRESSES.ERC8183_JOB}`,
    };
}
// ── arc_get_job_count ──────────────────────────────────────────────────────────
export async function arcGetJobCount() {
    const client = getPublicClient();
    const total = await client.readContract({
        address: ADDRESSES.ERC8183_JOB,
        abi: ERC8183_ABI,
        functionName: "jobCounter",
    });
    const latestBlock = await client.getBlockNumber();
    return {
        total_jobs: Number(total),
        note: "Global counter across the shared ERC-8183 contract, not just this app's jobs.",
        latest_block: latestBlock.toString(),
        contract: ADDRESSES.ERC8183_JOB,
        explorer: `https://testnet.arcscan.app/address/${ADDRESSES.ERC8183_JOB}`,
    };
}
// ── arc_set_budget ─────────────────────────────────────────────────────────────
export const setBudgetSchema = z.object({
    jobId: z.number().describe("ERC-8183 job ID (must be Open)"),
    amount: z.string().describe('USDC budget to quote, e.g. "50" or "10.5"'),
});
export async function arcSetBudget(args) {
    const client = getPublicClient();
    const { client: walletClient, account } = getWalletClient();
    const amount = parseUsdc(args.amount, USDC_DECIMALS); // ERC-20 USDC = 6 dp
    const hash = await walletClient.writeContract({
        address: ADDRESSES.ERC8183_JOB,
        abi: ERC8183_ABI,
        functionName: "setBudget",
        args: [BigInt(args.jobId), amount, NO_OPT],
        account,
        chain: walletClient.chain,
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    return {
        success: receipt.status === "success",
        hash,
        explorer: txLink(hash),
        jobId: args.jobId,
        budget: `${args.amount} USDC`,
        note: "Caller must be the job's provider. The client now calls arc_fund_job.",
    };
}
// ── arc_fund_job ───────────────────────────────────────────────────────────────
// fund() pulls job.budget via USDC.transferFrom, so this approves first.
// Requires the budget to already be set (arc_set_budget) and the caller to be
// the job's client.
export const fundJobSchema = z.object({
    jobId: z.number().describe("ERC-8183 job ID to fund (budget must be set, status Open)"),
});
export async function arcFundJob(args) {
    const client = getPublicClient();
    const { client: walletClient, account } = getWalletClient();
    const job = await client.readContract({
        address: ADDRESSES.ERC8183_JOB,
        abi: ERC8183_ABI,
        functionName: "getJob",
        args: [BigInt(args.jobId)],
    });
    if (job.budget === 0n) {
        throw new Error("Budget is 0. The provider must call arc_set_budget before the job can be funded.");
    }
    const approveHash = await walletClient.writeContract({
        address: ADDRESSES.USDC,
        abi: USDC_ABI,
        functionName: "approve",
        args: [ADDRESSES.ERC8183_JOB, job.budget],
        account,
        chain: walletClient.chain,
    });
    await client.waitForTransactionReceipt({ hash: approveHash });
    const hash = await walletClient.writeContract({
        address: ADDRESSES.ERC8183_JOB,
        abi: ERC8183_ABI,
        functionName: "fund",
        args: [BigInt(args.jobId), NO_OPT],
        account,
        chain: walletClient.chain,
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    return {
        success: receipt.status === "success",
        hash,
        approve_tx: approveHash,
        explorer: txLink(hash),
        jobId: args.jobId,
        amount_escrowed: `${formatUsdc(job.budget, USDC_DECIMALS)} USDC`,
        status: "Funded",
        next_step: "Provider calls arc_submit_deliverable with the work hash.",
    };
}
// ── arc_submit_deliverable ─────────────────────────────────────────────────────
export const submitDeliverableSchema = z.object({
    jobId: z.number().describe("ERC-8183 job ID"),
    deliverable: z
        .string()
        .describe("Deliverable content or IPFS/Arweave URI, hashed to bytes32 onchain. " +
        "For large outputs store on IPFS and pass the CID."),
});
export async function arcSubmitDeliverable(args) {
    const client = getPublicClient();
    const { client: walletClient, account } = getWalletClient();
    const deliverableHash = toBytes32(args.deliverable);
    const hash = await walletClient.writeContract({
        address: ADDRESSES.ERC8183_JOB,
        abi: ERC8183_ABI,
        functionName: "submit",
        args: [BigInt(args.jobId), deliverableHash, NO_OPT],
        account,
        chain: walletClient.chain,
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    return {
        success: receipt.status === "success",
        hash,
        explorer: txLink(hash),
        jobId: args.jobId,
        deliverable_original: args.deliverable,
        deliverable_hash: deliverableHash,
        status: "Submitted",
        next_step: "Evaluator calls arc_complete_job or arc_reject_job.",
    };
}
// ── arc_complete_job ───────────────────────────────────────────────────────────
export const completeJobSchema = z.object({
    jobId: z.number().describe("ERC-8183 job ID"),
    reason: z
        .string()
        .default("Deliverable accepted")
        .describe("Reason for completion, stored as bytes32 onchain"),
});
export async function arcCompleteJob(args) {
    const client = getPublicClient();
    const { client: walletClient, account } = getWalletClient();
    const reasonHash = toBytes32(args.reason);
    const hash = await walletClient.writeContract({
        address: ADDRESSES.ERC8183_JOB,
        abi: ERC8183_ABI,
        functionName: "complete",
        args: [BigInt(args.jobId), reasonHash, NO_OPT],
        account,
        chain: walletClient.chain,
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    return {
        success: receipt.status === "success",
        hash,
        explorer: txLink(hash),
        jobId: args.jobId,
        reason: args.reason,
        reason_hash: reasonHash,
        status: "Completed",
        note: "USDC released from escrow to the provider. Job finalized.",
    };
}
// ── arc_reject_job ─────────────────────────────────────────────────────────────
export const rejectJobSchema = z.object({
    jobId: z.number().describe("ERC-8183 job ID"),
    reason: z
        .string()
        .default("Deliverable rejected")
        .describe("Reason for rejection, stored as bytes32 onchain"),
});
export async function arcRejectJob(args) {
    const client = getPublicClient();
    const { client: walletClient, account } = getWalletClient();
    const reasonHash = toBytes32(args.reason);
    const hash = await walletClient.writeContract({
        address: ADDRESSES.ERC8183_JOB,
        abi: ERC8183_ABI,
        functionName: "reject",
        args: [BigInt(args.jobId), reasonHash, NO_OPT],
        account,
        chain: walletClient.chain,
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    return {
        success: receipt.status === "success",
        hash,
        explorer: txLink(hash),
        jobId: args.jobId,
        reason: args.reason,
        reason_hash: reasonHash,
        status: "Rejected",
        note: "USDC refunded from escrow to the client.",
    };
}
// ── arc_refund_job ─────────────────────────────────────────────────────────────
export const refundJobSchema = z.object({
    jobId: z.number().describe("ERC-8183 job ID to refund after expiry"),
});
export async function arcRefundJob(args) {
    const client = getPublicClient();
    const { client: walletClient, account } = getWalletClient();
    const hash = await walletClient.writeContract({
        address: ADDRESSES.ERC8183_JOB,
        abi: ERC8183_ABI,
        functionName: "claimRefund",
        args: [BigInt(args.jobId)],
        account,
        chain: walletClient.chain,
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    return {
        success: receipt.status === "success",
        hash,
        explorer: txLink(hash),
        jobId: args.jobId,
        status: "Refunded",
        note: "USDC returned to the client after expiry without completion.",
    };
}
//# sourceMappingURL=jobs.js.map