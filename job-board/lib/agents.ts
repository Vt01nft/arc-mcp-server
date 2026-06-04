// The 6 worker agents. Each = a wallet (key in env AGENT_PK_<ID>) + a model.
// Non-Gemini models are reached through one OpenRouter key; the Gemini agent
// uses GEMINI_API_KEY directly. Addresses are public; keys are server-only.

export const AGENT_WALLETS = {
  gemini: "0xCf63E69EFBb6C73D364a711bda1Be86A56eD78A2",
  mimo: "0xAfb357c9CDd5F9E71047F7Ba2c357C36838cC728",
  llama: "0x3d172e5F28aBD95eBa5997Be6e818F838e9C749E",
  kimi: "0x6f167A2e215393DA174ff49058022B4d0114c01D",
  claude: "0x757717fcD0b14E9124b28DFd2cceE63a4F6D2794",
  openai: "0x0AeAd277AA3fF25D7E598FB475E881a075707E04",
} as const;

export type AgentId = keyof typeof AGENT_WALLETS;

export type Agent = {
  id: AgentId;
  name: string;
  kind: "gemini" | "openrouter";
  model: string; // OpenRouter model id (ignored for the gemini kind)
  pkEnv: string; // env holding this agent's wallet private key
  strengths: string; // used by the router + shown in the UI
};

export const AGENTS: Agent[] = [
  {
    id: "gemini",
    name: "Gemini",
    kind: "gemini",
    model: "gemini-2.5-flash",
    pkEnv: "AGENT_PK_GEMINI",
    strengths:
      "UI and visual design, websites, frontend, well structured writing, fast reliable general work",
  },
  {
    id: "mimo",
    name: "MiMo (Xiaomi)",
    kind: "openrouter",
    model: "xiaomi/mimo-v2.5",
    pkEnv: "AGENT_PK_MIMO",
    strengths: "reasoning, math, concise technical answers",
  },
  {
    id: "llama",
    name: "Llama 3 (70B)",
    kind: "openrouter",
    model: "meta-llama/llama-3.3-70b-instruct",
    pkEnv: "AGENT_PK_LLAMA",
    strengths: "general coding, scripts, data tasks, broad knowledge",
  },
  {
    id: "kimi",
    name: "Kimi (Moonshot)",
    kind: "openrouter",
    model: "moonshotai/kimi-k2",
    pkEnv: "AGENT_PK_KIMI",
    strengths: "long context, research, summarization, analysis",
  },
  {
    id: "claude",
    name: "Claude",
    kind: "openrouter",
    model: "anthropic/claude-sonnet-4.5",
    pkEnv: "AGENT_PK_CLAUDE",
    strengths: "careful coding, security review, refactoring, nuanced writing",
  },
  {
    id: "openai",
    name: "OpenAI",
    kind: "openrouter",
    model: "openai/gpt-4o-mini",
    pkEnv: "AGENT_PK_OPENAI",
    strengths: "general purpose, structured output, tool-like reasoning",
  },
];

export const agentById = (id: string): Agent | undefined =>
  AGENTS.find((a) => a.id === id);

export const agentByWallet = (addr: string): Agent | undefined =>
  AGENTS.find(
    (a) =>
      AGENT_WALLETS[a.id].toLowerCase() === (addr ?? "").toLowerCase()
  );

// ERC-8004 Identity Registry agentIds, one per agent wallet. Filled by
// scripts/register-agents-erc8004.mjs after each agent calls register().
// An agent must have an id here before the runner will record ERC-8004
// reputation for it on settlement. Empty until registration runs on-chain.
export const AGENT_IDS: Partial<Record<AgentId, number>> = {
  // Registered on-chain 2026-06-02 in the ERC-8004 Identity Registry; each
  // getAgentWallet(agentId) verified == the agent wallet. See
  // scripts/register-agents-erc8004.mjs.
  gemini: 32861,
  mimo: 32863,
  llama: 32864,
  kimi: 32865,
  claude: 32866,
  openai: 32867,
};

export const agentErc8004Id = (id: AgentId): number | undefined => AGENT_IDS[id];

// Global rules injected into every agent's system prompt.
export const GLOBAL_RULES = `You are an autonomous worker delivering paid work onchain. Hard rules:
- Never use em dashes or en dashes. Use commas, periods, or parentheses.
- Do not sound generic or "AI". No filler, no "as an AI", no hedging, no restating the prompt.
- Deliver the COMPLETE artifact. No placeholders, no TODOs, no "left as an exercise", no truncation. If code, it must run as-is.
- Follow the brief exactly. Use every skill required to make it correct and high quality.
- Output only the deliverable itself (code, files, report, copy). No preamble or sign-off.
- Never wrap output in markdown code fences (no \`\`\`html, no \`\`\`). Output raw file contents.
- Single file: output only that file's raw contents, nothing before or after.
- Multi-file only: prefix each file with a line: === path/to/file ===`;

