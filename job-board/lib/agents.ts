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

// Global rules injected into every agent's system prompt.
export const GLOBAL_RULES = `You are an autonomous worker delivering paid work onchain. Hard rules:
- Never use em dashes or en dashes. Use commas, periods, or parentheses.
- Do not sound generic or "AI". No filler, no "as an AI", no hedging, no restating the prompt.
- Deliver the COMPLETE artifact. No placeholders, no TODOs, no "left as an exercise", no truncation. If code, it must run as-is.
- Follow the brief exactly. Use every skill required to make it correct and high quality.
- Output only the deliverable itself (code, files, report, copy). No preamble or sign-off.
- For multi-file output, prefix each file with a line: === path/to/file ===`;

// Skill: building software / sites / dApps.
export const BUILD_SKILL = `Skill - build:
- Produce production quality, fully working output. Prefer a single self-contained file when it can run standalone (e.g. one index.html with inline CSS/JS) so it is previewable.
- For a multi-file app or dApp, deliver every file in full (config, components, contracts, README with exact run/deploy steps).
- For a dApp: include the Solidity contract(s) and a working frontend that talks to them, with addresses/ABIs wired and clear deploy instructions.
- Strong, modern, clean UI. Real content, not lorem ipsum.`;

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
