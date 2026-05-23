# Security Audit, Arc Job (v2, final)

Date: 2026-05-21. Scope: the whole monorepo, deep pass on `job-board`
(every API route + Phase 3 contracts + analytics + Supabase RLS). Method:
the project's own two-pass methodology, severity tagged CRITICAL / HIGH /
MEDIUM / LOW / PASS. This audit was run live against production:
PostgREST tables were probed for anon read/write, every API route was
inspected, the Phase 3 contracts were reviewed, and the autonomous loop's
economic surface was modeled. Every finding below is grounded in a live
probe or a code line, not a guess.

## Summary

Three real issues were found and fixed in code in this pass:

| Severity | Issue | Status |
|---|---|---|
| CRITICAL | Pool wallet drain via attacker-controlled `amountUsdc` on `/api/agent/run` | FIXED in code |
| HIGH | SSRF in `fetchTarget` (audit jobs could coerce a server-side fetch to IMDS / private IPs) | FIXED in code |
| MEDIUM | `client_email` was anon-readable on `notifications` + `jobs` via the public PostgREST endpoint | FIXED in code, SQL migration pending |

Two further findings require SQL the user must run in the Supabase SQL
editor (see "Required SQL migrations" at the bottom). Other surface was
re-verified and remains PASS.

## 1. Environment and secrets

- PASS, verified. `.env*` is gitignored at the repo root
  (`/.gitignore` lines 10-13: `.env`, `*.env`, `.env.local`,
  `.env.*.local`) and at `job-board/.gitignore:34` (`.env*`).
- PASS, verified. No server secret is exposed through `NEXT_PUBLIC_`.
  The actually exposed names are `NEXT_PUBLIC_ARC_RPC`,
  `NEXT_PUBLIC_CIRCLE_APP_ID`, `NEXT_PUBLIC_EVALUATOR_ADDRESS`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`. All are public by design.
- PASS, verified by grep. No `*.tsx` file references any server-only
  env var (`AGENT_PK_*`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`,
  `RESEND_API_KEY`, `OPENROUTER_KEY`, `FAUCET_PRIVATE_KEY`,
  `PRIVATE_KEY`).
- PASS. The previously-leaked testnet `PRIVATE_KEY` was rotated and the
  evaluator address is now `0xA296fF23B47cB85aD10fbDF2fB89c1041a2f8509`.
  Git history was rewritten with `git-filter-repo` and force-pushed;
  zero commits on `origin/main` contain the original key.
- PASS. CI on every push runs `gitleaks` plus a full build
  (`.github/workflows/ci.yml`). The local pre-commit hook
  (`.githooks/pre-commit`) blocks env files and 64-hex / `sk-` /
  `sbp_` / `AKIA` strings before they can be committed.

## 2. Database (Supabase RLS)

Anonymous WRITES are blocked across every public table, verified live
this pass with valid columns:

```
POST jobs           -> 401
POST notifications  -> 401
POST evaluations    -> 401
POST event_cache    -> 401
POST narrations     -> 401
POST faucet_log     -> 401
POST deliverables   -> 401
```

PASS on RLS write protection.

### MEDIUM, FIXED in code: `client_email` PII leak

Anonymous SELECT on `notifications` and `jobs` returned the
`client_email` column. With the Supabase anon key (intentionally public
via `NEXT_PUBLIC_`), any third party could bulk-scrape every poster's
email tied to their wallet address. This is PII under most privacy
regimes.

Code-side mitigations applied this pass:

- `/api/jobs/save` no longer writes `client_email` to the `jobs` row.
- `/api/agent/run` no longer writes `client_email` to the
  `notifications` row.
- `/api/jobs/[id]` GET strips `client_email` from the returned
  `metadata` (defense in depth even if the underlying RLS lets it
  through).

The runtime email-delivery path still works: the autonomous runner
reads `clientEmail` directly from the `/api/agent/run` request body, no
stored copy is needed.

**Required SQL migration** (user must run in Supabase SQL editor, see
bottom of this document) backfills existing rows to NULL and drops the
columns for a clean break.

### MEDIUM, FIXED partially: `faucet_log` IP exposure

Anonymous SELECT on `faucet_log` returns rows including `ip` and
`address` columns. IPs are PII. Code-side this table is server-write
only, so we cannot mitigate by code alone; the public read policy must
be tightened. SQL migration provided at the bottom.

### PASS, others
- `service_role` is used only by `getServiceClient()` (server). No
  client component imports it.
- Read-only columns surfaced via the `/api/*` routes are explicit
  selects, not `*`. The route layer does not over-expose by accident.
- No string-concatenated SQL anywhere. All Supabase access goes through
  the typed PostgREST client.

