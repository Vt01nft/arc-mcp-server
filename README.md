# Arc Ecosystem

Open source infrastructure for [Arc Network](https://arc.network) — a stablecoin-native L1 blockchain by Circle where USDC is the native gas token.

Built as part of the [Arc Architects Program](https://arc.network/architects).

---

## Phases

| Phase | Directory | Description | Status |
|---|---|---|---|
| 1 | [`/`](.) | **arc-mcp-server** — 21 MCP tools for live Arc Testnet access | Shipped |
| 2 | [`/job-board`](./job-board) | **arc-job-board** — Next.js job marketplace with Claude evaluator | Complete |
| 3 | [`/multi-evaluator`](./multi-evaluator) | **arc-multi-evaluator** — 3-agent jury hook for ERC-8183 (Foundry) | Contracts written |
| 4 | [`/analytics`](./analytics) | **arc-analytics** — Real-time dashboard with Claude narration | Complete |

---

## Phase 1 — arc-mcp-server

Gives Claude Code (and any MCP client) direct access to Arc Testnet.

**21 tools:** chain reads, USDC transfers, full ERC-8183 job lifecycle, ERC-8004 reputation/validation, events.

### Quick start

```bash
npm install && npm run build
claude mcp add arc-live node /abs/path/to/dist/index.js
```

Then in Claude Code: `arc_get_gas_price`, `arc_create_job`, `arc_get_reputation`, etc.

### Test against live chain

```bash
node test.mjs
```

---

## Phase 2 — job-board

Next.js 15 marketplace — browse, post, and evaluate ERC-8183 jobs with USDC bounties.

```bash
cd job-board && npm install && cp .env.example .env.local
# Fill in env vars, then:
npm run dev
```

**Deploy:** Vercel + Supabase. See [job-board/README.md](./job-board/README.md).

---

## Phase 3 — multi-evaluator

Foundry contracts replacing single evaluators with a 3-agent jury system.

```bash
cd multi-evaluator
# Install Foundry: https://getfoundry.sh
forge install foundry-rs/forge-std
forge build
forge test

# Deploy to Arc Testnet:
forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast --private-key $PRIVATE_KEY
```

Contracts:
- `MultiEvaluatorHook.sol` — ERC-8183 hook, 2-of-3 jury voting, 5% fee split
- `EvaluatorRegistry.sol` — Stake registry, slash/reward logic
- `VoteEscrow.sol` — Time-locked stake for boosted jury weight

---

## Phase 4 — analytics

Next.js + Recharts live dashboard for ERC-8183 activity, Claude-narrated.

```bash
cd analytics && npm install && cp .env.example .env.local
# Fill in Supabase + Anthropic keys, then:
npm run dev
```

**Deploy:** Vercel + Supabase. Run schema from `analytics/supabase/schema.sql`.

---

## Chain Context — Arc Testnet

| | |
|---|---|
| Chain ID | 5042002 |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| Gas token | USDC (18 decimals native, 6 decimals ERC-20) |
| ERC-8183 Jobs | `0x0747EEf0706327138c69792bF28Cd525089e4583` |
| ERC-8004 Reputation | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| ERC-8004 Validation | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` |
| USDC | `0x3600000000000000000000000000000000000000` |

---

## Security

- `.env` is always in `.gitignore` — never commit private keys or API keys
- Set all environment variables in Vercel/deployment dashboard
- All repos are public under [github.com/Vt01nft](https://github.com/Vt01nft)
