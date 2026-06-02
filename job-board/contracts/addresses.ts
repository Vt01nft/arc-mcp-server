// Arc Testnet - verified from official docs (docs.arc.network)
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
  // USDC - native gas token + ERC-20 interface (6 decimals for transfers)
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

  // ERC-8004: Agent identity registry (ERC-721-style). Agents must register()
  // here to get an agentId BEFORE the reputation registry will accept
  // giveFeedback for them. VERIFIED via getIdentityRegistry() on the
  // reputation proxy + arcscan impl ABI (impl 0x7274e874...). proxy below.
  ERC8004_IDENTITY: "0x8004A818BFB912233c491871b3d84c89A494BD9e" as `0x${string}`,

  // ── Phase 3 / v2 Sprint 2: Multi-evaluator jury ──────────────────────────
  // Deployed from multi-evaluator/script/Deploy.s.sol by the rotated server
  // wallet (PRIVATE_KEY = NEXT_PUBLIC_EVALUATOR_ADDRESS). That wallet is the
  // hook's owner + authorizedCaller AND the ERC-8183 evaluator on jury jobs,
  // so the server seats juries and bridges the outcome to ERC-8183 without
  // depending on the old (rotated-away) deployer key.
  EVALUATOR_REGISTRY: "0x49fD54E3713CFa32f7A041E3d328FfB0380dd3A6" as `0x${string}`,
  MULTI_EVALUATOR_HOOK: "0x876E0cC973B36946CAb30Bd01d4F9C1cC0847D38" as `0x${string}`,
  VOTE_ESCROW: "0xECD11530Ec3d975C69eC6886f3b6641282B63D3b" as `0x${string}`,

  // ── v2 Sprint 3: CCTP v2 (cross-chain USDC) ──────────────────────────────
  // VERIFIED on-chain: both have code on Arc, MessageTransmitter.localDomain
  // == 26 (Arc). depositForBurn/receiveMessage sigs verified from arcscan
  // impls (TokenMessenger impl 0xf07c0ad1..., Transmitter impl 0xa849059b...).
  // Same addresses on Optimism Sepolia (domain 2). Source: Circle CCTP v2 docs.
  CCTP_TOKEN_MESSENGER: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as `0x${string}`,
  CCTP_MESSAGE_TRANSMITTER: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as `0x${string}`,
} as const;

// CCTP v2 domain ids (NOT chain ids).
export const CCTP_DOMAIN = {
  ARC_TESTNET: 26,
  OPTIMISM_SEPOLIA: 2,
} as const;

// Circle Iris attestation service (sandbox = testnet).
export const CCTP_IRIS_SANDBOX = "https://iris-api-sandbox.circle.com";

// USDC has dual decimal system on Arc:
// - 18 decimals: native gas token (wei-level precision)
// - 6 decimals: ERC-20 transfer interface (standard USDC)
// Always use 6 decimals for application-level transfers
export const USDC_DECIMALS = 6;
export const USDC_GAS_DECIMALS = 18;
export const GAS_BASE_FEE_GWEI = 20n; // minimum base fee on testnet
