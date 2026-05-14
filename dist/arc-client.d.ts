import { type PublicClient, type WalletClient, type Chain, type Account } from "viem";
export declare const arcTestnet: Chain;
export declare function getPublicClient(): PublicClient;
export declare function getWalletClient(): {
    client: WalletClient;
    account: Account;
};
export declare function formatUsdc(amount: bigint, decimals?: number): string;
export declare function parseUsdc(amount: string, decimals?: number): bigint;
export declare function txLink(hash: string): string;
export declare function addressLink(address: string): string;
//# sourceMappingURL=arc-client.d.ts.map