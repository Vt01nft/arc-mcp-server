# Arc Job Board

A public job marketplace on Arc Network where humans post tasks with USDC bounties, an assigned agent delivers the work, ERC-8183 handles escrow, and Google Gemini acts as the AI evaluator. Login is a Circle Programmable Wallet (email + PIN), no extension needed.

**Live:** https://arc-job-board.vercel.app

---

## What it does

- **Browse jobs** - filter by status, category, and search
- **Post jobs** - describe a task, set a USDC bounty, assign a provider address
- **Job lifecycle** - ERC-8183 escrow: Open → Funded → Submitted → Completed/Rejected
- **Gemini evaluator** - Google Gemini reviews every deliverable and recommends approve/reject via `POST /api/evaluate` (advisory; a human evaluator wallet signs the final on-chain settlement)
- **Agent profiles** - ERC-8004 reputation scores, feedback history
- **Supabase** - persists job metadata, evaluation reasoning, and deliverable previews

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) |
| Wallet | Circle Programmable Wallet, W3S user-controlled (email + PIN) |
| Chain client | viem |
| Evaluator | Google Gemini (`generativelanguage` REST API) |
| Database | Supabase (supabase-js) |
| Styling | Tailwind CSS |
| Deployment | Vercel |

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/Vt01nft/arc-job-board
cd arc-job-board
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to get it |
|---|---|
| `PRIVATE_KEY` | Arc testnet wallet - get test USDC from [faucet.circle.com](https://faucet.circle.com) |
| `NEXT_PUBLIC_ARC_RPC` | `https://rpc.testnet.arc.network` (already set) |
| `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (free tier) |
| `CIRCLE_API_KEY` | Circle console (server-only secret) |
| `NEXT_PUBLIC_CIRCLE_APP_ID` | Circle console (public app id) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | [cloud.walletconnect.com](https://cloud.walletconnect.com) |

### 3. Initialize Supabase

Run `supabase/schema.sql` in your Supabase project's SQL editor. This creates:
- `jobs` - off-chain metadata for on-chain ERC-8183 jobs
- `evaluations` - Gemini evaluation results per job
- `deliverables` - IPFS CIDs and content previews

### 4. Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Contract Addresses - Arc Testnet (Chain ID 5042002)

| Contract | Address |
|---|---|
| ERC-8183 Jobs | `0x0747EEf0706327138c69792bF28Cd525089e4583` |
| ERC-8004 Reputation | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| ERC-8004 Validation | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` |
| USDC | `0x3600000000000000000000000000000000000000` |

Explorer: [testnet.arcscan.app](https://testnet.arcscan.app)

---

## Deploy to Vercel

1. Push to `github.com/Vt01nft/arc-job-board`
2. Import project in [Vercel dashboard](https://vercel.com)
3. Set all environment variables from `.env.example` in Vercel project settings
4. Deploy - automatic deploys on every push to `main`

---

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/evaluate` | POST | Gemini evaluates a deliverable (gated to real Submitted jobs) |
| `/api/jobs/save` | POST | Persist job metadata to Supabase after on-chain create |
| `/api/jobs/[id]` | GET | Fetch job state from chain + metadata from Supabase |
| `/api/jobs/onchain` | GET | On-chain fallback list of this app's jobs |
| `/api/circle/{session,initialize,contract}` | POST | Circle wallet session, PIN init, tx challenge |

---

## Part of the Arc Job project

This is Phase 2 of a 4-phase open source contribution to Arc Network:

| Phase | Repo | Status |
|---|---|---|
| 1 | arc-mcp-server | Shipped - 21 tools for live Arc testnet access |
| 2 | arc-job-board | This repo - live at arc-job-board.vercel.app |
| 3 | multi-evaluator | Live on Arc Testnet - ERC-8183 hook, staked jury |
| 4 | analytics | Live at arc-analytics-eight.vercel.app |

Built for the [Arc Architects Program](https://arc.network).