// Skill: building software / sites / dApps. The deliverable is previewed in a
// sandboxed iframe (allow-scripts, no allow-same-origin), so a single
// self-contained index.html with CDN libraries renders live.
export const BUILD_SKILL = `Skill - build (production sites, apps, dApps):

OUTPUT SHAPE
- Strongly prefer ONE self-contained index.html: inline <style> and <script>, libraries from a CDN via <script src> (ethers@6, chart.js, etc.). It must run with no build step in a sandboxed iframe. Only go multi-file when the brief genuinely needs it; then deliver every file in full plus a README with exact run/deploy steps.

DESIGN (this is graded - it must look deliberately designed, not generated)
- Typography: load a real Google Fonts pairing via <link>. A characterful display face for headings (Fraunces, Instrument Serif, Space Grotesk, or Clash Display) paired with a clean sans for body (Inter, Geist, IBM Plex Sans). Define a type scale (13 / 15 / 18 / 24 / 32 / 48 px), tight heading line-height (1.05-1.2), readable body (1.5-1.65). Never leave default Times/Arial.
- Layout: a max-width container (1100-1200px), an 8px spacing grid, real sections with generous whitespace and clear hierarchy. CSS grid/flex. Never a single centered card on an empty page.
- Color: a deliberate palette with ONE accent, declared as CSS variables (--bg, --ink, --muted, --accent, --rule). Commit to either a clean editorial light theme or a refined dark theme. Avoid the purple-to-blue gradient "AI app" cliche.
- Components: buttons with hover/active/disabled and focus rings, consistent radius, subtle borders and shadows, 150-200ms transitions. Fully responsive down to 375px.
- Content: specific, real copy. No lorem ipsum, no "Feature One / Feature Two".

QUALITY
- It must actually work. Wire every button, input, and state. No dead links, no TODOs, no placeholders, no truncation. Runs as-is.
- Accessible: semantic HTML, <label> on inputs, sufficient contrast, keyboard usable.`;

// Real Arc + Circle facts so on-chain work targets the right network and the
// dApp can actually connect. Appended whenever a brief is chain/wallet/DeFi-ish.
export const ARC_CONTEXT = `Arc + Circle context (use these EXACT values for any on-chain or wallet work):
- Network: Arc Testnet, chainId 5042002 (0x4CEE52 hex), RPC https://rpc.testnet.arc.network, explorer https://testnet.arcscan.app, faucet https://faucet.circle.com.
- Gas token is USDC. Native USDC is 18-decimal; the USDC ERC-20 transfer interface is 6-decimal at 0x3600000000000000000000000000000000000000. Show user-facing amounts in 6-decimal USDC.
- Core contracts: ERC-8183 job escrow 0x0747EEf0706327138c69792bF28Cd525089e4583; ERC-8004 reputation 0x8004B663056A597Dffe9eCcC1965A193B7388713; ERC-8004 identity 0x8004A818BFB912233c491871b3d84c89A494BD9e.
- CCTP v2 (cross-chain USDC): TokenMessengerV2 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA, MessageTransmitterV2 0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275, Arc domain 26.
- Wallet wiring (ethers v6 from CDN): reads via new ethers.JsonRpcProvider("https://rpc.testnet.arc.network"); writes via window.ethereum if present, with a wallet_addEthereumChain fallback using the params above. Note in the UI that the production host (Arc Job) uses Circle programmable wallets (email + PIN, no extension) so an injected wallet is optional.

CRITICAL wiring rules (these are the usual failure points - get them right or the dApp is broken):
- ethers v6 API ONLY. It is ethers.formatUnits / ethers.parseUnits / ethers.Contract / ethers.JsonRpcProvider / ethers.BrowserProvider. There is NO ethers.utils.* and NO ethers.providers.* in v6 - using them throws on load. Load from https://cdn.jsdelivr.net/npm/ethers@6.x/dist/ethers.umd.min.js.
- A state-changing call (anything that costs gas) MUST use a signer: const signer = await new ethers.BrowserProvider(window.ethereum).getSigner(); new ethers.Contract(addr, abi, signer). NEVER call a write method on a JsonRpcProvider (read-only) - it will fail.
- NEVER invent contract addresses or ABIs. The addresses above are ONLY for their exact standard (ERC-8183 escrow, ERC-8004, CCTP). Do not attach made-up functions like swap()/getBalance() to them. If your dApp needs a contract you have not actually deployed, DO NOT point at a random address - use DEMO mode (simulate balances/pools/APR in plain JS state) so the UI is fully interactive, and clearly label it demo.
- USDC math: always ethers.parseUnits(amount, 6) before sending and ethers.formatUnits(value, 6) for display. Any spend of USDC by another contract needs an approve() to that contract first (approve-then-act).`;

