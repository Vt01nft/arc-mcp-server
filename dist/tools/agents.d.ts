import { z } from "zod";
export declare const giveReputationSchema: z.ZodObject<{
    agentId: z.ZodNumber;
    score: z.ZodNumber;
    tag: z.ZodString;
    strengths: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    improvements: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    context: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    feedbackType: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    agentId: number;
    score: number;
    feedbackType: number;
    tag: string;
    strengths: string;
    improvements: string;
    context: string;
}, {
    agentId: number;
    score: number;
    tag: string;
    feedbackType?: number | undefined;
    strengths?: string | undefined;
    improvements?: string | undefined;
    context?: string | undefined;
}>;
export declare function arcGiveReputation(args: z.infer<typeof giveReputationSchema>): Promise<{
    success: boolean;
    hash: `0x${string}`;
    explorer: string;
    agentId: number;
    score: number;
    tag: string;
    feedback_hash: `0x${string}`;
    note: string;
}>;
export declare const getReputationSchema: z.ZodObject<{
    agentId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    agentId: number;
}, {
    agentId: number;
}>;
export declare function arcGetReputation(args: z.infer<typeof getReputationSchema>): Promise<{
    agentId: number;
    totalScore: string;
    eventCount: string;
    averageScore: string;
    reputationRegistry: `0x${string}`;
}>;
export declare const requestValidationSchema: z.ZodObject<{
    agentId: z.ZodNumber;
    validator: z.ZodString;
    requestURI: z.ZodString;
}, "strip", z.ZodTypeAny, {
    agentId: number;
    validator: string;
    requestURI: string;
}, {
    agentId: number;
    validator: string;
    requestURI: string;
}>;
export declare function arcRequestValidation(args: z.infer<typeof requestValidationSchema>): Promise<{
    success: boolean;
    hash: `0x${string}`;
    explorer: string;
    agentId: number;
    validator: `0x${string}`;
    requestURI: string;
    requestHash: `0x${string}`;
    next_step: string;
}>;
export declare const respondValidationSchema: z.ZodObject<{
    agentId: z.ZodNumber;
    requestId: z.ZodNumber;
    passed: z.ZodBoolean;
    responseURI: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    agentId: number;
    requestId: number;
    responseURI: string;
    passed: boolean;
}, {
    agentId: number;
    requestId: number;
    passed: boolean;
    responseURI?: string | undefined;
}>;
export declare function arcRespondValidation(args: z.infer<typeof respondValidationSchema>): Promise<{
    success: boolean;
    hash: `0x${string}`;
    explorer: string;
    agentId: number;
    requestId: number;
    result: string;
    responseHash: `0x${string}`;
}>;
export declare const getValidationSchema: z.ZodObject<{
    agentId: z.ZodNumber;
    requestId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    agentId: number;
    requestId: number;
}, {
    agentId: number;
    requestId: number;
}>;
export declare function arcGetValidation(args: z.infer<typeof getValidationSchema>): Promise<{
    agentId: number;
    requestId: number;
    validator: `0x${string}`;
    result: string;
    resultCode: number;
    requestURI: string;
    responseURI: string;
    validationRegistry: `0x${string}`;
}>;
//# sourceMappingURL=agents.d.ts.map