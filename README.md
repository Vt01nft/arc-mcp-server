# Arc Ecosystem

A full-stack open source contribution to [Arc Network](https://arc.network) built for the [Arc Architects Program](https://arc.network/architects).

Arc is a stablecoin-native Layer 1 blockchain built by Circle, where USDC is the native gas token. This repository contains four interconnected tools that demonstrate what real AI-native infrastructure looks like on Arc Testnet.

---

## What Is This

Most blockchain projects ship demos. This ships working infrastructure.

Four phases. One monorepo. Every tool connects to Arc Testnet right now and does something real: reads live chain data, creates escrow jobs, evaluates deliverables using Claude, votes on outcomes with a 3-agent jury, and visualizes everything on a live dashboard.

The goal is to show the Arc and Circle teams what becomes possible when you combine ERC-8183 job escrow, ERC-8004 agent identity, and AI evaluation in a single coherent stack.

---

## Phases at a Glance

| Phase | Folder | What It Does | Status |
|---|---|---|---|
| 1 | `/` | MCP server - 21 tools for live Arc Testnet access | Live |
| 2 | `/job-board` | Job marketplace where humans post tasks and AI agents complete them | Complete |
| 3 | `/multi-evaluator` | Smart contracts that replace a single evaluator with a 3-agent jury | Live on Arc Testnet |
| 4 | `/analytics` | Live dashboard that tracks all onchain job activity and narrates it with Claude | Complete |

---

## Phase 1 - Arc MCP Server

**The problem:** Developers and AI assistants have no direct way to interact with Arc Testnet from their tools.

**What it does:** This is a Model Context Protocol (MCP) server that gives Claude Code and any MCP-compatible client 21 live tools for interacting with Arc Testnet. No need to write custom RPC calls or know the contract ABIs. You just ask Claude to do something and it does it.

**Tools included:**
- Read live chain data: gas price, blocks, transactions, balances
- Send and approve USDC transfers
- Full ERC-8183 job lifecycle: create, fund, submit deliverable, complete, reject, refund
- ERC-8004 agent reputation: give feedback, read scores, request and respond to validations
- Event history: scan any contract for events, get a full timeline for any specific job

**Quick start:**

```bash
npm install
npm run build
claude mcp add arc-live node /absolute/path/to/dist/index.js
```

Once added, Claude can call tools like `arc_get_gas_price`, `arc_create_job`, and `arc_get_reputation` directly from any conversation.

**Test against live chain:**

```bash
node test.mjs
```

This runs a live smoke test against Arc Testnet and prints real data including current gas price, latest block, and event counts.

---

## Phase 2 - Arc Job Board

**The problem:** There is no public marketplace where humans can post tasks for AI agents to complete, with real USDC on the line and an AI evaluator deciding the outcome.

**What it does:** A Next.js web application where anyone can post a job with a USDC bounty, assign a provider address, and let the ERC-8183 contract handle the escrow. When the provider submits their deliverable, Claude Sonnet evaluates it and gives a recommendation. The evaluator then approves or rejects onchain, releasing or refunding the USDC.

**How it works step by step:**
1. A client posts a job with a description, USDC amount, and provider address
2. The contract locks the USDC in escrow
3. The provider does the work and submits a deliverable hash onchain
4. Claude evaluates the deliverable against the job description
5. The evaluator approves or rejects, which triggers the USDC transfer

**Tech stack:** Next.js 15, wagmi v3, RainbowKit, viem, Supabase, Anthropic SDK, Tailwind v4

**Run locally:**

```bash
cd job-board
npm install
cp .env.example .env.local
# Fill in your env vars
npm run dev
```

**Deploy:** Vercel and Supabase. See `job-board/README.md` for the full setup guide.

---

## Phase 3 - Arc Multi-Evaluator

**The problem:** A single evaluator is a single point of failure. One bad actor or one mistake can make or break a job outcome.

**What it does:** Three Solidity contracts that replace a single evaluator with a 3-agent jury system. When a deliverable is submitted, the hook automatically selects 3 registered evaluators from a staking registry, gives them 48 hours to vote, and resolves at 2-of-3. Correct voters earn a 5% fee split. Incorrect voters lose 10% of their stake. There is also a time-locked stake escrow contract that lets evaluators lock USDC for up to one year to boost their jury selection weight.

**Contracts:**
- `MultiEvaluatorHook.sol` - The ERC-8183 hook. Handles jury selection, vote collection, fee distribution, and outcome resolution.
- `EvaluatorRegistry.sol` - Manages evaluator registration, staking, slashing, and rewards. Evaluators must stake at least 10 USDC to participate.
- `VoteEscrow.sol` - Time-locked stake vault. Longer locks give higher jury selection weight, from 1x at 7 days to 4x at 1 year.

**Build and test:**

```bash
cd multi-evaluator
# Install Foundry from https://getfoundry.sh
forge install foundry-rs/forge-std
forge build
forge test
```

**Deploy to Arc Testnet:**

```bash
forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast --private-key $PRIVATE_KEY
```

**Deployed on Arc Testnet (chain 5042002):**

| Contract | Address |
|---|---|
| EvaluatorRegistry | `0x408857450Fb767E784BC08bD3c3AA2cd95d5dAc3` |
| MultiEvaluatorHook | `0x5670d80ae8Aa66B5c5de904cdD1BBff17822bac9` |
| VoteEscrow | `0xB624c5AF586D909d92Ad210e3f0c1b19085E5d95` |

Verified on-chain: `EvaluatorRegistry.hook()` returns the deployed `MultiEvaluatorHook`
address, confirming the nonce-predicted circular-dependency resolution held on a real chain.
`demo/addresses.ts` is already populated - run the TypeScript demo to see the full jury lifecycle.

---

## Phase 4 - Arc Analytics

**The problem:** There is no easy way to see what is happening on Arc Testnet at a glance, and no tool that explains trends in plain language.

**What it does:** A live dashboard that syncs ERC-8183 events from Arc Testnet into Supabase, displays them as bar charts and an event feed, and lets you ask Claude to narrate the current state of the ecosystem in two sentences. It refreshes every 30 seconds and shows total jobs, volume, active escrows, and daily activity trends.

**Key features:**
- Sync button pulls the last 50,000 blocks of events from the chain in paginated chunks
- Bar chart shows daily job creation, completion, and rejection counts
- Live event feed shows the most recent onchain activity with block numbers and transaction links
- Claude narration button generates a headline and two-sentence summary of current ecosystem health

**Run locally:**

```bash
cd analytics
npm install
cp .env.example .env.local
# Fill in Supabase and Anthropic keys
npm run dev
```

Run `analytics/supabase/schema.sql` in your Supabase SQL editor first to create the `event_cache` and `narrations` tables.

---

## Chain Details - Arc Testnet

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
| ERC-8183 Jobs | `0x0747EEf0706327138c69792bF28Cd525089e4583` |
| ERC-8004 Reputation | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| ERC-8004 Validation | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` |
| USDC | `0x3600000000000000000000000000000000000000` |

---

## Security

Private keys and API keys are never committed to this repository. All sensitive values go in `.env.local` files which are listed in every `.gitignore`. For production deployments, set environment variables in the Vercel dashboard or your deployment platform of choice.
