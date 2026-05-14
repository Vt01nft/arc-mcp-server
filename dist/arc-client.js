import { createPublicClient, createWalletClient, http, defineChain, } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC_TESTNET } from "./contracts/addresses.js";
// ── Define Arc Testnet as a viem chain ────────────────────────────────────────
export const arcTestnet = defineChain({
    id: ARC_TESTNET.id,
    name: ARC_TESTNET.name,
    nativeCurrency: ARC_TESTNET.nativeCurrency,
    rpcUrls: {
        default: {
            http: [ARC_TESTNET.rpcUrl],
            webSocket: [ARC_TESTNET.wsUrl],
        },
        public: {
            http: [ARC_TESTNET.rpcUrl],
            webSocket: [ARC_TESTNET.wsUrl],
        },
    },
    blockExplorers: {
        default: {
            name: "ArcScan",
            url: ARC_TESTNET.explorerUrl,
        },
    },
    testnet: true,
});
// ── Public client (read-only, no key required) ────────────────────────────────
let _publicClient = null;
export function getPublicClient() {
    if (!_publicClient) {
        _publicClient = createPublicClient({
            chain: arcTestnet,
            transport: http(ARC_TESTNET.rpcUrl, {
                timeout: 30_000,
                retryCount: 3,
                retryDelay: 1_000,
            }),
        });
    }
    return _publicClient;
}
// ── Wallet client (write ops, requires PRIVATE_KEY env var) ──────────────────
let _walletClient = null;
let _account = null;
export function getWalletClient() {
    if (!process.env.PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY not set in environment. " +
            "Set it in .env to use write operations (send, create job, etc). " +
            "Never commit your private key to source control.");
    }
    if (!_walletClient || !_account) {
        _account = privateKeyToAccount(process.env.PRIVATE_KEY);
        _walletClient = createWalletClient({
            account: _account,
            chain: arcTestnet,
            transport: http(ARC_TESTNET.rpcUrl, { timeout: 30_000 }),
        });
    }
    return { client: _walletClient, account: _account };
}
// ── Helper: format USDC amounts ───────────────────────────────────────────────
export function formatUsdc(amount, decimals = 6) {
    const divisor = BigInt(10 ** decimals);
    const whole = amount / divisor;
    const fraction = amount % divisor;
    const fractionStr = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
    return fractionStr ? `${whole}.${fractionStr}` : `${whole}`;
}
export function parseUsdc(amount, decimals = 6) {
    const [whole, fraction = ""] = amount.split(".");
    const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
    return BigInt(whole) * BigInt(10 ** decimals) + BigInt(paddedFraction);
}
// ── Helper: tx explorer link ──────────────────────────────────────────────────
export function txLink(hash) {
    return `${ARC_TESTNET.explorerUrl}/tx/${hash}`;
}
export function addressLink(address) {
    return `${ARC_TESTNET.explorerUrl}/address/${address}`;
}
//# sourceMappingURL=arc-client.js.map