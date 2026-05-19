# Security Audit, Arc Ecosystem

Date: 2026-05-19. Scope: the whole monorepo, with focus on `job-board` (the
only app that takes user input, holds keys, signs transactions, and calls
paid model APIs). Method: the project's own two-pass methodology (discovery,
then the eight-section checklist), severity tagged CRITICAL / HIGH / MEDIUM /
LOW / PASS.

## Summary

Overall posture: solid for a testnet project. No active data exposure, no
auth bypass, no anon database writes, no server secret shipped to the
browser. The one real historical issue (a committed testnet key) is already
mitigated in code and history and only awaits a wallet rotation decision.
The cost-abuse surface (unauthenticated model and chain-writing endpoints)
is now rate limited.

## 1. Environment and secrets

- PASS: `.env`, `*.env`, `.env.local`, `.env.*.local` are gitignored at the
  repo root and `job-board/.gitignore` (`.env*`). Verified `git check-ignore`.
- PASS: no server secret is exposed through `NEXT_PUBLIC_`. The only public
  vars are the Arc RPC URL, Circle app id, Supabase URL, Supabase anon key,
  and the WalletConnect project id, all of which are designed to be public.
- HIGH (mitigated, rotation pending): a real testnet `PRIVATE_KEY` was once
  committed in `.env.example`. Git history was rewritten with
  `git-filter-repo` and force pushed (0 commits now contain it), and the file
  is blank. A history rewrite does not un-leak a public value, so the
  remaining action is rotating that wallet (deployer / evaluator / funder,
  testnet only). Tracked, owner decision.
- PASS: a dedicated faucet wallet is isolated from the deployer/evaluator key.
- ADDED: a pre-commit hook (`.githooks/pre-commit`) blocks committing env
  files and 64-hex keys / common secret prefixes, and CI runs gitleaks on
  every push and PR (`.github/workflows/ci.yml`).

## 2. Database (Supabase)

- PASS: row-level security is enabled and anonymous writes are rejected.
  Verified live: anon `POST` to `jobs` and `notifications` both return 401.
- PASS: the service-role key is only used server-side (`getServiceClient`),
  never imported into a client component.
- PASS: read-only public tables (`notifications`, `event_cache`) expose only
  non-sensitive columns and are read with the anon key.
- PASS: no string-concatenated SQL anywhere; all access is via the Supabase
  client (parameterized) or the typed REST layer.

## 3. Auth and sessions

- PASS: the only login is Circle W3S user-controlled wallets. The private
  key never leaves Circle; the server only mints session tokens and builds
  challenges. Tokens are re-minted before signing and not persisted beyond
  `sessionStorage`.
- MEDIUM (by design): the agent and model endpoints are intentionally
  unauthenticated so the autonomous loop can run without a logged-in user.
  They are constrained instead (see sections 4 and 6).

## 4. Server-side validation

- PASS: `/api/agent/set-budget` is guarded, the provider must be a known
  agent wallet, the job must be Open, the budget previously unset, and the
  amount is bounded (0 < x <= 1000).
- PASS: `/api/agent/run` is idempotent, it refuses jobs whose provider is not
  an agent wallet and jobs already past Open/Funded, so it cannot re-settle
  or double-pay. It never auto-rejects on an evaluator timeout (funds are
  never destroyed by our failure).
- PASS: identity for on-chain actions comes from server-held agent/evaluator
  keys and the on-chain job record, not from request bodies.
- PASS: `fetchTarget` (audit jobs) only fetches the URL in the brief and
  bounds the response to 12k chars; no SSRF beyond a bounded GET, no eval.
- PASS: model prompts label external numbers as untrusted and instruct the
  model not to follow embedded instructions (prompt-injection hardening on
  the narrate path).

## 5. Dependencies

- MEDIUM: `npm audit` reports 14 issues (0 critical, 1 high, 13 moderate),
  all in the build/dev toolchain transitive tree, none in runtime request
  paths. Not auto-fixed because `--force` pulls breaking majors. Action:
  review and bump on the next maintenance pass.
- PASS: lockfile committed, no hallucinated or typosquatted packages, model
  access is plain `fetch` (no risky SDK surface).

## 6. Rate limiting

- WAS: `/api/agent/run`, `/api/agent/set-budget`, `/api/route-agent`,
  `/api/evaluate`, `/api/analytics/narrate`, `/api/analytics/sync` were
  unauthenticated with no throttle, a cost-drain and gas-drain vector.
- FIXED: added `lib/ratelimit.ts` (in-memory sliding window per IP) and
  applied a per-endpoint limit to every one of them (12/min for the
  chain-writing routes, 10 to 20/min for model routes, 8/min for sync). This
  is a strong burst guard with zero added latency. Recommendation for
  production scale: back it with Upstash/Redis for a hard global quota.
- PASS: the faucet already had per-address (1/24h) and per-IP (3/h) limits.

## 7. CORS

- PASS: all routes are same-origin Next.js route handlers. No `Access-
  Control-Allow-Origin: *`, no credentialed cross-origin surface.

## 8. File upload

- N/A: the app accepts no file uploads. Deliverables are text persisted
  server-side; the job page renders HTML only inside a sandboxed iframe
  (`sandbox="allow-scripts"`, no `allow-same-origin`), so a malicious
  deliverable cannot touch the parent page or cookies.

## Already done right

Sandboxed deliverable preview, idempotent settlement, non-destructive
evaluator-timeout handling, RLS enforced, secrets gitignored, dedicated
faucet wallet, Gemini-to-OpenRouter failover, prompt-injection notes,
bounded external fetches, history scrubbed plus pre-commit and CI secret
scanning.

## Prioritized remediation

1. HIGH: rotate the historically committed testnet wallet (owner decision).
2. MEDIUM: review and bump the 14 `npm audit` advisories on a maintenance pass.
3. LOW: move the rate limiter to Redis if traffic warrants a hard global cap.
4. LOW: revoke the unused `SUPABASE_TOKEN_KEY` (no longer needed post-DDL).
