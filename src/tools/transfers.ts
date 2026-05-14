import { z } from "zod";
import { isAddress } from "viem";
import {
  getPublicClient,
  getWalletClient,
  formatUsdc,
  parseUsdc,
  txLink,
} from "../arc-client.js";
import { ADDRESSES, USDC_DECIMALS } from "../contracts/addresses.js";
import { USDC_ABI } from "../contracts/abis.js";

// ── arc_send_usdc ──────────────────────────────────────────────────────────────
// Requires PRIVATE_KEY in environment
export const sendUsdcSchema = z.object({
  to: z.string().describe("Recipient Arc address (0x...)"),
  amount: z
    .string()
    .describe('Amount of USDC to send as a string, e.g. "10.5" or "100"'),
  simulate: z
    .boolean()
    .optional()
    .default(false)
    .describe("If true, simulate only - estimate gas without broadcasting"),
});

export async function arcSendUsdc(args: z.infer<typeof sendUsdcSchema>) {
  const client = getPublicClient();

  if (!isAddress(args.to)) {
    throw new Error(`Invalid recipient address: ${args.to}`);
  }

  const amountRaw = parseUsdc(args.amount, USDC_DECIMALS);

  if (amountRaw <= 0n) {
    throw new Error("Amount must be greater than 0");
  }

  // Estimate gas first (always)
  const gasEstimate = await client.estimateContractGas({
    address: ADDRESSES.USDC,
    abi: USDC_ABI,
    functionName: "transfer",
    args: [args.to, amountRaw],
  }).catch(() => 60_000n); // fallback estimate

  const gasPrice = await client.getGasPrice();
  const estimatedFee = gasEstimate * gasPrice;

  if (args.simulate) {
    return {
      simulated: true,
      to: args.to,
      amount: `${args.amount} USDC`,
      amount_raw: amountRaw.toString(),
      estimated_gas: gasEstimate.toString(),
      estimated_fee: `${formatUsdc(estimatedFee, 18)} USDC`,
      note: "Simulation only. Set simulate=false to broadcast.",
    };
  }

  const { client: walletClient, account } = getWalletClient();

  // Check sender balance before sending
  const balance = await client.readContract({
    address: ADDRESSES.USDC,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });

  if (balance < amountRaw) {
    throw new Error(
      `Insufficient USDC balance. Have: ${formatUsdc(balance, USDC_DECIMALS)}, need: ${args.amount}`
    );
  }

  const hash = await walletClient.writeContract({
    address: ADDRESSES.USDC,
    abi: USDC_ABI,
    functionName: "transfer",
    args: [args.to, amountRaw],
    account,
    chain: walletClient.chain,
  });

  // Wait for confirmation (Arc has sub-second finality)
  const receipt = await client.waitForTransactionReceipt({ hash });

  return {
    success: receipt.status === "success",
    hash,
    explorer: txLink(hash),
    from: account.address,
    to: args.to,
    amount: `${args.amount} USDC`,
    gas_used: receipt.gasUsed.toString(),
    block: receipt.blockNumber.toString(),
  };
}

// ── arc_approve_usdc ───────────────────────────────────────────────────────────
// Approve a contract (like ERC-8183) to spend USDC on behalf of the wallet
export const approveUsdcSchema = z.object({
  spender: z.string().describe("Contract address to approve (0x...)"),
  amount: z
    .string()
    .describe('Max USDC to approve. Use "unlimited" for max approval.'),
});

export async function arcApproveUsdc(args: z.infer<typeof approveUsdcSchema>) {
  const client = getPublicClient();
  const { client: walletClient, account } = getWalletClient();

  if (!isAddress(args.spender)) {
    throw new Error(`Invalid spender address: ${args.spender}`);
  }

  const amount =
    args.amount === "unlimited"
      ? BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
      : parseUsdc(args.amount, USDC_DECIMALS);

  const hash = await walletClient.writeContract({
    address: ADDRESSES.USDC,
    abi: USDC_ABI,
    functionName: "approve",
    args: [args.spender, amount],
    account,
    chain: walletClient.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });

  return {
    success: receipt.status === "success",
    hash,
    explorer: txLink(hash),
    spender: args.spender,
    amount: args.amount === "unlimited" ? "unlimited" : `${args.amount} USDC`,
    note: "This approval lets the spender contract transfer USDC from your wallet. Required before funding ERC-8183 jobs.",
  };
}
