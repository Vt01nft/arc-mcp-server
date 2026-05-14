import { z } from "zod";
export declare const sendUsdcSchema: z.ZodObject<{
    to: z.ZodString;
    amount: z.ZodString;
    simulate: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    to: string;
    simulate: boolean;
    amount: string;
}, {
    to: string;
    amount: string;
    simulate?: boolean | undefined;
}>;
export declare function arcSendUsdc(args: z.infer<typeof sendUsdcSchema>): Promise<{
    simulated: boolean;
    to: `0x${string}`;
    amount: string;
    amount_raw: string;
    estimated_gas: string;
    estimated_fee: string;
    note: string;
    success?: undefined;
    hash?: undefined;
    explorer?: undefined;
    from?: undefined;
    gas_used?: undefined;
    block?: undefined;
} | {
    success: boolean;
    hash: `0x${string}`;
    explorer: string;
    from: `0x${string}`;
    to: `0x${string}`;
    amount: string;
    gas_used: string;
    block: string;
    simulated?: undefined;
    amount_raw?: undefined;
    estimated_gas?: undefined;
    estimated_fee?: undefined;
    note?: undefined;
}>;
export declare const approveUsdcSchema: z.ZodObject<{
    spender: z.ZodString;
    amount: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amount: string;
    spender: string;
}, {
    amount: string;
    spender: string;
}>;
export declare function arcApproveUsdc(args: z.infer<typeof approveUsdcSchema>): Promise<{
    success: boolean;
    hash: `0x${string}`;
    explorer: string;
    spender: `0x${string}`;
    amount: string;
    note: string;
}>;
//# sourceMappingURL=transfers.d.ts.map