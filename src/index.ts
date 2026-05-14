#!/usr/bin/env node
/**
 * Arc Live MCP Server
 * -----------------------------------------------------------------
 * Gives Claude Code (and any MCP client) direct live access to the
 * Arc Testnet - balances, ERC-8183 job lifecycle, ERC-8004 agent
 * reputation, events, and USDC transfers.
 *
 * Transport: stdio (default) - works with Claude Code out of the box
 *
 * Setup:
 *   npm install && npm run build
 *   claude mcp add arc-live node /path/to/dist/index.js
 *
 * Write operations require PRIVATE_KEY in environment:
 *   export PRIVATE_KEY=0x...
 *
 * Chain: Arc Testnet | Chain ID: 5042002
 * RPC:   https://rpc.testnet.arc.network
 * Docs:  https://docs.arc.network
 * -----------------------------------------------------------------
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z, ZodError } from "zod";

// Tool implementations
import {
  arcGetBalance,
  getBalanceSchema,
  arcGetBlock,
  getBlockSchema,
  arcGetTransaction,
  getTransactionSchema,
  arcGetGasPrice,
} from "./tools/balance.js";

import {
  arcSendUsdc,
  sendUsdcSchema,
  arcApproveUsdc,
  approveUsdcSchema,
} from "./tools/transfers.js";

import {
  arcCreateJob,
  createJobSchema,
  arcGetJob,
  getJobSchema,
  arcGetJobCount,
  arcFundJob,
  fundJobSchema,
  arcSubmitDeliverable,
  submitDeliverableSchema,
  arcCompleteJob,
  completeJobSchema,
  arcRejectJob,
  rejectJobSchema,
  arcRefundJob,
  refundJobSchema,
} from "./tools/jobs.js";

import {
  arcGiveReputation,
  giveReputationSchema,
  arcGetReputation,
  getReputationSchema,
  arcRequestValidation,
  requestValidationSchema,
  arcRespondValidation,
  respondValidationSchema,
  arcGetValidation,
  getValidationSchema,
} from "./tools/agents.js";

import {
  arcGetEvents,
  getEventsSchema,
  arcGetJobEvents,
  getJobEventsSchema,
} from "./tools/events.js";

// ── Tool registry ─────────────────────────────────────────────────────────────
const TOOLS = [
  // ── Chain / Balance ──────────────────────────────────────────────────────
  {
    name: "arc_get_balance",
    description:
      "Get USDC balance for any Arc Testnet address. Returns both the ERC-20 transfer balance (6 decimals) and the native gas balance (18 decimals).",
    inputSchema: toJsonSchema(getBalanceSchema),
  },
  {
    name: "arc_get_block",
    description:
      "Get Arc Testnet block info. Omit blockNumber for the latest block. Returns number, hash, timestamp, tx count, gas used.",
    inputSchema: toJsonSchema(getBlockSchema),
  },
  {
    name: "arc_get_transaction",
    description:
      "Get Arc Testnet transaction details by hash. Returns status, from/to, value, gas used, block number.",
    inputSchema: toJsonSchema(getTransactionSchema),
  },
  {
    name: "arc_get_gas_price",
    description:
      "Get the current USDC gas price on Arc Testnet. Minimum is 20 Gwei on testnet. Returns current price and recommended max fee.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },

  // ── USDC Transfers ───────────────────────────────────────────────────────
  {
    name: "arc_send_usdc",
    description:
      "Send USDC to another address on Arc Testnet. Requires PRIVATE_KEY env var. Set simulate=true to estimate gas without broadcasting.",
    inputSchema: toJsonSchema(sendUsdcSchema),
  },
  {
    name: "arc_approve_usdc",
    description:
      "Approve a contract (like ERC-8183) to spend USDC. Required before funding jobs. Use amount='unlimited' for max approval.",
    inputSchema: toJsonSchema(approveUsdcSchema),
  },

  // ── ERC-8183 Jobs ────────────────────────────────────────────────────────
  {
    name: "arc_get_job_count",
    description:
      "Get total number of ERC-8183 jobs created on Arc Testnet. Useful for monitoring ecosystem activity.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "arc_get_job",
    description:
      "Get ERC-8183 job details by ID. Returns client, provider, evaluator, status (Open/Funded/Submitted/Completed/Rejected/Expired), USDC amount, description hash, deliverable hash, and expiry.",
    inputSchema: toJsonSchema(getJobSchema),
  },
  {
    name: "arc_create_job",
    description:
      "Create a new ERC-8183 job on Arc Testnet. Defines provider, evaluator, description, and expiry. Does NOT lock USDC yet - call arc_fund_job next. Requires PRIVATE_KEY.",
    inputSchema: toJsonSchema(createJobSchema),
  },
  {
    name: "arc_fund_job",
    description:
      "Fund an ERC-8183 job with USDC. USDC is locked in escrow until the evaluator completes or rejects the job. Requires PRIVATE_KEY. Job must be in Open state.",
    inputSchema: toJsonSchema(fundJobSchema),
  },
  {
    name: "arc_submit_deliverable",
    description:
      "Provider submits deliverable for an ERC-8183 job. Pass the work content or IPFS URI - it will be hashed to bytes32 onchain. Requires PRIVATE_KEY.",
    inputSchema: toJsonSchema(submitDeliverableSchema),
  },
  {
    name: "arc_complete_job",
    description:
      "Evaluator approves deliverable and releases USDC to provider. Finalizes the ERC-8183 job. Requires PRIVATE_KEY (evaluator wallet).",
    inputSchema: toJsonSchema(completeJobSchema),
  },
  {
    name: "arc_reject_job",
    description:
      "Evaluator rejects deliverable and refunds USDC to client. Requires PRIVATE_KEY (evaluator wallet). Provide a reason.",
    inputSchema: toJsonSchema(rejectJobSchema),
  },
  {
    name: "arc_refund_job",
    description:
      "Trigger a refund for an expired ERC-8183 job. USDC returns to client. Job must be past its expiry timestamp. Requires PRIVATE_KEY.",
    inputSchema: toJsonSchema(refundJobSchema),
  },

  // ── ERC-8004 Agents ──────────────────────────────────────────────────────
  {
    name: "arc_give_reputation",
    description:
      "Record reputation feedback for an ERC-8004 agent. Score: -100 to 100. Cannot be called by the agent's own owner. Requires PRIVATE_KEY (validator wallet).",
    inputSchema: toJsonSchema(giveReputationSchema),
  },
  {
    name: "arc_get_reputation",
    description:
      "Get ERC-8004 reputation score for an agent. Returns total score, event count, and average score.",
    inputSchema: toJsonSchema(getReputationSchema),
  },
  {
    name: "arc_request_validation",
    description:
      "Request ERC-8004 validation for an agent from a specific validator. Pass a URI pointing to KYC/credential data. Requires PRIVATE_KEY (agent owner wallet).",
    inputSchema: toJsonSchema(requestValidationSchema),
  },
  {
    name: "arc_respond_validation",
    description:
      "Validator responds to an ERC-8004 validation request. passed=true records result 100 (passed), false records 0 (failed). Requires PRIVATE_KEY (validator wallet).",
    inputSchema: toJsonSchema(respondValidationSchema),
  },
  {
    name: "arc_get_validation",
    description:
      "Get ERC-8004 validation result for an agent. Returns validator, result (PASSED/FAILED/PENDING), and URIs.",
    inputSchema: toJsonSchema(getValidationSchema),
  },

  // ── Events ───────────────────────────────────────────────────────────────
  {
    name: "arc_get_events",
    description:
      "Fetch raw contract events from Arc Testnet. Choose contract: 'jobs' (ERC-8183), 'reputation' (ERC-8004), or 'usdc'. Scans last 1000 blocks by default.",
    inputSchema: toJsonSchema(getEventsSchema),
  },
  {
    name: "arc_get_job_events",
    description:
      "Get the full event timeline for a specific ERC-8183 job - creation, funding, submission, completion/rejection in chronological order.",
    inputSchema: toJsonSchema(getJobEventsSchema),
  },
];

// ── Handler map ───────────────────────────────────────────────────────────────
async function callTool(name: string, args: unknown): Promise<unknown> {
  switch (name) {
    // Chain / balance
    case "arc_get_balance":      return arcGetBalance(getBalanceSchema.parse(args));
    case "arc_get_block":        return arcGetBlock(getBlockSchema.parse(args));
    case "arc_get_transaction":  return arcGetTransaction(getTransactionSchema.parse(args));
    case "arc_get_gas_price":    return arcGetGasPrice();

    // Transfers
    case "arc_send_usdc":        return arcSendUsdc(sendUsdcSchema.parse(args));
    case "arc_approve_usdc":     return arcApproveUsdc(approveUsdcSchema.parse(args));

    // ERC-8183 Jobs
    case "arc_get_job_count":    return arcGetJobCount();
    case "arc_get_job":          return arcGetJob(getJobSchema.parse(args));
    case "arc_create_job":       return arcCreateJob(createJobSchema.parse(args));
    case "arc_fund_job":         return arcFundJob(fundJobSchema.parse(args));
    case "arc_submit_deliverable": return arcSubmitDeliverable(submitDeliverableSchema.parse(args));
    case "arc_complete_job":     return arcCompleteJob(completeJobSchema.parse(args));
    case "arc_reject_job":       return arcRejectJob(rejectJobSchema.parse(args));
    case "arc_refund_job":       return arcRefundJob(refundJobSchema.parse(args));

    // ERC-8004 Agents
    case "arc_give_reputation":  return arcGiveReputation(giveReputationSchema.parse(args));
    case "arc_get_reputation":   return arcGetReputation(getReputationSchema.parse(args));
    case "arc_request_validation": return arcRequestValidation(requestValidationSchema.parse(args));
    case "arc_respond_validation": return arcRespondValidation(respondValidationSchema.parse(args));
    case "arc_get_validation":   return arcGetValidation(getValidationSchema.parse(args));

    // Events
    case "arc_get_events":       return arcGetEvents(getEventsSchema.parse(args));
    case "arc_get_job_events":   return arcGetJobEvents(getJobEventsSchema.parse(args));

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── Zod → JSON Schema helper (lightweight, no extra deps) ────────────────────
function toJsonSchema(schema: z.ZodObject<any>): Record<string, unknown> {
  const shape = schema.shape;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, field] of Object.entries(shape)) {
    const f = field as z.ZodTypeAny;
    const def = f._def;
    const isOptional =
      f instanceof z.ZodOptional ||
      f instanceof z.ZodDefault ||
      (def.typeName === "ZodOptional") ||
      (def.typeName === "ZodDefault");

    const description = def.description ?? "";
    let type = "string";

    const inner = f instanceof z.ZodOptional || f instanceof z.ZodDefault
      ? (f as any)._def.innerType ?? (f as any)._def.schema
      : f;

    if (inner instanceof z.ZodNumber) type = "number";
    else if (inner instanceof z.ZodBoolean) type = "boolean";
    else if (inner instanceof z.ZodEnum) {
      properties[key] = {
        type: "string",
        enum: inner._def.values,
        description,
      };
      if (!isOptional) required.push(key);
      continue;
    }

    const prop: Record<string, unknown> = { type, description };

    if (inner instanceof z.ZodNumber) {
      const checks = inner._def.checks as Array<{ kind: string; value: number }>;
      for (const c of checks) {
        if (c.kind === "min") prop.minimum = c.value;
        if (c.kind === "max") prop.maximum = c.value;
      }
    }

    if (def.typeName === "ZodDefault") {
      prop.default = def.defaultValue();
    }

    properties[key] = prop;
    if (!isOptional) required.push(key);
  }

  return { type: "object", properties, required };
}

// ── Start server ──────────────────────────────────────────────────────────────
const server = new Server(
  {
    name: "arc-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: { tools: {} },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await callTool(name, args ?? {});
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    const message =
      err instanceof ZodError
        ? `Validation error: ${err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
        : err instanceof Error
        ? err.message
        : String(err);

    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

// Suppress unhandled promise rejections from network timeouts
process.on("unhandledRejection", (reason) => {
  if (
    reason instanceof Error &&
    (reason.message.includes("timeout") || reason.message.includes("ECONNRESET"))
  ) {
    return; // ignore transient network errors
  }
  process.stderr.write(`Unhandled rejection: ${reason}\n`);
});
