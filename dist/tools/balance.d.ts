import { z } from "zod";
export declare const getBalanceSchema: z.ZodObject<{
    address: z.ZodString;
}, "strip", z.ZodTypeAny, {
    address: string;
}, {
    address: string;
}>;
export declare function arcGetBalance(args: z.infer<typeof getBalanceSchema>): Promise<{
    address: `0x${string}`;
    explorer: string;
    usdc: {
        erc20: string;
        native_gas: string;
        raw_erc20: string;
        raw_native: string;
    };
    note: string;
}>;
export declare const getBlockSchema: z.ZodObject<{
    blockNumber: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    blockNumber?: number | undefined;
}, {
    blockNumber?: number | undefined;
}>;
export declare function arcGetBlock(args: z.infer<typeof getBlockSchema>): Promise<{
    number: string;
    hash: `0x${string}`;
    timestamp: string;
    transactions: number;
    gasUsed: string;
    baseFeePerGas: string | null;
    explorer: string;
}>;
export declare const getTransactionSchema: z.ZodObject<{
    hash: z.ZodString;
}, "strip", z.ZodTypeAny, {
    hash: string;
}, {
    hash: string;
}>;
export declare function arcGetTransaction(args: z.infer<typeof getTransactionSchema>): Promise<{
    hash: `0x${string}`;
    from: `0x${string}`;
    to: `0x${string}` | null;
    value: string;
    gasPrice: string | null;
    nonce: number;
    blockNumber: string;
    status: string;
    gasUsed: string | undefined;
    explorer: string;
}>;
export declare function arcGetGasPrice(): Promise<{
    current: string;
    current_usdc: string;
    minimum_testnet: string;
    recommended: string;
    history: {
        blocks: (string | null)[];
    } | null;
    tracker: string;
    note: string;
}>;
//# sourceMappingURL=balance.d.ts.map