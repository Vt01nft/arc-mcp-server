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
] as const;

// ─── ERC-8183: Job Escrow & Settlement (AgenticCommerce) ──────────────────────
// VERIFIED from the deployed contract on Arc Testnet.
//   Proxy: 0x0747EEf0706327138c69792bF28Cd525089e4583 (EIP-1967)
//   Impl:  0xa316fd02827242d537f84730f8a37d0ba5fd351a (verified on arcscan)
// ABI matches the on-chain implementation exactly. Do NOT guess these.
//
// JobStatus enum (verified from source):
//   0 = Open · 1 = Funded · 2 = Submitted · 3 = Completed
//   4 = Rejected · 5 = Expired
export const ERC8183_ABI = [
  // ── Write functions ──
  {
    name: "createJob",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "provider", type: "address" },
      { name: "evaluator", type: "address" },
      { name: "expiredAt", type: "uint256" },
      { name: "description", type: "string" },
      { name: "hook", type: "address" },
    ],
    outputs: [{ name: "jobId", type: "uint256" }],
  },
  {
    name: "setBudget",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "fund",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "submit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "deliverable", type: "bytes32" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "complete",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "reason", type: "bytes32" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "reject",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "reason", type: "bytes32" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "claimRefund",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  // ── Read functions ──
  {
    name: "getJob",
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
          { name: "description", type: "string" },
          { name: "budget", type: "uint256" },
          { name: "expiredAt", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "hook", type: "address" },
        ],
      },
    ],
  },
  {
    name: "jobCounter",
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
      { name: "evaluator", type: "address", indexed: false },
      { name: "expiredAt", type: "uint256", indexed: false },
      { name: "hook", type: "address", indexed: false },
    ],
  },
  {
    name: "JobFunded",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    name: "JobSubmitted",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "provider", type: "address", indexed: true },
      { name: "deliverable", type: "bytes32", indexed: false },
    ],
  },
  {
    name: "JobCompleted",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "evaluator", type: "address", indexed: true },
      { name: "reason", type: "bytes32", indexed: false },
    ],
  },
  {
    name: "JobRejected",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "rejector", type: "address", indexed: true },
      { name: "reason", type: "bytes32", indexed: false },
    ],
  },
  {
    name: "Refunded",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

// ─── ERC-8004: Agent Identity & Reputation ────────────────────────────────────
// Standard source: https://eips.ethereum.org/EIPS/eip-8004
// Reputation Registry: 0x8004B663056A597Dffe9eCcC1965A193B7388713
// Validation Registry: 0x8004Cb1BF31DAf7788923b405b754f57acEB4272
export const ERC8004_REPUTATION_ABI = [
  // ── Write ──
  {
    // giveFeedback - field names VERIFIED against the deployed impl ABI on
    // arcscan (reputation impl 0x16e0fa7f...). Positional types match the
    // older guessed names so the selector is unchanged; names corrected here
    // for honest semantics. `value`/`valueDecimals` carry the score (e.g.
    // value=100, valueDecimals=0 => integer score 100). Open-caller.
    name: "giveFeedback",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "value", type: "int128" },         // score, scaled by valueDecimals
      { name: "valueDecimals", type: "uint8" },  // 0 => value is an integer score
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
      { name: "endpoint", type: "string" },
      { name: "feedbackURI", type: "string" },
      { name: "feedbackHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    // readAllFeedback - VERIFIED from impl ABI. Used to confirm feedback
    // landed on-chain after giveFeedback.
    name: "readAllFeedback",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "clientAddresses", type: "address[]" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
      { name: "includeRevoked", type: "bool" },
    ],
    outputs: [
      { name: "clients", type: "address[]" },
      { name: "feedbackIndexes", type: "uint64[]" },
      { name: "values", type: "int128[]" },
      { name: "valueDecimals", type: "uint8[]" },
      { name: "tag1s", type: "string[]" },
      { name: "tag2s", type: "string[]" },
      { name: "revokedStatuses", type: "bool[]" },
    ],
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
] as const;

// ─── ERC-8004: Agent Identity Registry ────────────────────────────────────────
// ERC-721-style identity. register() mints an agentId owned by msg.sender.
// VERIFIED from the deployed impl ABI on arcscan (impl 0x7274e874...).
// Identity registry proxy: 0x8004A818BFB912233c491871b3d84c89A494BD9e
export const ERC8004_IDENTITY_ABI = [
  // ── Write ──
  {
    // register the caller as a new agent, returns the new agentId.
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    name: "setAgentURI",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "agentURI", type: "string" },
    ],
    outputs: [],
  },
  // ── Read ──
  {
    name: "getAgentWallet",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  // ── Events ──
  {
    name: "Registered",
    type: "event",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
  },
] as const;