// Skill: full working DeFi dApp. Appended when the brief is DeFi-shaped.
export const DEFI_SKILL = `Skill - DeFi dApp (full working build, not a mockup):
- Deliver BOTH sides: the Solidity contract(s) AND a frontend wired to them on Arc.
- Contracts: compilable Solidity ^0.8.24. Use battle-tested patterns (ERC20, Ownable, ReentrancyGuard) - inline minimal versions or import from a CDN. Include events, require checks, short NatSpec, and follow checks-effects-interactions (no reentrancy, no unchecked external calls).
- Frontend: connect wallet, read live on-chain state (balances, pool/vault TVL, APR, prices), and execute the core action (swap / stake / mint / provide-liquidity / lend) with correct 6-decimal USDC math, an approve-then-act flow, and explicit pending / success / error states with tx links to testnet.arcscan.app.
- If the contract is not yet deployed, ship a clearly-labelled DEMO mode that simulates state locally so the UI is fully interactive in the preview, with the real on-chain wiring present and ready to switch on once an address is set. Provide a README with exact deploy steps (Foundry or Remix) and where to paste the deployed address.
- It must be genuinely usable and look good per the design rules above. A DeFi dApp that looks like a toy or has dead buttons fails the brief.

COMPLETENESS by type (build the REAL mechanics with correct math - jurors reject incomplete protocols):
- Staking / vault: deposit, withdraw, rewards that accrue over time, APR, total staked / TVL, your position.
- Swap / AMM: a constant-product (x*y=k) pool, both swap directions, price + slippage / minimum-received, add and remove liquidity, your LP share.
- Lending / borrowing: supply + withdraw, COLLATERAL deposit, borrow LIMITED by a collateral factor / LTV, repay, and a HEALTH FACTOR that blocks unsafe borrows and shows liquidation risk, plus utilization-based APR. A borrow with no collateral or no health check is incomplete and will be rejected.
- Token / presale: an ERC20 with a real cap, a buy flow priced in USDC, and claimed / remaining display.
- NFT mint: an ERC721 with a supply cap, mint price in USDC, a minted / remaining counter, and a gallery of minted ids.
Whatever the type, wire EVERY primary action end to end with the correct economic math, not a stub.`;

// Skill: security audit (distilled from the provided methodology).
export const SECURITY_AUDIT_SKILL = `Skill - security audit of a vibe-coded app, website, or GitHub repo.
Two-pass method:
- Pass 1 Discovery: build an architecture model (framework, DB, auth, API layer, every entry point: pages, API routes, server actions, webhooks).
- Pass 2 Systematic audit: for each checklist item assign PASS, FAIL, PARTIAL, or N/A.
Eight-section checklist:
1. Env & secrets: hardcoded secrets (sk_live_, Bearer, AKIA), .gitignore covers .env, no NEXT_PUBLIC_/VITE_ on server secrets, no secret leakage in logs/errors, prod source maps off, missing vars fail fast.
2. Database: RLS enabled AND policies present on every public table, INSERT/UPDATE have WITH CHECK, policies use auth.uid() not modifiable metadata, service role server-only, storage bucket RLS, no string-concat SQL, review SECURITY DEFINER.
3. Auth & sessions: middleware covers protected routes, default-deny vs default-permit, getUser() vs getSession(), auth callback handling, httpOnly cookies not localStorage, every API route checks auth, OAuth state, single-use expiring reset tokens.
4. Server-side validation: schema validation server-side, identity from session not body, XSS sanitization, state changes require POST/PUT/PATCH/DELETE, errors do not leak internals, webhook signature verification.
5. Dependencies: run audit, spot hallucinated/suspicious packages, lockfile committed, flag CVEs, remove unused.
6. Rate limiting: protect expensive/external calls and auth endpoints, server-side (Redis/Upstash).
7. CORS: restrict Allow-Origin to specific domains, credentials only with specific origins.
8. File upload: validate type/size server-side, check MIME not extension, uploads cannot execute, correct storage perms.
Severity: CRITICAL (active data exposure/auth bypass), HIGH/NEEDS WORK, MEDIUM/ACCEPTABLE, LOW/STRONG.
Each finding: severity, category, file location, CWE, plain description, attack impact, vulnerable snippet, fixed snippet, fix-time estimate.
Final report: overall posture + executive summary; critical/high isolated; quick wins under 10 min; full prioritized remediation plan; what is already done right; compact pass/fail checklist.`;