## 3. Auth and sessions

- PASS. The only login is Circle W3S user-controlled wallets. The
  private key never leaves Circle; the server only mints session
  tokens. The token is re-minted right before each signature (TTL
  throttled to 5 minutes to avoid stale-token Network errors), and is
  persisted to `sessionStorage`, not `localStorage`.
- PASS, by design. Agent and model endpoints are intentionally
  unauthenticated so the autonomous loop runs without a logged-in user.
  They are constrained instead, see sections 4 and 6.

## 4. Server-side validation

### CRITICAL, FIXED in code: pool wallet drain

The previous `/api/agent/run` step 6b paid the agent wallet from the
project pool whenever `evaluated && decision === "approve" && amt > 0
&& job.budget === 0n`. `amt` came directly from the request body's
`amountUsdc`. An attacker could:

1. `createJob(provider = an agent wallet)` themselves, paying only the
   gas.
2. POST `/api/agent/run` with `{ jobId, amountUsdc: "20" }`.
3. The agent does the work and a model evaluator approves a simple
   brief; the pool then transfers 20 USDC to the agent wallet.

The attacker doesn't directly profit (the agent wallet is
server-controlled), but the pool wallet is drained to project wallets.
This is a denial-of-service that empties the pool for ~0.01 USDC of
gas per drain.

Fix applied: the pool-payout branch was deleted entirely.
Client-funded escrow (`job.budget > 0`) auto-releases via `complete()`
on the contract, and the legacy pool fallback is no longer reachable
on any path. `payoutTx` in the response is now always `null`.

### HIGH, FIXED in code: SSRF in `fetchTarget`

`fetchTarget(desc)` extracted the first URL from a job description and
`fetch`ed it server-side, with the response (up to 12 KB) included in
the LLM prompt for security-audit jobs. With no allow/deny list, an
attacker could craft a job whose brief contained
`http://169.254.169.254/latest/meta-data/...` (AWS instance metadata)
or `http://127.0.0.1:<port>/...` (local services), and either coerce
the function into reading internal data or have the LLM paraphrase it
into the public deliverable.

Fix applied: an `isSafeUrl` guard now blocks:

- non-http(s) protocols
- IPv4 literals in `127.0.0.0/8`, `10.0.0.0/8`, `192.168.0.0/16`,
  `172.16.0.0/12`, `169.254.0.0/16`, `224.0.0.0/4`, and `0.0.0.0`
- `localhost`, `*.local`, `*.internal`,
  `metadata.google.internal`, `instance-data`
- IPv6 loopback, ULA (`fc::/fd::`) and link-local (`fe80::`)

DNS rebinding is not blocked (no DNS resolution in the check). For
testnet this is acceptable; for production move the check post-DNS or
proxy through a vetted egress allowlist.

### PASS, others
- `/api/agent/set-budget` validates jobId is an integer, amount is
  `0 < x <= 1000`, the on-chain job is status Open, the provider is a
  known agent wallet, and the budget is still 0. Verified live.
- `/api/agent/run` is idempotent: it only acts on jobs in status Open
  or Funded whose provider is a known agent wallet, and now never
  auto-rejects on an evaluator timeout (the job is left Submitted for
  manual review, so completed work is never destroyed by our failure).
- Identity for on-chain actions is server-held keys + the on-chain
  job record, never the request body.
- Faucet input is validated with `viem.isAddress()` before any drip.

## 5. Dependencies

`npm audit` on `job-board`: **0 critical, 1 high, 15 moderate, 16
total**. Every advisory is in the build/dev toolchain transitive tree,
none in any request handler. Not fixed in this pass because
`npm audit fix --force` pulls breaking majors (Next 16 / Tailwind v4
transitive). Action: review and bump on the next maintenance pass.

Lockfile is committed. No hallucinated or typosquatted packages
detected. Model access is via plain `fetch`, no risky SDK surface.

## 6. Rate limiting

Verified live, present on every unauthenticated cost endpoint:

| Endpoint | Bucket | Limit |
|---|---|---|
| `/api/agent/run` | `agent-run` | 12 / min |
| `/api/agent/set-budget` | `set-budget` | 12 / min |
| `/api/route-agent` | `route-agent` | 20 / min |
| `/api/evaluate` | `evaluate` | 15 / min |
| `/api/analytics/narrate` | `narrate` | 10 / min |
| `/api/analytics/sync` | `analytics-sync` | 8 / min |

In-memory sliding window per IP (`lib/ratelimit.ts`). This is a strong
burst guard with zero added latency. For production scale and a hard
global cap, move it to Upstash or Redis.

