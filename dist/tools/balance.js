import { z } from "zod";
import { isAddress, formatGwei } from "viem";
import { getPublicClient, formatUsdc, addressLink, txLink } from "../arc-client.js";
import { ADDRESSES, USDC_DECIMALS } from "../contracts/addresses.js";
import { USDC_ABI } from "../contracts/abis.js";
// ── arc_get_balance ────────────────────────────────────────────────────────────
export const getBalanceSchema = z.object({
    address: z.string().describe("Arc wallet address to check (0x...)"),
});
export async function arcGetBalance(args) {
    const client = getPublicClient();
    if (!isAddress(args.address)) {
        throw new Error(`Invalid address: ${args.address}`);
    }
    // Native balance (18 decimals - gas precision)
    const nativeBalance = await client.getBalance({ address: args.address });
    // ERC-20 USDC balance (6 decimals - transfer precision)
    const erc20Balance = await client.readContract({
        address: ADDRESSES.USDC,
        abi: USDC_ABI,
        functionName: "balanceOf",
        args: [args.address],
    });
    return {
        address: args.address,
        explorer: addressLink(args.address),
        usdc: {
            erc20: `${formatUsdc(erc20Balance, USDC_DECIMALS)} USDC`,
            native_gas: `${formatUsdc(nativeBalance, 18)} USDC`,
            raw_erc20: erc20Balance.toString(),
            raw_native: nativeBalance.toString(),
        },
        note: "erc20 is the spendable transfer balance (6 decimals). native_gas is the gas fee balance (18 decimals). They reflect the same underlying USDC.",
    };
}
// ── arc_get_block ──────────────────────────────────────────────────────────────
export const getBlockSchema = z.object({
    blockNumber: z
        .number()
        .optional()
        .describe("Block number to fetch. Omit for latest block."),
});
export async function arcGetBlock(args) {
    const client = getPublicClient();
    const block = await client.getBlock(args.blockNumber !== undefined
        ? { blockNumber: BigInt(args.blockNumber) }
        : { blockTag: "latest" });
    return {
        number: block.number?.toString(),
        hash: block.hash,
        timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
        transactions: block.transactions.length,
        gasUsed: block.gasUsed?.toString(),
        baseFeePerGas: block.baseFeePerGas
            ? `${formatGwei(block.baseFeePerGas)} Gwei`
            : null,
        explorer: `https://testnet.arcscan.app/block/${block.number}`,
    };
}
// ── arc_get_transaction ────────────────────────────────────────────────────────
export const getTransactionSchema = z.object({
    hash: z.string().describe("Transaction hash (0x...)"),
});
export async function arcGetTransaction(args) {
    const client = getPublicClient();
    const [tx, receipt] = await Promise.all([
        client.getTransaction({ hash: args.hash }),
        client
            .getTransactionReceipt({ hash: args.hash })
            .catch(() => null),
    ]);
    return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: `${formatUsdc(tx.value, 18)} USDC`,
        gasPrice: tx.gasPrice ? `${formatGwei(tx.gasPrice)} Gwei` : null,
        nonce: tx.nonce,
        blockNumber: tx.blockNumber?.toString(),
        status: receipt
            ? receipt.status === "success"
                ? "success"
                : "reverted"
            : "pending",
        gasUsed: receipt?.gasUsed?.toString(),
        explorer: txLink(args.hash),
    };
}
// ── arc_get_gas_price ──────────────────────────────────────────────────────────
export async function arcGetGasPrice() {
    const client = getPublicClient();
    const [gasPrice, feeHistory] = await Promise.all([
        client.getGasPrice(),
        client
            .getFeeHistory({
            blockCount: 5,
            rewardPercentiles: [10, 50, 90],
        })
            .catch(() => null),
    ]);
    return {
        current: `${formatGwei(gasPrice)} Gwei`,
        current_usdc: `~${formatUsdc(gasPrice, 18)} USDC per gas unit`,
        minimum_testnet: "20 Gwei",
        recommended: `${formatGwei(gasPrice + 5000000000n)} Gwei`,
        history: feeHistory
            ? {
                blocks: feeHistory.baseFeePerGas?.map((fee) => fee ? `${formatGwei(fee)} Gwei` : null),
            }
            : null,
        tracker: "https://testnet.arcscan.app/gas-tracker",
        note: "Arc uses USDC as the gas token. Minimum testnet base fee is 20 Gwei. Set maxFeePerGas >= 20 Gwei to ensure inclusion.",
    };
}
//# sourceMappingURL=balance.js.map