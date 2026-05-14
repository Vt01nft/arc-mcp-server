import { z } from "zod";
export declare const getEventsSchema: z.ZodObject<{
    contract: z.ZodEnum<["jobs", "reputation", "usdc"]>;
    event: z.ZodOptional<z.ZodString>;
    fromBlock: z.ZodOptional<z.ZodNumber>;
    toBlock: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    contract: "jobs" | "reputation" | "usdc";
    limit: number;
    event?: string | undefined;
    fromBlock?: number | undefined;
    toBlock?: number | undefined;
}, {
    contract: "jobs" | "reputation" | "usdc";
    event?: string | undefined;
    fromBlock?: number | undefined;
    toBlock?: number | undefined;
    limit?: number | undefined;
}>;
export declare function arcGetEvents(args: z.infer<typeof getEventsSchema>): Promise<{
    contract: "jobs" | "reputation" | "usdc";
    address: `0x${string}`;
    range: {
        from: string;
        to: string;
        latest: string;
    };
    total: number;
    returned: number;
    events: {
        blockNumber: string;
        transactionHash: `0x${string}`;
        logIndex: number;
        topics: [] | [`0x${string}`, ...`0x${string}`[]];
        data: `0x${string}`;
        explorer: string | null;
    }[];
    note: string;
}>;
export declare const getJobEventsSchema: z.ZodObject<{
    jobId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    jobId: number;
}, {
    jobId: number;
}>;
export declare function arcGetJobEvents(args: z.infer<typeof getJobEventsSchema>): Promise<{
    jobId: number;
    timeline: {
        event: string;
        block: string;
        tx: `0x${string}`;
    }[];
    totalEvents: number;
}>;
//# sourceMappingURL=events.d.ts.map