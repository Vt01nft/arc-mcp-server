import { z } from "zod";
export declare const createJobSchema: z.ZodObject<{
    provider: z.ZodString;
    evaluator: z.ZodString;
    description: z.ZodString;
    expiryHours: z.ZodDefault<z.ZodNumber>;
    hook: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    description: string;
    provider: string;
    evaluator: string;
    expiryHours: number;
    hook?: string | undefined;
}, {
    description: string;
    provider: string;
    evaluator: string;
    hook?: string | undefined;
    expiryHours?: number | undefined;
}>;
export declare function arcCreateJob(args: z.infer<typeof createJobSchema>): Promise<{
    success: boolean;
    hash: `0x${string}`;
    explorer: string;
    jobId: string | null;
    job: {
        client: `0x${string}`;
        provider: `0x${string}`;
        evaluator: `0x${string}`;
        description: string;
        expiry: string;
        status: string;
        hook: string;
    };
    next_step: string;
    note: string;
}>;
export declare const getJobSchema: z.ZodObject<{
    jobId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    jobId: number;
}, {
    jobId: number;
}>;
export declare function arcGetJob(args: z.infer<typeof getJobSchema>): Promise<{
    id: string;
    client: `0x${string}`;
    provider: `0x${string}`;
    evaluator: `0x${string}`;
    status: string;
    status_code: number;
    budget: string;
    budget_raw: string;
    description: string;
    expiry: string;
    expired: boolean;
    hook: `0x${string}` | null;
    explorer: string;
}>;
export declare function arcGetJobCount(): Promise<{
    total_jobs: number;
    note: string;
    latest_block: string;
    contract: `0x${string}`;
    explorer: string;
}>;
export declare const setBudgetSchema: z.ZodObject<{
    jobId: z.ZodNumber;
    amount: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amount: string;
    jobId: number;
}, {
    amount: string;
    jobId: number;
}>;
export declare function arcSetBudget(args: z.infer<typeof setBudgetSchema>): Promise<{
    success: boolean;
    hash: `0x${string}`;
    explorer: string;
    jobId: number;
    budget: string;
    note: string;
}>;
export declare const fundJobSchema: z.ZodObject<{
    jobId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    jobId: number;
}, {
    jobId: number;
}>;
export declare function arcFundJob(args: z.infer<typeof fundJobSchema>): Promise<{
    success: boolean;
    hash: `0x${string}`;
    approve_tx: `0x${string}`;
    explorer: string;
    jobId: number;
    amount_escrowed: string;
    status: string;
    next_step: string;
}>;
export declare const submitDeliverableSchema: z.ZodObject<{
    jobId: z.ZodNumber;
    deliverable: z.ZodString;
}, "strip", z.ZodTypeAny, {
    jobId: number;
    deliverable: string;
}, {
    jobId: number;
    deliverable: string;
}>;
export declare function arcSubmitDeliverable(args: z.infer<typeof submitDeliverableSchema>): Promise<{
    success: boolean;
    hash: `0x${string}`;
    explorer: string;
    jobId: number;
    deliverable_original: string;
    deliverable_hash: `0x${string}`;
    status: string;
    next_step: string;
}>;
export declare const completeJobSchema: z.ZodObject<{
    jobId: z.ZodNumber;
    reason: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    jobId: number;
    reason: string;
}, {
    jobId: number;
    reason?: string | undefined;
}>;
export declare function arcCompleteJob(args: z.infer<typeof completeJobSchema>): Promise<{
    success: boolean;
    hash: `0x${string}`;
    explorer: string;
    jobId: number;
    reason: string;
    reason_hash: `0x${string}`;
    status: string;
    note: string;
}>;
export declare const rejectJobSchema: z.ZodObject<{
    jobId: z.ZodNumber;
    reason: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    jobId: number;
    reason: string;
}, {
    jobId: number;
    reason?: string | undefined;
}>;
export declare function arcRejectJob(args: z.infer<typeof rejectJobSchema>): Promise<{
    success: boolean;
    hash: `0x${string}`;
    explorer: string;
    jobId: number;
    reason: string;
    reason_hash: `0x${string}`;
    status: string;
    note: string;
}>;
export declare const refundJobSchema: z.ZodObject<{
    jobId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    jobId: number;
}, {
    jobId: number;
}>;
export declare function arcRefundJob(args: z.infer<typeof refundJobSchema>): Promise<{
    success: boolean;
    hash: `0x${string}`;
    explorer: string;
    jobId: number;
    status: string;
    note: string;
}>;
//# sourceMappingURL=jobs.d.ts.map