export const ERC8004_VALIDATION_ABI = [
  // ── Write ──
  {
    // validationRequest - confirmed signature from Arc docs
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
    // validationResponse - validator submits response (100=pass, 0=fail)
    name: "validationResponse",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "requestId", type: "uint256" },
      { name: "result", type: "uint8" },       // 100 = passed, 0 = failed
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
] as const;

// ─── v2 Sprint 2: EvaluatorRegistry ───────────────────────────────────────────
// Source: multi-evaluator/src/EvaluatorRegistry.sol (deployed by the server wallet).
// Stake is native USDC (18 decimals). MIN_STAKE = 10 USDC.
export const EVALUATOR_REGISTRY_ABI = [
  // ── Write ──
  {
    // Stake >= MIN_STAKE native USDC (sent as msg.value) to join the jury pool.
    name: "register",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    name: "deregister",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  // ── Read ──
  {
    name: "activeCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "count", type: "uint256" }],
  },
  {
    name: "evaluatorList",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "evaluators",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "stake", type: "uint256" },
      { name: "totalVotes", type: "uint256" },
      { name: "correctVotes", type: "uint256" },
      { name: "active", type: "bool" },
    ],
  },
  {
    name: "getStake",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "evaluator", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getAccuracy",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "evaluator", type: "address" }],
    outputs: [
      { name: "numerator", type: "uint256" },
      { name: "denominator", type: "uint256" },
    ],
  },
  {
    name: "isActive",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "evaluator", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "lockedUntil",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "MIN_STAKE",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  // ── Events ──
  {
    name: "Registered",
    type: "event",
    inputs: [
      { name: "evaluator", type: "address", indexed: true },
      { name: "stake", type: "uint256", indexed: false },
    ],
  },
] as const;

// ─── v2 Sprint 2: MultiEvaluatorHook ───────────────────────────────────────────
// Source: multi-evaluator/src/MultiEvaluatorHook.sol. 3-juror, 2-of-3 jury.
// onDeliverableSubmitted is authorizedCaller-only (the server wallet seats juries).
export const MULTI_EVALUATOR_HOOK_ABI = [
  // ── Write ──
  {
    // authorizedCaller only. Seats a 3-juror jury for the job. amount is the
    // job's escrowed value in native USDC (18 decimals) for fee math.
    name: "onDeliverableSubmitted",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    // Called by an assigned juror with their own wallet.
    name: "castVote",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "approve", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "forceResolve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  // ── Read ──
  {
    name: "getJury",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      { name: "members", type: "address[3]" },
      { name: "votes", type: "uint8[3]" }, // 0=Pending 1=Approve 2=Reject
      { name: "deadline", type: "uint256" },
      { name: "resolved", type: "bool" },
      { name: "approves", type: "uint8" },
      { name: "rejects", type: "uint8" },
    ],
  },
  {
    name: "getVoteStatus",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      { name: "approves", type: "uint8" },
      { name: "rejects", type: "uint8" },
      { name: "pending", type: "uint8" },
      { name: "canResolve", type: "bool" },
    ],
  },
  {
    name: "authorizedCaller",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  // ── Events ──
  {
    name: "JuryAssigned",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "jurors", type: "address[3]", indexed: false },
      { name: "deadline", type: "uint256", indexed: false },
    ],
  },
  {
    name: "VoteCast",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "juror", type: "address", indexed: true },
      { name: "vote", type: "uint8", indexed: false },
      { name: "approves", type: "uint8", indexed: false },
      { name: "rejects", type: "uint8", indexed: false },
    ],
  },
  {
    name: "JuryResolved",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "approved", type: "bool", indexed: false },
      { name: "approves", type: "uint8", indexed: false },
      { name: "rejects", type: "uint8", indexed: false },
    ],
  },
] as const;

// Jury vote enum (MultiEvaluatorHook.Vote)
export const JURY_VOTE: Record<number, string> = {
  0: "Pending",
  1: "Approve",
  2: "Reject",
};

// Job status enum for human-readable output
export const JOB_STATUS: Record<number, string> = {
  0: "Open",
  1: "Funded",
  2: "Submitted",
  3: "Completed",
  4: "Rejected",
  5: "Expired",
};
