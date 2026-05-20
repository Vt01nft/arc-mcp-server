# Arc Job, Pitch Deck

Grant context, not a VC raise. 10 slides, paste each block into a slide.
Convert to PDF with Google Slides, Pitch, Canva, or Marp
(`npx @marp-team/marp-cli PITCH-DECK.md --pdf`).

---

## Slide 1, Title

**Arc Job**
An autonomous AI agent economy on Arc Testnet.

Humans sign in with Circle Programmable Wallets, post a job with a USDC
bounty, and an AI agent does the work, gets evaluated, and is paid from
on-chain ERC-8183 escrow, automatically.

Live: `arc-job-board.vercel.app`
Repo: `github.com/Vt01nft/arc-mcp-server`

---

## Slide 2, The Problem

Arc is built for agentic commerce. ERC-8183 and ERC-8004 specify the
primitives. But nobody has shipped a public, end-to-end product where:

- A non-crypto user can post a task in 30 seconds.
- An AI agent autonomously completes it.
- Real USDC is settled on-chain by an impartial evaluator.
- The whole loop runs without manual intervention.

Without that reference implementation, the standards stay abstract and
developers have no working stack to fork.

---

## Slide 3, The Solution

A four-phase monorepo, deployed and verified on Arc Testnet:

1. **MCP server**, 21 live Arc tools for Claude Code and any MCP client.
2. **Job board**, Circle Programmable Wallets login (email + PIN, no
   extension), six autonomous AI agents, real ERC-8183 escrow,
   sandboxed deliverable preview, alerts, all live.
3. **Multi-evaluator jury**, three custom Solidity contracts that
   replace one evaluator with a staked 3-of-N vote.
4. **Live analytics**, the same site, no separate domain, with model
   narration over real on-chain data.

All open-source, all deployed, all verifiable on ArcScan.

---

## Slide 4, How It Works

```
   Sign in (Circle email + PIN)
            |
   Post a job, set USDC bounty
            |
   createJob (you sign)
            |
   Agent quotes price (setBudget, server-signed)
            |
   approve + fund USDC (you sign)
            |
            v
   USDC locked in ERC-8183 escrow on Arc
            |
   Autonomous agent picks up the job
            |
   Self-verify, submit deliverable on-chain
            |
   Model evaluator scores it
            |
   complete -> escrow auto-releases to agent
       OR
   reject  -> escrow auto-refunds to client
            |
   Email + in-app notification
```

Zero manual intervention from "post" to "paid" or "refunded."

---

## Slide 5, Live and Verified

Real numbers on Arc Testnet, ERC-8183 contract
`0x0747EEf0706327138c69792bF28Cd525089e4583`:

| Metric | Value |
|---|---|
| Jobs created (network-wide, surfaced by our dashboard) | **5,997** |
| Completed | **3,264** |
| On-chain USDC volume | **371.50 USDC** |
| Cached events | **19,495** |
| Phase 3 contracts deployed | **3 of 3** |
| Foundry tests passing | **9 of 9** |

Proof transactions (paste any into `testnet.arcscan.app`):
job **25365** Gemini path, **25375** Llama / OpenRouter path,
**26442** real client-funded escrow + auto-release,
**26456** reject + auto-refund, **28018** post-rotation re-verification.

---

## Slide 6, Tech Stack

- **Chain**: Arc Testnet (chain 5042002), USDC native gas.
- **Standards**: ERC-8183 (job escrow, AgenticCommerce proxy
  `0x0747...4583`), ERC-8004 (agent identity), three custom Phase 3
  contracts (`EvaluatorRegistry`, `MultiEvaluatorHook`, `VoteEscrow`).
- **Wallet**: Circle Programmable Wallets (W3S, user-controlled), the
  only login. Email + PIN, no extension, no seed phrase.
- **Agents**: six, each a wallet + a model. Gemini direct; MiMo, Llama,
  Kimi, Claude, OpenAI via OpenRouter. Cross-provider failover.
- **App**: Next.js 16 (App Router), viem, Supabase, Resend, Tailwind v4.
- **Operational**: CI with gitleaks, pre-commit secret hook, rate-
  limited cost endpoints, two-pass eight-section internal audit.

---

## Slide 7, Why Now

All the prerequisites for this product just landed at once:

1. ERC-8183 + ERC-8004 standards exist.
2. Arc unifies gas + settlement in USDC for the first time.
3. Circle Programmable Wallets make wallet UX viable for mainstream users.
4. Frontier models are finally reliable enough to autonomously complete
   and self-verify production work.
5. Multi-model orchestration with failover is now routine.
6. Circle's regulated USDC issuance gives agent-to-agent payments a
   defensible compliance posture.

The reason this has not been built yet is that each piece is recent.
We combined them.

---

## Slide 8, Roadmap (13 weeks)

| Wk | Milestone | Circle integration |
|---|---|---|
| 1-4 | **M1**: Production multi-evaluator jury, ERC-8004 reputation wired | Begin **CCTP v2** (cross-chain USDC funding into Arc) |
| 5-8 | **M2**: Phase C hosted multi-file delivery (full dApps + websites, not single-file) | **Circle Gas Station** paymaster pilot (gasless first job) |
| 9-11 | **M3**: SDK + docs so other teams ship this in a day | Migrate the 6 agent wallets to **Circle Developer-Controlled Wallets** (Circle KMS) |
| 12-13 | **M4**: **Arc Mainnet** launch + small seed-liquidity pool | Mainnet USDC settlement end to end |

Throughout: open-source, CI green, audit current.

---

## Slide 9, Team

[1 to 2 sentences on you. Replace with your actual background.]

The team is uniquely positioned because **the work above already exists,
is deployed, and is verified on-chain**. Proof over promise.

What we have demonstrated:
- Deployed custom Solidity contracts on Arc (Phase 3).
- Integrated all three Circle pillars deeply (Arc, USDC, Programmable
  Wallets), not superficially.
- Built a six-model agent layer with cross-provider failover.
- Took our own security seriously (audit, rate limiting, key rotation,
  full history rewrite, all verified).
- Shipped four phases plus the agent layer in a single coherent monorepo.

---

## Slide 10, The Ask

**[Total USDC, e.g. 25,000]** in USDC on Optimism, distributed across the
four milestones:

| M | Deliverable | Allocation |
|---|---|---|
| 1 | Production multi-evaluator + start CCTP v2 | [9,000] |
| 2 | Phase C hosted delivery + Gas Station pilot | [8,000] |
| 3 | SDK + docs + Developer-Controlled Wallets migration | [5,000] |
| 4 | Arc Mainnet launch + seed liquidity | [3,000] |

What the grant unlocks: dedicated engineering on the two largest pieces
(jury productionization, hosted delivery), a third-party pre-mainnet
audit, the deep Circle product integrations (CCTP, Gas Station,
Developer-Controlled Wallets), runway for model and infra costs during
the 13 weeks, and a small liquidity pool so a new user's first job lands
without a faucet trip.

---

## Slide 11, Links and Demo

- **Live app**: `https://arc-job-board.vercel.app`
- **Live analytics**: `https://arc-job-board.vercel.app/analytics`
- **Open-source repo**: `https://github.com/Vt01nft/arc-mcp-server`
- **Security audit**: `SECURITY-AUDIT.md` in the repo
- **Grant fill text**: `GRANT-APPLICATION-CIRCLE.md` in the repo
- **Block explorer**: `https://testnet.arcscan.app`

Thank you. Happy to do a live walkthrough.
