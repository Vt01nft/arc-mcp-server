// Protocol fee. The deployed ERC-8183 AgenticCommerce contract releases the
// full budget to the provider on complete() and we don't own it, so we can't
// deduct a fee inside settlement. For AGENT jobs the provider is one of our
// own agent wallets, so after the escrow releases we skim a configurable fee
// from the agent's payout to the treasury. Economically identical to a
// settle-time fee (the agent nets budget - fee); it just happens one tx later.
//
// Config:
//   PROTOCOL_FEE_BPS  basis points, default 0 (testnet => no-op, loop unchanged)
//   TREASURY_ADDRESS  recipient; required for any non-zero fee
//
// Flip for mainnet by setting PROTOCOL_FEE_BPS=250 (2.5%) + TREASURY_ADDRESS.
import { getSignerFromEnv, publicClient, parseUsdc } from "./viem";
import { ADDRESSES } from "@/contracts/addresses";
import { USDC_ABI } from "@/contracts/abis";

export function protocolFeeBps(): number {
  const raw = parseInt(process.env.PROTOCOL_FEE_BPS ?? "0", 10);
  if (!Number.isFinite(raw) || raw < 0) return 0;
  return Math.min(raw, 1000); // hard cap 10% so a bad env can never over-skim
}

export function treasuryAddress(): `0x${string}` | null {
  const a = process.env.TREASURY_ADDRESS;
  return a && /^0x[0-9a-fA-F]{40}$/.test(a) ? (a as `0x${string}`) : null;
}

// Compute the fee in 6-decimal USDC from a human budget string (e.g. "0.5").
export function feeFromBudget(budgetUsdc: string, bps = protocolFeeBps()): bigint {
  if (bps <= 0) return 0n;
  const budget6 = parseUsdc(budgetUsdc, 6);
  return (budget6 * BigInt(bps)) / 10000n;
}

// Skim the fee from an agent wallet to the treasury. Best-effort: a failure
// here never affects the settlement that already paid the agent.
export async function takeProtocolFee(opts: {
  agentPkEnv: string;
  budgetUsdc: string;
}): Promise<{ tx: `0x${string}` | null; feeUsdc: string; skipped?: string }> {
  const bps = protocolFeeBps();
  if (bps <= 0) return { tx: null, feeUsdc: "0", skipped: "fee disabled (0 bps)" };
  const treasury = treasuryAddress();
  if (!treasury) return { tx: null, feeUsdc: "0", skipped: "TREASURY_ADDRESS not set" };

  const fee6 = feeFromBudget(opts.budgetUsdc, bps);
  if (fee6 <= 0n) return { tx: null, feeUsdc: "0", skipped: "fee rounds to zero" };

  try {
    const wallet = getSignerFromEnv(opts.agentPkEnv);
    const tx = await wallet.writeContract({
      address: ADDRESSES.USDC,
      abi: USDC_ABI,
      functionName: "transfer",
      args: [treasury, fee6],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
    return { tx, feeUsdc: (Number(fee6) / 1e6).toString() };
  } catch (e) {
    return { tx: null, feeUsdc: "0", skipped: e instanceof Error ? e.message : String(e) };
  }
}
