// ─── USDC ERC-20 ABI (6-decimal interface for transfers) ──────────────────────
export const USDC_ABI = [
    {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "transfer",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        name: "approve",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        name: "allowance",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
        ],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "decimals",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint8" }],
    },
    {
        name: "Transfer",
        type: "event",
        inputs: [
            { name: "from", type: "address", indexed: true },
            { name: "to", type: "address", indexed: true },
            { name: "value", type: "uint256", indexed: false },
        ],
    },
];
// ─── ERC-8183: Job Escrow & Settlement ────────────────────────────────────────
// Standard source: https://eips.ethereum.org/EIPS/eip-8183
// Deployed on Arc Testnet: 0x0747EEf0706327138c69792bF28Cd525089e4583
//
// Job lifecycle states:
//   0 = Open     → job created, awaiting funding
//   1 = Funded   → USDC deposited into escrow
//   2 = Submitted → provider submitted deliverable hash
//   3 = Completed → evaluator approved, USDC released to provider
//   4 = Rejected  → evaluator rejected, USDC refunded to client
//   5 = Expired   → past expiry timestamp, USDC refunded to client
export const ERC8183_ABI = [
    // ── Write functions ──
    {
        name: "createJob",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "provider", type: "address" },
            { name: "evaluator", type: "address" },
            { name: "expiry", type: "uint256" },
            { name: "description", type: "bytes32" },
            { name: "hook", type: "address" },
        ],
        outputs: [{ name: "jobId", type: "uint256" }],
    },
    {
        // Fund job: send native USDC as msg.value (18-decimal precision)
        name: "fundJob",
        type: "function",
        stateMutability: "payable",
        inputs: [{ name: "jobId", type: "uint256" }],
        outputs: [],
    },
    {
        name: "submitDeliverable",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "jobId", type: "uint256" },
            { name: "deliverable", type: "bytes32" },
        ],
        outputs: [],
    },
    {
        name: "completeJob",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "jobId", type: "uint256" },
            { name: "reason", type: "bytes32" },
        ],
        outputs: [],
    },
    {
        name: "rejectJob",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "jobId", type: "uint256" },
            { name: "reason", type: "bytes32" },
        ],
        outputs: [],
    },
    {
        name: "refundJob",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "jobId", type: "uint256" }],
        outputs: [],
    },
    // ── Read functions ──
    {
        name: "jobs",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "jobId", type: "uint256" }],
        outputs: [
            {
                name: "",
                type: "tuple",
                components: [
                    { name: "id", type: "uint256" },
                    { name: "client", type: "address" },
                    { name: "provider", type: "address" },
                    { name: "evaluator", type: "address" },
                    { name: "expiry", type: "uint256" },
                    { name: "description", type: "bytes32" },
                    { name: "amount", type: "uint256" },
                    { name: "status", type: "uint8" },
                    { name: "deliverable", type: "bytes32" },
                    { name: "hook", type: "address" },
                ],
            },
        ],
    },
    {
        name: "jobCount",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    // ── Events ──
    {
        name: "JobCreated",
        type: "event",
        inputs: [
            { name: "jobId", type: "uint256", indexed: true },
            { name: "client", type: "address", indexed: true },
            { name: "provider", type: "address", indexed: true },
        ],
    },
    {
        name: "JobFunded",
        type: "event",
        inputs: [
            { name: "jobId", type: "uint256", indexed: true },
            { name: "amount", type: "uint256", indexed: false },
        ],
    },
    {
        name: "DeliverableSubmitted",
        type: "event",
        inputs: [
            { name: "jobId", type: "uint256", indexed: true },
            { name: "deliverable", type: "bytes32", indexed: false },
        ],
    },
    {
        name: "JobCompleted",
        type: "event",
        inputs: [
            { name: "jobId", type: "uint256", indexed: true },
            { name: "reason", type: "bytes32", indexed: false },
        ],
    },
    {
        name: "JobRejected",
        type: "event",
        inputs: [
            { name: "jobId", type: "uint256", indexed: true },
            { name: "reason", type: "bytes32", indexed: false },
        ],
    },
];
// ─── ERC-8004: Agent Identity & Reputation ────────────────────────────────────
// Standard source: https://eips.ethereum.org/EIPS/eip-8004
// Reputation Registry: 0x8004B663056A597Dffe9eCcC1965A193B7388713
// Validation Registry: 0x8004Cb1BF31DAf7788923b405b754f57acEB4272
export const ERC8004_REPUTATION_ABI = [
    // ── Write ──
    {
        // giveFeedback — confirmed signature from Arc docs
        // source: https://docs.arc.network/arc/tutorials/register-your-first-ai-agent
        name: "giveFeedback",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "agentId", type: "uint256" },
            { name: "score", type: "int128" }, // -100 to 100
            { name: "feedbackType", type: "uint8" }, // 0 = general
            { name: "tag", type: "string" },
            { name: "strengths", type: "string" },
            { name: "improvements", type: "string" },
            { name: "context", type: "string" },
            { name: "feedbackHash", type: "bytes32" },
        ],
        outputs: [],
    },
    // ── Read ──
    {
        name: "getReputation",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "agentId", type: "uint256" }],
        outputs: [
            { name: "totalScore", type: "int256" },
            { name: "eventCount", type: "uint256" },
        ],
    },
    // ── Events ──
    {
        name: "FeedbackGiven",
        type: "event",
        inputs: [
            { name: "agentId", type: "uint256", indexed: true },
            { name: "validator", type: "address", indexed: true },
            { name: "score", type: "int128", indexed: false },
            { name: "tag", type: "string", indexed: false },
        ],
    },
];
export const ERC8004_VALIDATION_ABI = [
    // ── Write ──
    {
        // validationRequest — confirmed signature from Arc docs
        name: "validationRequest",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "validator", type: "address" },
            { name: "agentId", type: "uint256" },
            { name: "requestURI", type: "string" },
            { name: "requestHash", type: "bytes32" },
        ],
        outputs: [],
    },
    {
        // validationResponse — validator submits response (100=pass, 0=fail)
        name: "validationResponse",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "agentId", type: "uint256" },
            { name: "requestId", type: "uint256" },
            { name: "result", type: "uint8" }, // 100 = passed, 0 = failed
            { name: "responseURI", type: "string" },
            { name: "responseHash", type: "bytes32" },
        ],
        outputs: [],
    },
    // ── Read ──
    {
        name: "getValidation",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "agentId", type: "uint256" },
            { name: "requestId", type: "uint256" },
        ],
        outputs: [
            { name: "validator", type: "address" },
            { name: "result", type: "uint8" },
            { name: "requestURI", type: "string" },
            { name: "responseURI", type: "string" },
        ],
    },
    // ── Events ──
    {
        name: "ValidationRequested",
        type: "event",
        inputs: [
            { name: "agentId", type: "uint256", indexed: true },
            { name: "validator", type: "address", indexed: true },
            { name: "requestId", type: "uint256", indexed: false },
        ],
    },
    {
        name: "ValidationCompleted",
        type: "event",
        inputs: [
            { name: "agentId", type: "uint256", indexed: true },
            { name: "result", type: "uint8", indexed: false },
        ],
    },
];
// Job status enum for human-readable output
export const JOB_STATUS = {
    0: "Open",
    1: "Funded",
    2: "Submitted",
    3: "Completed",
    4: "Rejected",
    5: "Expired",
};
//# sourceMappingURL=abis.js.map