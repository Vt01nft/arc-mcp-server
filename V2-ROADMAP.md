# Arc Job v2 Roadmap

Production-grade, mainnet-ready continuation of v1. Decided 2026-05-24.

## Decisions

- **Direction**: Option 1, finish the grant roadmap (jury, hosted delivery, CCTP, SDK, mainnet).
- **Audit**: Option C, no third-party audit. Rely on tests, internal audit (`SECURITY-AUDIT.md`), and code review. Revisit if grant funding lands.
- **Constraint**: ship without grant money. No paid services beyond what is already provisioned (Vercel, Supabase, model APIs).
- **Order**: Phase C → Jury → CCTP + protocol fee → SDK + docs.
- **Mainnet**: same code, same migrations, same flows. Flip when Arc Mainnet is GA.
- **Treasury wallet**: user holds the key, kept off the deployer/evaluator/faucet keys.

## Sprints

### Sprint 1, Phase C, hosted multi-file delivery (~2 weeks)

- **Storage**: Supabase Storage bucket `deliverables`, public read, service-role write. Reuses the existing Supabase project; no new dependency, no new credentials, no Vercel Blob.
- **Bundle format**: existing `=== path ===` markers in the agent output (no agent prompt change). Backwards compatible with single-file deliveries.
- **Runner change**: parse the marker format into a sanitized `files[]`, upload each file, compute a canonical manifest hash, submit that hash on-chain via `submit()`.
- **Job page change**: live preview iframe loads the entry file from its public storage URL inside `sandbox="allow-scripts"` (no `allow-same-origin`). "Download .zip" assembles the bundle in the browser.
- **Mainnet-safe**: same code path runs on mainnet; the storage bucket and the on-chain hash are network-agnostic.

### Sprint 2, jury as the default settler (~3 weeks)

- `MultiEvaluatorHook` becomes the `hook` argument on every `createJob`.
- Runner: after `submit()`, the hook auto-assigns three jurors. No single-evaluator `complete()`.
- New `/evaluators` page: staked pool, accuracy, current juries.
- New `/jury/[jobId]` page: each assigned juror signs their vote with their Circle wallet.
- ERC-8004 reputation updated on jury resolution.
- Seed 10 testnet evaluators from project-controlled wallets. Same enrollment flow real evaluators will use on mainnet.

### Sprint 3, CCTP v2 + protocol fee (~1.5 weeks)

- **CCTP v2**: post page detects no Arc USDC; offers "Fund from Optimism" (source burn + Arc mint, 2 PINs).
- **Protocol fee**: hook deducts 2.5% on settle, routes to the treasury wallet. Configurable; **0% on testnet, 2.5% on mainnet** flip-of-switch.
- Treasury wallet is the one the user already has.

### Sprint 4, SDK + docs (~1.5 weeks)

- `@arcjob/sdk` npm package: `postJob`, `signFund`, `runAgent`, `claimRefund` helpers.
- `/docs` route on the main site (no separate domain), MDX-generated.
- SDK license includes a small "Powered by Arc Job" attribution requirement, brand distribution as a moat.

## Sprint 1 acceptance criteria

A multi-file agent run must satisfy all of:

1. Every file in the agent's output is stored in Supabase Storage, accessible at a public URL.
2. The job page renders a live preview of the entry file in a sandboxed iframe.
3. "Download .zip" exports the whole bundle.
4. The on-chain `submit()` hash equals the canonical manifest hash (recomputable from storage).
5. Single-file deliveries continue to render and download unchanged.
6. No new dependencies in `package.json` beyond what is already pinned.
7. CI green, types clean.

## Out of scope for v2

- Circle Gas Station paymaster (operational, no near-term revenue impact).
- Circle Developer-Controlled Wallets for the agent fleet (operational only).
- Native token / governance (regulatory complexity not worth it pre-Series A).
- Option 3 from the planning conversation (open third-party agent marketplace), already covered by a friend's project per the user.
