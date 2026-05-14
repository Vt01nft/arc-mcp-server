import { z } from "zod";
import { isAddress, keccak256, toHex } from "viem";
import {
  getPublicClient,
  getWalletClient,
  txLink,
} from "../arc-client.js";
import { ADDRESSES } from "../contracts/addresses.js";
import {
  ERC8004_REPUTATION_ABI,
  ERC8004_VALIDATION_ABI,
} from "../contracts/abis.js";

// ── arc_give_reputation ────────────────────────────────────────────────────────
// Record reputation for an agent (validator wallet only — not the agent's own owner)
export const giveReputationSchema = z.object({
  agentId: z.number().describe("ERC-8004 agent ID to give feedback to"),
  score: z
    .number()
    .min(-100)
    .max(100)
    .describe("Score from -100 (terrible) to 100 (excellent). 95 = great."),
  tag: z
    .string()
    .describe('Short tag for the feedback, e.g. "successful_trade", "on_time_delivery"'),
  strengths: z.string().optional().default("").describe("What the agent did well"),
  improvements: z.string().optional().default("").describe("Areas to improve"),
  context: z.string().optional().default("").describe("Additional context"),
  feedbackType: z
    .number()
    .optional()
    .default(0)
    .describe("Feedback type: 0 = general"),
});

export async function arcGiveReputation(
  args: z.infer<typeof giveReputationSchema>
) {
  const client = getPublicClient();
  const { client: walletClient, account } = getWalletClient();

  const feedbackHash = keccak256(toHex(args.tag));

  const hash = await walletClient.writeContract({
    address: ADDRESSES.ERC8004_REPUTATION,
    abi: ERC8004_REPUTATION_ABI,
    functionName: "giveFeedback",
    args: [
      BigInt(args.agentId),
      BigInt(args.score),
      args.feedbackType,
      args.tag,
      args.strengths,
      args.improvements,
      args.context,
      feedbackHash,
    ],
    account,
    chain: walletClient.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });

  return {
    success: receipt.status === "success",
    hash,
    explorer: txLink(hash),
    agentId: args.agentId,
    score: args.score,
    tag: args.tag,
    feedback_hash: feedbackHash,
    note: "Per ERC-8004: agent owners cannot give reputation to their own agents. Use a different validator wallet.",
  };
}

// ── arc_get_reputation ─────────────────────────────────────────────────────────
export const getReputationSchema = z.object({
  agentId: z.number().describe("ERC-8004 agent ID"),
});

export async function arcGetReputation(
  args: z.infer<typeof getReputationSchema>
) {
  const client = getPublicClient();

  const result = await client.readContract({
    address: ADDRESSES.ERC8004_REPUTATION,
    abi: ERC8004_REPUTATION_ABI,
    functionName: "getReputation",
    args: [BigInt(args.agentId)],
  });

  const [totalScore, eventCount] = result;
  const avgScore =
    eventCount > 0n ? Number(totalScore) / Number(eventCount) : null;

  return {
    agentId: args.agentId,
    totalScore: totalScore.toString(),
    eventCount: eventCount.toString(),
    averageScore: avgScore !== null ? avgScore.toFixed(2) : "no feedback yet",
    reputationRegistry: ADDRESSES.ERC8004_REPUTATION,
  };
}

// ── arc_request_validation ─────────────────────────────────────────────────────
export const requestValidationSchema = z.object({
  agentId: z.number().describe("ERC-8004 agent ID requesting validation"),
  validator: z.string().describe("Address of the validator"),
  requestURI: z
    .string()
    .describe(
      'URI pointing to validation request data, e.g. "ipfs://bafkrei..." or "https://..."'
    ),
});

export async function arcRequestValidation(
  args: z.infer<typeof requestValidationSchema>
) {
  const client = getPublicClient();
  const { client: walletClient, account } = getWalletClient();

  if (!isAddress(args.validator)) {
    throw new Error(`Invalid validator address: ${args.validator}`);
  }

  const requestHash = keccak256(
    toHex(`validation_request_agent_${args.agentId}_${Date.now()}`)
  );

  const hash = await walletClient.writeContract({
    address: ADDRESSES.ERC8004_VALIDATION,
    abi: ERC8004_VALIDATION_ABI,
    functionName: "validationRequest",
    args: [args.validator, BigInt(args.agentId), args.requestURI, requestHash],
    account,
    chain: walletClient.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });

  return {
    success: receipt.status === "success",
    hash,
    explorer: txLink(hash),
    agentId: args.agentId,
    validator: args.validator,
    requestURI: args.requestURI,
    requestHash,
    next_step:
      "The validator must now call arc_respond_validation with their decision (100=pass, 0=fail).",
  };
}

// ── arc_respond_validation ─────────────────────────────────────────────────────
export const respondValidationSchema = z.object({
  agentId: z.number().describe("ERC-8004 agent ID"),
  requestId: z.number().describe("Validation request ID"),
  passed: z.boolean().describe("true = passed (100), false = failed (0)"),
  responseURI: z
    .string()
    .optional()
    .default("")
    .describe("URI pointing to validation response/evidence"),
});

export async function arcRespondValidation(
  args: z.infer<typeof respondValidationSchema>
) {
  const client = getPublicClient();
  const { client: walletClient, account } = getWalletClient();

  const result = args.passed ? 100 : 0;
  const responseHash = keccak256(
    toHex(`validation_response_${args.agentId}_${args.requestId}_${result}`)
  );

  const hash = await walletClient.writeContract({
    address: ADDRESSES.ERC8004_VALIDATION,
    abi: ERC8004_VALIDATION_ABI,
    functionName: "validationResponse",
    args: [
      BigInt(args.agentId),
      BigInt(args.requestId),
      result,
      args.responseURI,
      responseHash,
    ],
    account,
    chain: walletClient.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });

  return {
    success: receipt.status === "success",
    hash,
    explorer: txLink(hash),
    agentId: args.agentId,
    requestId: args.requestId,
    result: args.passed ? "PASSED (100)" : "FAILED (0)",
    responseHash,
  };
}

// ── arc_get_validation ─────────────────────────────────────────────────────────
export const getValidationSchema = z.object({
  agentId: z.number().describe("ERC-8004 agent ID"),
  requestId: z.number().describe("Validation request ID"),
});

export async function arcGetValidation(
  args: z.infer<typeof getValidationSchema>
) {
  const client = getPublicClient();

  const result = await client.readContract({
    address: ADDRESSES.ERC8004_VALIDATION,
    abi: ERC8004_VALIDATION_ABI,
    functionName: "getValidation",
    args: [BigInt(args.agentId), BigInt(args.requestId)],
  });

  const [validator, validationResult, requestURI, responseURI] = result;

  return {
    agentId: args.agentId,
    requestId: args.requestId,
    validator,
    result: validationResult === 100 ? "PASSED" : validationResult === 0 ? "FAILED" : "PENDING",
    resultCode: validationResult,
    requestURI,
    responseURI,
    validationRegistry: ADDRESSES.ERC8004_VALIDATION,
  };
}
