import { z } from "zod";
import { isAddress, keccak256, toHex } from "viem";
import { getPublicClient, getWalletClient, formatUsdc, parseUsdc, txLink, } from "../arc-client.js";
import { ADDRESSES, USDC_DECIMALS } from "../contracts/addresses.js";
import { ERC8183_ABI, JOB_STATUS } from "../contracts/abis.js";
// ── Helper: encode description as bytes32 ─────────────────────────────────────
function toBytes32(text) {
    // If it's already a hex bytes32, return as-is
    if (text.startsWith("0x") && text.length === 66)
        return text;
    // Otherwise hash the text to bytes32
    return keccak256(toHex(text));
}
// ── arc_create_job ─────────────────────────────────────────────────────────────
export const createJobSchema = z.object({
    provider: z.string().describe("Address of the agent/person who will do the work"),
    evaluator: z.string().describe("Address of the evaluator who approves/rejects the deliverable. Can equal client address for self-evaluation."),
    description: z
        .string()
        .describe("Job description - will be hashed to bytes32 onchain"),
    expiryHours: z
        .number()
        .min(1)
        .max(720)
        .default(48)
        .describe("Hours until job expires and USDC is auto-refunded (default: 48)"),
    hook: z
        .string()
        .optional()
        .describe("Optional hook contract address for custom job logic (reputation checks, bidding, etc). Leave empty for none."),
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
    const expiry = BigInt(Math.floor(Date.now() / 1000) + args.expiryHours * 3600);
    const descriptionHash = toBytes32(args.description);
    const hookAddress = (args.hook ?? "0x0000000000000000000000000000000000000000");
    const hash = await walletClient.writeContract({
        address: ADDRESSES.ERC8183_JOB,
        abi: ERC8183_ABI,
        functionName: "createJob",
        args: [args.provider, args.evaluator, expiry, descriptionHash, hookAddress],
        account,
        chain: walletClient.chain,
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    // Parse JobCreated event to get jobId
    const jobCreatedLog = receipt.logs.find((log) => log.address.toLowerCase() === ADDRESSES.ERC8183_JOB.toLowerCase());
    return {
        success: receipt.status === "success",
        hash,
        explorer: txLink(hash),
        job: {
            client: account.address,
            provider: args.provider,
            evaluator: args.evaluator,
            description: args.description,
            description_hash: descriptionHash,
            expiry: new Date(Number(expiry) * 1000).toISOString(),
            status: "Open",
            hook: args.hook ?? "none",
        },
        next_step: "Fund the job with arc_fund_job using the jobId from the event log.",
        note: "Job is now Open. No USDC is locked until funded. The provider cannot start until the job is Funded.",
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
        functionName: "jobs",
        args: [BigInt(args.jobId)],
    });
    const statusLabel = JOB_STATUS[job.status] ?? "Unknown";
    const expiryDate = new Date(Number(job.expiry) * 1000).toISOString();
    const isExpired = Date.now() > Number(job.expiry) * 1000;
    return {
        id: job.id.toString(),
        client: job.client,
        provider: job.provider,
        evaluator: job.evaluator,
        status: statusLabel,
        status_code: job.status,
        amount: `${formatUsdc(job.amount, USDC_DECIMALS)} USDC`,
        amount_raw: job.amount.toString(),
        description_hash: job.description,
        deliverable_hash: job.deliverable !== "0x0000000000000000000000000000000000000000000000000000000000000000"
            ? job.deliverable
            : null,
        expiry: expiryDate,
        expired: isExpired,
        hook: job.hook !== "0x0000000000000000000000000000000000000000" ? job.hook : null,
        explorer: `https://testnet.arcscan.app/address/${ADDRESSES.ERC8183_JOB}`,
    };
}
// ── arc_get_job_count ──────────────────────────────────────────────────────────
export async function arcGetJobCount() {
    const client = getPublicClient();
    // RPC limits getLogs to 10,000 blocks per call - paginate in 9,999-block chunks.
    // Scan backwards until we find the deployment (no events for 3 consecutive chunks).
    const CHUNK = 9999n;
    const MAX_EMPTY_CHUNKS = 3; // stop after 3 consecutive empty chunks
    const jobCreatedEvent = ERC8183_ABI.find((x) => x.type === "event" && x.name === "JobCreated");
    const latestBlock = await client.getBlockNumber();
    let total = 0;
    let emptyStreak = 0;
    let toBlock = latestBlock;
    while (toBlock > 0n) {
        const fromBlock = toBlock > CHUNK ? toBlock - CHUNK : 0n;
        const logs = await client.getLogs({
            address: ADDRESSES.ERC8183_JOB,
            event: jobCreatedEvent,
            fromBlock,
            toBlock,
        });
        total += logs.length;
        if (logs.length === 0) {
            emptyStreak++;
            if (emptyStreak >= MAX_EMPTY_CHUNKS)
                break; // before contract deployment
        }
        else {
            emptyStreak = 0;
        }
        if (fromBlock === 0n)
            break;
        toBlock = fromBlock - 1n;
    }
    return {
        total_jobs: total,
        latest_block: latestBlock.toString(),
        contract: ADDRESSES.ERC8183_JOB,
        explorer: `https://testnet.arcscan.app/address/${ADDRESSES.ERC8183_JOB}`,
    };
}
// ── arc_fund_job ───────────────────────────────────────────────────────────────
export const fundJobSchema = z.object({
    jobId: z.number().describe("ERC-8183 job ID to fund"),
    amount: z.string().describe('USDC amount to escrow, e.g. "50" or "10.5"'),
});
export async function arcFundJob(args) {
    const client = getPublicClient();
    const { client: walletClient, account } = getWalletClient();
    // On Arc, USDC is the native token - fundJob takes msg.value (18 decimals)
    const amountNative = parseUsdc(args.amount, 18);
    const hash = await walletClient.writeContract({
        address: ADDRESSES.ERC8183_JOB,
        abi: ERC8183_ABI,
        functionName: "fundJob",
        args: [BigInt(args.jobId)],
        value: amountNative, // native USDC (18 decimals)
        account,
        chain: walletClient.chain,
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    return {
        success: receipt.status === "success",
        hash,
        explorer: txLink(hash),
        jobId: args.jobId,
        amount_escrowed: `${args.amount} USDC`,
        status: "Funded",
        next_step: "Provider can now call arc_submit_deliverable with the work hash.",
    };
}
// ── arc_submit_deliverable ─────────────────────────────────────────────────────
export const submitDeliverableSchema = z.object({
    jobId: z.number().describe("ERC-8183 job ID"),
    deliverable: z
        .string()
        .describe("Deliverable content or IPFS/Arweave URI - will be hashed to bytes32 onchain. " +
        "For large outputs, store on IPFS and pass the CID here."),
});
export async function arcSubmitDeliverable(args) {
    const client = getPublicClient();
    const { client: walletClient, account } = getWalletClient();
    const deliverableHash = toBytes32(args.deliverable);
    const hash = await walletClient.writeContract({
        address: ADDRESSES.ERC8183_JOB,
        abi: ERC8183_ABI,
        functionName: "submitDeliverable",
        args: [BigInt(args.jobId), deliverableHash],
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
        next_step: "Evaluator must now call arc_complete_job or arc_reject_job.",
        note: "The deliverable hash is stored onchain. The actual content should be available at the URI for the evaluator to review.",
    };
}
// ── arc_complete_job ───────────────────────────────────────────────────────────
export const completeJobSchema = z.object({
    jobId: z.number().describe("ERC-8183 job ID"),
    reason: z
        .string()
        .default("Deliverable accepted")
        .describe("Reason for completion - stored as bytes32 onchain"),
});
export async function arcCompleteJob(args) {
    const client = getPublicClient();
    const { client: walletClient, account } = getWalletClient();
    const reasonHash = toBytes32(args.reason);
    const hash = await walletClient.writeContract({
        address: ADDRESSES.ERC8183_JOB,
        abi: ERC8183_ABI,
        functionName: "completeJob",
        args: [BigInt(args.jobId), reasonHash],
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
        note: "USDC has been released from escrow to the provider. Job is finalized.",
    };
}
// ── arc_reject_job ─────────────────────────────────────────────────────────────
export const rejectJobSchema = z.object({
    jobId: z.number().describe("ERC-8183 job ID"),
    reason: z
        .string()
        .default("Deliverable rejected")
        .describe("Reason for rejection - stored as bytes32 onchain"),
});
export async function arcRejectJob(args) {
    const client = getPublicClient();
    const { client: walletClient, account } = getWalletClient();
    const reasonHash = toBytes32(args.reason);
    const hash = await walletClient.writeContract({
        address: ADDRESSES.ERC8183_JOB,
        abi: ERC8183_ABI,
        functionName: "rejectJob",
        args: [BigInt(args.jobId), reasonHash],
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
        note: "USDC has been refunded from escrow to the client.",
    };
}
// ── arc_refund_job ─────────────────────────────────────────────────────────────
export const refundJobSchema = z.object({
    jobId: z.number().describe("ERC-8183 job ID to refund (must be Expired)"),
});
export async function arcRefundJob(args) {
    const client = getPublicClient();
    const { client: walletClient, account } = getWalletClient();
    const hash = await walletClient.writeContract({
        address: ADDRESSES.ERC8183_JOB,
        abi: ERC8183_ABI,
        functionName: "refundJob",
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
        note: "USDC has been returned to the client. Job expired without completion.",
    };
}
//# sourceMappingURL=jobs.js.map