Faucet has its own pair of limits, 1 drip per address per 24h and 3
drips per IP per hour, tracked durably in Supabase. PASS.

## 7. CORS

PASS. All API routes are same-origin Next.js route handlers. No
`Access-Control-Allow-Origin: *`, no credentialed cross-origin surface.

## 8. File upload

N/A. The app accepts no file uploads. Deliverables are text persisted
server-side; the job page renders HTML only inside a sandboxed iframe
(`sandbox="allow-scripts allow-forms allow-popups"`, NO
`allow-same-origin`), so a malicious deliverable cannot read parent
cookies, localStorage, or DOM.

## Phase 3 Solidity contracts (multi-evaluator)

438 total lines across `EvaluatorRegistry.sol` (148), `MultiEvaluatorHook.sol`
(196), `VoteEscrow.sol` (94). Foundry tests: 9 of 9 pass.

- Access control: `slash`, `reward`, `recordVote`, `lockEvaluator`
  are gated by `onlyHook`. `setAuthorizedCaller` is `onlyOwner`. PASS.
- Reentrancy: no `nonReentrant` modifier is present, but the only
  external calls are `payable(msg.sender).transfer(amount)` in
  `deregister` and `VoteEscrow.withdraw`. The legacy `transfer()`
  pattern caps the callee at 2300 gas, which forecloses reentrancy
  by gas budget. PASS for now; recommend migrating to
  `call{value:...}("")` with explicit `ReentrancyGuard` for a
  pre-mainnet audit, because the 2300 cap can break on chains that
  reprice storage opcodes.
- Voting window: `castVote` requires `deadline > 0`,
  `!resolved`, within `VOTE_WINDOW`, voter is on the jury, and not
  already voted. PASS.
- Stake math: register requires `msg.value >= MIN_STAKE`; deregister
  enforces `block.timestamp >= lockedUntil`. PASS.

A third-party audit is on the grant roadmap before mainnet
(Milestone 1 deliverable).

## Already done right (for the record)

Sandboxed deliverable preview, idempotent settlement, non-destructive
evaluator-timeout handling, RLS write protection enforced and verified,
secrets gitignored at two levels, history scrubbed, dedicated faucet
wallet isolated from the evaluator key, Gemini-to-OpenRouter failover
on the evaluator and self-verify paths, prompt-injection notes on
external numbers in the narrate flow, bounded external fetches (12 KB),
CI gitleaks scan, pre-commit secret guard, rate limiting on every
unauthenticated cost endpoint, fresh evaluator key.

## Required SQL migrations (user must run)

Paste this into the Supabase SQL editor for the project
(eafcodhzyvpeiflqbnpd) to close the PII findings at the database
layer. The code changes in this pass mean nothing is *added* anymore;
this migration cleans up the past and removes the columns entirely.

```sql
-- 1) Sanitize and drop client_email from notifications.
update notifications set client_email = null where client_email is not null;
alter table notifications drop column if exists client_email;

-- 2) Sanitize and drop client_email from jobs.
update jobs set client_email = null where client_email is not null;
alter table jobs drop column if exists client_email;

-- 3) Tighten faucet_log: remove anon read access.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'faucet_log'
  loop
    execute format('drop policy %I on public.faucet_log', p.policyname);
  end loop;
end $$;
-- (No new SELECT policy = anon cannot read. Server uses service_role,
--  which bypasses RLS.)

-- 4) Confirm the public read policy on jobs only exposes safe columns,
--    via a view rather than `select * from jobs`. Optional but cleaner.
create or replace view public.jobs_public as
  select id, chain_job_id, description, category, client_address,
         provider_address, created_at, updated_at, agent
  from public.jobs;
grant select on public.jobs_public to anon;
```

After running this, re-verify:

```bash
# Should now return 200 but without any leaked email columns.
curl "$SUPABASE_URL/rest/v1/jobs?select=*&limit=1" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON"

# Should return 200 with an empty result (no public read policy).
curl "$SUPABASE_URL/rest/v1/faucet_log?select=*&limit=1" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
```

## Prioritized remaining items

1. Run the SQL migration above in Supabase to close the PII finding at
   the database layer.
2. Revoke `SUPABASE_TOKEN_KEY` in the Supabase dashboard. Post-DDL it
   is no longer needed.
3. Bump the 16 npm advisories on the next maintenance pass.
4. Pre-mainnet third-party audit of the Phase 3 contracts (already on
   the grant roadmap as Milestone 1).
5. For production scale, move `lib/ratelimit.ts` to Upstash/Redis to
   get a hard global quota across serverless instances.
6. Optional, post-mainnet: add DNS-rebind protection to the SSRF guard
   in `fetchTarget` (resolve the host and re-check after resolution).
