import { createPublicClient, createWalletClient, http, formatUnits, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "./chain";

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(
    process.env.NEXT_PUBLIC_ARC_RPC ?? "https://rpc.testnet.arc.network"
  ),
});

// Server-side wallet client - only used in API routes with PRIVATE_KEY env var
export function getWalletClient() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY is not set");
  const account = privateKeyToAccount(pk as `0x${string}`);
  return createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(
      process.env.NEXT_PUBLIC_ARC_RPC ?? "https://rpc.testnet.arc.network"
    ),
  });
}

// USDC on Arc: 6 decimals for ERC-20 transfers, 18 for native gas
export const formatUsdc = (amount: bigint, decimals = 6) =>
  formatUnits(amount, decimals);

export const parseUsdc = (amount: string, decimals = 6) =>
  parseUnits(amount, decimals);

// Convert 6-decimal ERC-20 USDC to 18-decimal native USDC for msg.value
export const usdcToNative = (amount6: bigint) => amount6 * 10n ** 12n;
