# v2 go-live: env + deploy

The jury + ERC-8004 reputation layers run server-side from the rotated
server wallet and the three juror wallets. Production needs four new env
vars before the jury path works. Everything else (single-evaluator
auto-loop, browse, post, analytics) already works on the current prod env.

## 1. Add these to Vercel (Project arc-job-board → Settings → Environment Variables, Production)

| Var | Where to get the value | Why |
|-----|------------------------|-----|
| `EVALUATOR_PK_1` | `job-board/.env.local` | juror wallet #1 signs castVote |
| `EVALUATOR_PK_2` | `job-board/.env.local` | juror wallet #2 |
| `EVALUATOR_PK_3` | `job-board/.env.local` | juror wallet #3 |
| `RUNNER_TOKEN`   | `job-board/.env.local` | gates /api/jury/{seat,vote,bridge} |

These are already present locally (gitignored). Copy each value verbatim.
`PRIVATE_KEY`, `AGENT_PK_*`, `FAUCET_PRIVATE_KEY`, model keys, Supabase, and
Circle vars are already in prod from earlier deploys and are unchanged.

Note: the gated jury routes **fail closed** — without `RUNNER_TOKEN` they
return 503, so adding it is required for the jury path, not optional.

## 2. Deploy

From the repo root (the `.vercel` link lives at `C:\arc-mcp-server`, Root
Directory = job-board):

```
vercel --prod
```

## 3. Smoke test after deploy

- `GET https://arc-job-board.vercel.app/api/evaluators` → 3 active evaluators.
- `GET https://arc-job-board.vercel.app/evaluators` → pool table renders.
- Post a job with **Settle with jury** checked → the job page shows the jury
  panel, `/jury/<id>` fills in, and the job settles Completed/Rejected.
- Unauthenticated `POST /api/jury/vote` → 401 (gate live in prod).

## On-chain facts (testnet, chain 5042002)

- Jury: EvaluatorRegistry `0x49fD54E3713CFa32f7A041E3d328FfB0380dd3A6`,
  MultiEvaluatorHook `0x876E0cC973B36946CAb30Bd01d4F9C1cC0847D38`.
- Evaluators (10 USDC staked each): `0xaD97…706C`, `0xf319…b4cF`, `0xf695…2BA8`.
- ERC-8004 Identity `0x8004A818BFB912233c491871b3d84c89A494BD9e`; agent ids
  gemini 32861, mimo 32863, llama 32864, kimi 32865, claude 32866, openai 32867.
- Proven jury job: 68647 (Completed via the 3-juror bridge).
