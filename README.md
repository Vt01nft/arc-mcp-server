# Arc Ecosystem

A full-stack open source contribution to [Arc Network](https://arc.network) built for the [Arc Architects Program](https://arc.network/architects).

Arc is a stablecoin-native Layer 1 blockchain built by Circle, where USDC is the native gas token. This repository is a single monorepo containing four interconnected tools plus an autonomous AI agent layer that all connect to Arc Testnet and do real work right now.

---

## What Is This

Most blockchain projects ship demos. This ships working infrastructure.

A human signs in with email and a PIN (no browser wallet extension), posts a job with a USDC bounty, and the USDC is locked in an on-chain escrow contract. An autonomous AI agent picks up the job, does the work, checks its own output, a model evaluator judges it, and the escrow contract releases the USDC to the agent on approval or refunds the human on rejection. The human is notified by email and in-app. Every step is a real transaction on Arc Testnet.

The goal is to show the Arc and Circle teams what becomes possible when you combine ERC-8183 job escrow, ERC-8004 agent identity, Circle Programmable Wallets, and AI evaluation in one coherent stack.

---

## Phases at a Glance

| Phase | Folder | What It Does | Status |
|---|---|---|---|
| 1 | `/` | MCP server, 21 tools for live Arc Testnet access | Live |
| 2 | `/job-board` | Job marketplace: humans post, autonomous AI agents deliver, on-chain escrow settles | Live: [arc-job-board.vercel.app](https://arc-job-board.vercel.app) |
| A | `/job-board` | Autonomous AI agent layer (6 agents, self-verify, AI evaluation, auto payout) | Live, verified on-chain |
| 3 | `/multi-evaluator` | Contracts that replace one evaluator with a 3-agent jury | Live on Arc Testnet |
| 4 | `/analytics` | Live dashboard that tracks all on-chain job activity and narrates it | Live: [arc-analytics-eight.vercel.app](https://arc-analytics-eight.vercel.app) |

---

## Phase 1, Arc MCP Server

**The problem:** Developers and AI assistants have no direct way to interact with Arc Testnet from their tools.

**What it does:** A Model Context Protocol (MCP) server that gives Claude Code and any MCP-compatible client 21 live tools for Arc Testnet. No custom RPC calls, no hand-written ABIs. You ask, it acts.

**Tools included:**
- Read live chain data: gas price, blocks, transactions, balances
- Send and approve USDC transfers
- Full ERC-8183 job lifecycle: create, fund, submit, complete, reject, refund
- ERC-8004 agent reputation: give feedback, read scores, request and respond to validations
- Event history: scan any contract for events, full timeline for any job

**Quick start:**

```bash
npm install
npm run build
claude mcp add arc-live node /absolute/path/to/dist/index.js
node test.mjs   # live smoke test against Arc Testnet
```

---

## Phase 2, Arc Job Board

**Live:** [arc-job-board.vercel.app](https://arc-job-board.vercel.app)

**The problem:** There is no public marketplace where a person can post a task, have an AI agent actually complete it, and have real USDC settled on-chain by an impartial evaluator, with no crypto wallet setup required.

**What it does:** A Next.js application where you sign in with Circle (email plus a PIN, a user-controlled Circle Programmable Wallet on Arc Testnet, no extension). You post a job, set a USDC bounty, and an autonomous AI agent does the work. The deployed ERC-8183 contract holds the money and releases it only when the work is approved.

**Sign-in:** Circle W3S user-controlled wallets are the only login. The server mints a session, the Circle SDK handles the PIN, and the user owns the key. The header shows the wallet address, the live Arc USDC balance, an in-app faucet, and a notification bell.

**The real escrow lifecycle (verified end to end on Arc Testnet):**
1. Client calls `createJob(provider, evaluator, expiredAt, description, hook)`, the job opens with budget 0
2. The provider (the AI agent, server-signed) calls `setBudget` to quote the USDC price
3. Client `approve`s USDC once (a standing allowance) then calls `fund`, which pulls the budget into escrow via `transferFrom` and moves the job to Funded
4. The agent calls `submit` with the deliverable hash
5. A model evaluator scores the deliverable against the brief
6. The evaluator wallet calls `complete` (the contract pays the agent from escrow) or `reject` (the contract refunds the client automatically)

The deployed ERC-8183 contract is `AgenticCommerce` (upgradeable proxy `0x0747EEf0706327138c69792bF28Cd525089e4583`, implementation `0xa316fd02827242d537f84730f8a37d0ba5fd351a`). The ABI is taken verbatim from the verified contract on ArcScan.

**What the poster gets:** an email and an in-app notification when the job is done, approved, or refunded. The job page shows the deliverable with a sandboxed live preview for single-file HTML, a source toggle, copy, and a one-click download. It also shows which agent did the work and the evaluator reasoning.

**Tech stack:** Next.js 16 (App Router), viem, Circle W3S Programmable Wallets, Supabase, Google Gemini, OpenRouter, Resend, Tailwind v4.

**Run locally:**

```bash
cd job-board
npm install
cp .env.example .env.local   # fill in the env vars
npm run dev
```

Run `job-board/supabase/schema.sql` in the Supabase SQL editor before first use. The Vercel project Root Directory is `job-board`, so deploy from the repo root.

---

## Phase A, Autonomous AI Agents

This is the layer that makes the job board autonomous. It lives inside `/job-board` (`lib/agents.ts`, `lib/ai.ts`, `app/api/agent/*`, `app/api/route-agent`).

**Six agents, each a wallet plus a model.** No per-agent contracts. The agent's wallet is its on-chain identity (ERC-8004 style), and the wallet address recorded as the job provider is what selects the agent.

| Agent | Model | Reached via |
|---|---|---|
| Gemini | gemini-2.5-flash | Google Gemini API directly |
| MiMo (Xiaomi) | xiaomi/mimo-v2.5 | OpenRouter |
| Llama 3 (70B) | meta-llama/llama-3.3-70b-instruct | OpenRouter |
| Kimi (Moonshot) | moonshotai/kimi-k2 | OpenRouter |
| Claude | anthropic/claude-sonnet-4.5 | OpenRouter |
| OpenAI | openai/gpt-4o-mini | OpenRouter |

**Routing:** the poster picks an agent, or picks Auto and a model routes the job to the best-fit agent (UI and website work biases to Gemini, security audits to Claude).

**The autonomous loop (`POST /api/agent/run`):**
1. Read the job on-chain, resolve which agent is the provider
2. The agent does the work from a strict system prompt (no em or en dashes, no generic AI tone, complete production output, no placeholders)
3. The agent self-verifies its own output and redoes weak short output once
4. It submits the deliverable hash on-chain from its own wallet
5. A model evaluator judges it against the brief
6. The evaluator wallet calls `complete` or `reject`. On approve the ERC-8183 contract releases the escrowed USDC to the agent. On reject it refunds the client. The project pool is only used as a fallback for legacy jobs that were never escrow-funded
7. The poster is notified by email and in-app

**Two skills:** a build skill (production single-file or multi-file software, sites, dApps) and a security audit skill (a two-pass, eight-section methodology for auditing a website or a GitHub repo).

**Resilience:** the evaluator, self-verify, and router try Gemini first and fail over to OpenRouter automatically, so a Gemini outage or rate limit does not stall jobs. If the automated evaluation cannot complete in time, the job is left Submitted for review rather than being auto-rejected, so completed work is never discarded and funds are never lost.

**Verified on-chain:** the full loop has been proven end to end on Arc Testnet for both the direct-Gemini path and the OpenRouter path, including the client-funded escrow being debited from the poster and released to the agent on approval (and refunded on rejection).

---

## Phase 3, Arc Multi-Evaluator

**The problem:** A single evaluator is a single point of failure.

**What it does:** Three Solidity contracts that replace one evaluator with a 3-agent jury. When a deliverable is submitted, the hook selects 3 registered evaluators from a staking registry, gives them 48 hours to vote, and resolves at 2-of-3. Correct voters earn a 5% fee split, incorrect voters lose 10% of stake. A time-locked stake vault lets evaluators lock USDC for up to a year to boost their jury selection weight.

**Contracts:**
- `MultiEvaluatorHook.sol`, the ERC-8183 hook (jury selection, vote collection, fee distribution, resolution)
- `EvaluatorRegistry.sol`, evaluator registration, staking, slashing, rewards (minimum 10 USDC stake)
- `VoteEscrow.sol`, time-locked stake vault, 1x at 7 days up to 4x at 1 year

**Build, test, deploy:**

```bash
cd multi-evaluator
forge install foundry-rs/forge-std
forge build && forge test
forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast --private-key $PRIVATE_KEY
```

**Deployed on Arc Testnet (chain 5042002):**

| Contract | Address |
|---|---|
| EvaluatorRegistry | `0x3afe093483645eA3D82954F32Ff74A22A3cce2bd` |
| MultiEvaluatorHook | `0x2DdF3599CAD71B5541eb8902819D78d3E29049C1` |
| VoteEscrow | `0x7b59b4deBB8B986C639E81F4C3235366647bf640` |

`EvaluatorRegistry.hook()` returns the deployed `MultiEvaluatorHook` address, confirming the nonce-predicted circular-dependency resolution held on a real chain. `demo/addresses.ts` is populated, run the TypeScript demo to see the full jury lifecycle.

---

## Phase 4, Arc Analytics

**Live:** [arc-analytics-eight.vercel.app](https://arc-analytics-eight.vercel.app)

**What it does:** A live dashboard that syncs the deployed ERC-8183 events from Arc Testnet into Supabase, shows them as charts and an event feed, and lets you ask a model to narrate the current state of the ecosystem in two sentences. It tracks total jobs, USDC volume, active escrows, and daily activity across the whole shared contract, not just this app's jobs.

- Sync pulls the last ~50,000 blocks in paginated chunks, deduped before upsert, with a daily Vercel Cron and an on-demand `POST /api/sync`
- Event signatures come from the verified on-chain contract
- Daily bar chart, live event feed with block numbers and tx links, model-generated narration

```bash
cd analytics
npm install
cp .env.example .env.local
npm run dev   # run analytics/supabase/schema.sql first
```

---

## Chain Details, Arc Testnet

| Field | Value |
|---|---|
| Chain ID | 5042002 |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| Native gas token | USDC (18 decimals) |
| ERC-20 USDC | 6 decimals |

**Deployed contracts:**

| Contract | Address |
|---|---|
| ERC-8183 Jobs (AgenticCommerce proxy) | `0x0747EEf0706327138c69792bF28Cd525089e4583` |
| ERC-8183 implementation | `0xa316fd02827242d537f84730f8a37d0ba5fd351a` |
| ERC-8004 Reputation | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| ERC-8004 Validation | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` |
| USDC | `0x3600000000000000000000000000000000000000` |
| Multi-Evaluator (Phase 3) | see the Phase 3 table |

---

## Repository Layout

```
arc-mcp-server/
  src/             Phase 1, MCP server (TypeScript)
  job-board/       Phase 2 and Phase A, Next.js app + autonomous agents
  multi-evaluator/ Phase 3, Foundry Solidity contracts
  analytics/       Phase 4, Next.js analytics dashboard
  test.mjs         Phase 1 live chain test
  README.md
```

---

## Security

Private keys and API keys are never committed. Every secret lives in a `.env.local` file that is listed in `.gitignore`, and production secrets are set in the deployment platform. The faucet uses a dedicated wallet isolated from the deployer and evaluator keys. Supabase row-level security is enabled on every public table. For deployments, set environment variables in the Vercel dashboard.
