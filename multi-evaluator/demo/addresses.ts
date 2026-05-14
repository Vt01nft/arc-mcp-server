// Deploy contracts via:
//   cd multi-evaluator
//   forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast --private-key $PRIVATE_KEY
// Then paste the logged addresses here.

export const ADDRESSES = {
  EVALUATOR_REGISTRY: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  MULTI_EVALUATOR_HOOK: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  VOTE_ESCROW: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  // Arc Testnet ERC-8183 Jobs
  ERC8183_JOB: "0x0747EEf0706327138c69792bF28Cd525089e4583" as `0x${string}`,
} as const;
