export declare const USDC_ABI: readonly [{
    readonly name: "balanceOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
}, {
    readonly name: "transfer";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "to";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
    }];
}, {
    readonly name: "approve";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "spender";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
    }];
}, {
    readonly name: "allowance";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
    }, {
        readonly name: "spender";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
}, {
    readonly name: "decimals";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint8";
    }];
}, {
    readonly name: "Transfer";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly name: "from";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "to";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "value";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}];
export declare const ERC8183_ABI: readonly [{
    readonly name: "createJob";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "provider";
        readonly type: "address";
    }, {
        readonly name: "evaluator";
        readonly type: "address";
    }, {
        readonly name: "expiry";
        readonly type: "uint256";
    }, {
        readonly name: "description";
        readonly type: "bytes32";
    }, {
        readonly name: "hook";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "jobId";
        readonly type: "uint256";
    }];
}, {
    readonly name: "fundJob";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly name: "jobId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "submitDeliverable";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "jobId";
        readonly type: "uint256";
    }, {
        readonly name: "deliverable";
        readonly type: "bytes32";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "completeJob";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "jobId";
        readonly type: "uint256";
    }, {
        readonly name: "reason";
        readonly type: "bytes32";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "rejectJob";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "jobId";
        readonly type: "uint256";
    }, {
        readonly name: "reason";
        readonly type: "bytes32";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "refundJob";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "jobId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "jobs";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "jobId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple";
        readonly components: readonly [{
            readonly name: "id";
            readonly type: "uint256";
        }, {
            readonly name: "client";
            readonly type: "address";
        }, {
            readonly name: "provider";
            readonly type: "address";
        }, {
            readonly name: "evaluator";
            readonly type: "address";
        }, {
            readonly name: "expiry";
            readonly type: "uint256";
        }, {
            readonly name: "description";
            readonly type: "bytes32";
        }, {
            readonly name: "amount";
            readonly type: "uint256";
        }, {
            readonly name: "status";
            readonly type: "uint8";
        }, {
            readonly name: "deliverable";
            readonly type: "bytes32";
        }, {
            readonly name: "hook";
            readonly type: "address";
        }];
    }];
}, {
    readonly name: "jobCount";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
}, {
    readonly name: "JobCreated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly name: "jobId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "client";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "provider";
        readonly type: "address";
        readonly indexed: true;
    }];
}, {
    readonly name: "JobFunded";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly name: "jobId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}, {
    readonly name: "DeliverableSubmitted";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly name: "jobId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "deliverable";
        readonly type: "bytes32";
        readonly indexed: false;
    }];
}, {
    readonly name: "JobCompleted";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly name: "jobId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "reason";
        readonly type: "bytes32";
        readonly indexed: false;
    }];
}, {
    readonly name: "JobRejected";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly name: "jobId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "reason";
        readonly type: "bytes32";
        readonly indexed: false;
    }];
}];
export declare const ERC8004_REPUTATION_ABI: readonly [{
    readonly name: "giveFeedback";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "agentId";
        readonly type: "uint256";
    }, {
        readonly name: "score";
        readonly type: "int128";
    }, {
        readonly name: "feedbackType";
        readonly type: "uint8";
    }, {
        readonly name: "tag";
        readonly type: "string";
    }, {
        readonly name: "strengths";
        readonly type: "string";
    }, {
        readonly name: "improvements";
        readonly type: "string";
    }, {
        readonly name: "context";
        readonly type: "string";
    }, {
        readonly name: "feedbackHash";
        readonly type: "bytes32";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "getReputation";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "agentId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "totalScore";
        readonly type: "int256";
    }, {
        readonly name: "eventCount";
        readonly type: "uint256";
    }];
}, {
    readonly name: "FeedbackGiven";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly name: "agentId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "validator";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "score";
        readonly type: "int128";
        readonly indexed: false;
    }, {
        readonly name: "tag";
        readonly type: "string";
        readonly indexed: false;
    }];
}];
export declare const ERC8004_VALIDATION_ABI: readonly [{
    readonly name: "validationRequest";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "validator";
        readonly type: "address";
    }, {
        readonly name: "agentId";
        readonly type: "uint256";
    }, {
        readonly name: "requestURI";
        readonly type: "string";
    }, {
        readonly name: "requestHash";
        readonly type: "bytes32";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "validationResponse";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "agentId";
        readonly type: "uint256";
    }, {
        readonly name: "requestId";
        readonly type: "uint256";
    }, {
        readonly name: "result";
        readonly type: "uint8";
    }, {
        readonly name: "responseURI";
        readonly type: "string";
    }, {
        readonly name: "responseHash";
        readonly type: "bytes32";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "getValidation";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "agentId";
        readonly type: "uint256";
    }, {
        readonly name: "requestId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "validator";
        readonly type: "address";
    }, {
        readonly name: "result";
        readonly type: "uint8";
    }, {
        readonly name: "requestURI";
        readonly type: "string";
    }, {
        readonly name: "responseURI";
        readonly type: "string";
    }];
}, {
    readonly name: "ValidationRequested";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly name: "agentId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "validator";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "requestId";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}, {
    readonly name: "ValidationCompleted";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly name: "agentId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "result";
        readonly type: "uint8";
        readonly indexed: false;
    }];
}];
export declare const JOB_STATUS: Record<number, string>;
//# sourceMappingURL=abis.d.ts.map