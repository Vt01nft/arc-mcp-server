# Circle Grant Application, Questbook Fill

Form URL: https://circle.questbook.app/proposal_form/?grantId=6992785dfb7e884efacadb1e&chainId=10

Questbook's form is JS-rendered so the exact field labels cannot be read
remotely. The sections below cover the platform's standard proposal fields.
Paste each block into the matching field; only the placeholders in
`[brackets]` need your input.

---

## Project Name

Arc Ecosystem

## Applicant / Team Name

[Your name or team name, e.g. "Vt01"]

## Email

vt01nfts@gmail.com

## Payment address (Optimism, USDC)

[Your Optimism mainnet wallet address. The grant chain is OP (chainId 10),
so this needs to be a mainnet OP-supporting wallet, not your Arc Testnet
Circle wallet. If you do not have one yet, create one and paste it here.]

## Project link

- Live job board: https://arc-job-board.vercel.app
- Live analytics (same site, /analytics): https://arc-job-board.vercel.app/analytics
- GitHub: https://github.com/Vt01nft/arc-mcp-server

## TL;DR / Summary (1 to 2 sentences)

Arc Ecosystem is a working, open-source autonomous AI agent economy on Arc
Testnet: humans sign in with Circle Programmable Wallets, post a job with a
USDC bounty, and an autonomous AI agent does the work, gets evaluated, and is
paid from on-chain ERC-8183 escrow with no manual intervention.

## Problem

Arc is a stablecoin-native L1 built for agentic commerce, and ERC-8183 and
ERC-8004 specify the primitives, but nobody has shipped a public,
end-to-end product where a person can post a task, have an AI agent
actually complete it, and have real USDC settled by an impartial evaluator,
with no crypto wallet setup required. Without that, the standards stay
abstract and developers have no reference implementation to fork.

## Solution

A four-phase monorepo, deployed and verified on Arc Testnet, that turns
Arc's primitives into a usable product:

1. **MCP server** giving Claude Code and any MCP client 21 live Arc tools.
2. **Job board** with Circle Programmable Wallet sign-in (email plus a
   PIN, no extension), six autonomous AI agents (Gemini direct, MiMo,
   Llama, Kimi, Claude, OpenAI via OpenRouter), client-funded ERC-8183
   escrow that auto-releases on approval and auto-refunds on rejection,
   sandboxed deliverable preview and download, in-app and email alerts.
3. **Multi-evaluator jury** contracts that replace a single evaluator
   with a 3-of-N staked jury (registry, hook, time-locked vote escrow).
4. **Analytics dashboard** living as a route on the main site (no
   separate domain), synced on-chain into Supabase, with an honest
   event-type funnel and a Gemini narration with OpenRouter failover.

## Live, on-chain proof

Every link below opens a real transaction on ArcScan
(https://testnet.arcscan.app):

| What | Job | Result |
|---|---|---|
| Full Gemini agent loop | 25365 | Completed, agent paid 0.999 USDC |
| Full Llama (OpenRouter) loop | 25375 | Completed, agent paid |
| Reject branch, contract auto-refund | 26456 | Client got 0.498 of 0.5 back |
| Real client-funded escrow + auto-release | 26442 | Client debited 1.01, agent received 0.999 from escrow |
| Standing-allowance proof, repeat posts are 2 PINs | 26550 | Allowance held at ~1,000,000 after one fund |
| End-to-end after wallet rotation | 28018 | Completed with the fresh evaluator key |

Aggregate live state on the public dashboard right now: **5,997 jobs
created, 3,264 completed, 371.50 USDC volume, 19,495 events cached**.

## Team

- [Your name], builder. GitHub https://github.com/Vt01nft .
  [Add 1 to 2 sentences on background. If you want me to draft this,
  tell me your role and any prior experience to mention.]

## Milestones

**Milestone 1, Production multi-evaluator** (4 weeks)
Ship the Phase 3 jury contracts as the default settler on the job board,
write client UI for jury voting, wire reputation feedback into ERC-8004,
audit the new flow.

**Milestone 2, Phase C hosted multi-file delivery** (4 weeks)
Build a deliverable host so an agent can ship a full dApp or website (not
just one file) and the poster gets a live preview URL. This removes the
single-file 300s ceiling and unlocks larger jobs.

**Milestone 3, SDK and docs** (3 weeks)
Publish an SDK and a developer guide so any team can drop the autonomous
agent loop into their own Arc app in under a day, with examples.

**Milestone 4, Mainnet launch and seed liquidity** (2 weeks)
Move the contracts and faucet wallet to Arc mainnet when available, run
a small liquidity pool that lets new users post their first job without a
faucet trip.

## Funding request (USDC, on Optimism)

Total ask: **[Your number, e.g. 25,000 USDC]**

Suggested split:
- Milestone 1: [9,000]
- Milestone 2: [8,000]
- Milestone 3: [5,000]
- Milestone 4: [3,000]

Adjust to match the grant program's bracket. If they ask for a single
number rather than per-milestone, use the total above.

## Why this grant (alignment with Circle / USDC)

- Uses Arc-native standards (ERC-8183 escrow, ERC-8004 identity) instead
  of a bespoke contract. The work generalizes for the whole ecosystem.
- Uses Circle Programmable Wallets as the only login, the email + PIN
  flow Circle is pushing. No browser extension, no seed phrase.
- Moves real USDC on every step (post, fund, payout, refund), not
  mocked. The analytics dashboard tracks aggregate USDC volume on-chain.
- The autonomous agent layer is the consumer of Arc the chain was built
  for, bots paying bots, settled in stablecoin, on-chain.

## Security and engineering posture

- A two-pass eight-section [SECURITY-AUDIT.md](SECURITY-AUDIT.md) is in
  the repo. Supabase RLS enforced, no server secrets in `NEXT_PUBLIC_`,
  every cost endpoint is rate limited, deliverables are sandboxed.
- CI on every push runs gitleaks and a full build. A pre-commit hook
  blocks env files and key-shaped strings locally.
- The testnet evaluator key was rotated, funds moved to a fresh wallet
  (`0xA296fF23B47cB85aD10fbDF2fB89c1041a2f8509`), Vercel and local env
  updated, full loop re-verified on-chain (job 28018).
- The autonomous loop never destroys completed work: an evaluator
  timeout leaves the job Submitted for review rather than auto-rejecting
  and refunding.

## Risks and mitigations

- Model provider outages: Gemini and OpenRouter both, with automatic
  failover for the evaluator path.
- Cost-abuse on unauthenticated endpoints: rate limiting on every
  model and chain-writing route, with a clear path to Redis-backed
  global limits for production scale.
- Jury sybil resistance (Phase 3): minimum stake plus time-locked vote
  escrow with up to 4x weight for longer locks. Slashing on wrong votes.

## Repository and license

Open source, MIT-licensed. https://github.com/Vt01nft/arc-mcp-server

## Anything else

The work above already exists, is deployed, and is verified on-chain. The
grant funds the hardening, mainnet transition, and SDK that turn a working
reference implementation into infrastructure other teams can build on.
