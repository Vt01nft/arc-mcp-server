// Arc Testnet — verified from official docs (docs.arc.network)
// Last verified: May 2026

export const ARC_TESTNET = {
  id: 5042002,
  name: "Arc Testnet",
  rpcUrl: "https://rpc.testnet.arc.network",
  wsUrl: "wss://rpc.testnet.arc.network",
  explorerUrl: "https://testnet.arcscan.app",
  faucetUrl: "https://faucet.circle.com",
  nativeCurrency: {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 18, // native gas precision
  },
} as const;

export const ADDRESSES = {
  // USDC — native gas token + ERC-20 interface (6 decimals for transfers)
  // source: https://docs.arc.network/arc/references/contract-addresses
  USDC: "0x3600000000000000000000000000000000000000" as `0x${string}`,

  // ERC-8183: Job escrow + settlement standard
  // source: https://www.arc.network/blog/running-an-agentic-economic-flow-on-arc-with-erc-8183
  ERC8183_JOB: "0x0747EEf0706327138c69792bF28Cd525089e4583" as `0x${string}`,

  // ERC-8004: Agent reputation registry
  // source: https://docs.arc.network/arc/tutorials/register-your-first-ai-agent
  ERC8004_REPUTATION: "0x8004B663056A597Dffe9eCcC1965A193B7388713" as `0x${string}`,

  // ERC-8004: Agent validation registry
  // source: https://docs.arc.network/arc/tutorials/register-your-first-ai-agent
  ERC8004_VALIDATION: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272" as `0x${string}`,
} as const;

// USDC has dual decimal system on Arc:
// - 18 decimals: native gas token (wei-level precision)
// - 6 decimals: ERC-20 transfer interface (standard USDC)
// Always use 6 decimals for application-level transfers
export const USDC_DECIMALS = 6;
export const USDC_GAS_DECIMALS = 18;
export const GAS_BASE_FEE_GWEI = 20n; // minimum base fee on testnet
