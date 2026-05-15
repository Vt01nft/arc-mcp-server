// Deploy contracts via:
//   cd multi-evaluator
//   forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast --private-key $PRIVATE_KEY
// Then paste the logged addresses here.

export const ADDRESSES = {
  EVALUATOR_REGISTRY: "0x408857450Fb767E784BC08bD3c3AA2cd95d5dAc3" as `0x${string}`,
  MULTI_EVALUATOR_HOOK: "0x5670d80ae8Aa66B5c5de904cdD1BBff17822bac9" as `0x${string}`,
  VOTE_ESCROW: "0xB624c5AF586D909d92Ad210e3f0c1b19085E5d95" as `0x${string}`,
  // Arc Testnet ERC-8183 Jobs
  ERC8183_JOB: "0x0747EEf0706327138c69792bF28Cd525089e4583" as `0x${string}`,
} as const;
