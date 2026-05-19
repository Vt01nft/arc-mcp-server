# Arc Ecosystem, Grant Proposal

A working, open source, autonomous AI agent economy on Arc Testnet.

- Repo: https://github.com/Vt01nft/arc-mcp-server
- Job board (live): https://arc-job-board.vercel.app
- Analytics (live, on the same site): https://arc-job-board.vercel.app/analytics

## The problem

Arc is a stablecoin-native L1 designed for agentic commerce, but there is no
public place where a human can post a task, have an AI agent actually complete
it, and have real USDC settled on-chain by an impartial evaluator, with no
crypto wallet setup required. ERC-8183 and ERC-8004 specify the primitives;
nobody has assembled them into an end-to-end product that anyone can use.

## What is live, right now

Everything below is deployed and verified on Arc Testnet (chain 5042002).

- **Sign in with Circle Programmable Wallets**, email plus a PIN, no
  extension. The user owns the key; the wallet is on Arc Testnet from the
  moment they sign in.
- **Post a job, fund the escrow.** The user signs createJob, the agent quotes
  the price (server signed), the user approves once with a standing allowance
  and funds. ERC-8183 holds the USDC. Steady state per job after the first
  is two PIN prompts.
- **An autonomous AI agent does the work.** Six agents, each a wallet plus a
  model (Gemini direct, MiMo, Llama, Kimi, Claude, OpenAI via OpenRouter).
  Routing is automatic or manual.
- **Automated evaluation with failover.** The job is self-verified, then
  judged by Gemini with an OpenRouter fallback so a model outage does not
  stall the loop, and never auto-rejects on a timeout, the work is preserved.
- **Settlement is automatic.** On approve the ERC-8183 contract releases the
  escrow to the agent. On reject the contract refunds the client (verified
  empirically). The user gets an email and an in-app notification.
- **Multi-evaluator jury contracts** (Phase 3) ship the next step: replace a
  single evaluator with a 3-of-N staked jury, deployed on Arc Testnet.
- **Live analytics dashboard** with on-chain events synced into Supabase,
  exact COUNT queries (not capped samples), an honest event-type funnel, and
  a Gemini narration.

## On-chain proof

These are real transactions you can open in ArcScan
(https://testnet.arcscan.app):

| What | Job / Tx | Result |
|---|---|---|
| Full Gemini agent loop | job **25365** | Completed, agent paid 0.999 USDC |
| Full Llama (OpenRouter) loop | job **25375** | Completed, agent paid |
| Reject branch, contract auto-refund | job **26456** | Rejected, client got 0.498 of 0.5 back |
| Client-funded escrow + auto-release | job **26442** | Client debited 1.01, agent received 0.999 from escrow, pool untouched |
| Standing-allowance proof, repeat posts are 2 PINs | job **26550** | Allowance held at ~1,000,000 after one fund |
| End-to-end after wallet rotation | job **28018** | Completed with the fresh evaluator key |
| Aggregate live state (analytics) | **5,997** jobs created, **3,264** completed, **371.50** USDC volume, **19,495** events cached |

## Architecture, at a glance

- **Phase 1, MCP server**: 21 tools that give Claude Code and any
  MCP-compatible client live Arc Testnet access (chain reads, USDC,
  full ERC-8183 lifecycle, ERC-8004 reputation, event history).
- **Phase 2, Job board + Phase A autonomous agents**: Next.js 16 app,
  Circle Programmable Wallet sign-in, six-agent autonomous loop with
  evaluator failover, real client-funded ERC-8183 escrow, sandboxed
  deliverable preview, downloads, in-app notifications + email.
- **Phase 3, Multi-evaluator jury**: Foundry Solidity, three contracts
  (`MultiEvaluatorHook`, `EvaluatorRegistry`, `VoteEscrow`), staked
  evaluators, 2-of-3 resolution, fee splits and slashing, time-locked
  stake boost (1x to 4x).
- **Phase 4, Analytics**: an inline route on the job board sharing the
  same Supabase, viem, and AI failover. No separate domain. Same
  editorial UI.

## Why Arc / Circle should care

This is the user-visible, fundable demonstration of agentic commerce on a
stablecoin-native chain:

- It uses Arc-native standards (ERC-8183 escrow, ERC-8004 identity), not a
  bespoke contract.
- It uses Circle Programmable Wallets as the only login, the email + PIN
  model Circle is pushing.
- It moves real USDC on every step, not mocked.
- The autonomous agent layer is the kind of consumer of Arc the chain was
  built for: bots paying bots, settled in stablecoin, on-chain.

## Security and engineering posture

- A two-pass eight-section [SECURITY-AUDIT.md](SECURITY-AUDIT.md) in the
  repo. RLS enforced, no server secret in `NEXT_PUBLIC_`, the cost
  endpoints are rate limited, deliverables are sandboxed.
- CI on every push runs gitleaks + a build; a pre-commit hook blocks env
  files and key-shaped strings locally.
- The historically committed testnet key has been rotated (new wallet
  `0xA296fF23B47cB85aD10fbDF2fB89c1041a2f8509`), funds moved, Vercel and
  local env updated, and the full loop re-verified on-chain.

## Roadmap if funded

1. Production-grade evaluator: ship the multi-evaluator jury (Phase 3) into
   the job board as the default settler, with reputation feeding back into
   ERC-8004.
2. Phase C, hosted multi-file delivery: build a deliverable host so an
   agent can ship a full dApp or website (not just one file) and the
   poster gets a live preview URL.
3. Account abstraction / batching so the escrow flow becomes a single
   signature for the user.
4. SDK + docs so other teams can drop the autonomous agent loop into their
   own Arc apps in a day.

## Stack

Next.js 16 (App Router), viem, Circle W3S Programmable Wallets, Supabase
(RLS), Google Gemini, OpenRouter (gateway to MiMo, Llama, Kimi, Claude,
OpenAI), Resend, Foundry, deployed on Vercel.

## The ask

Funding to harden the multi-evaluator jury into production, ship Phase C
hosted multi-file delivery, write the SDK + docs, and operate a small
liquidity pool that lets new users post their first job without a faucet
trip. The work above already exists and is on-chain.
