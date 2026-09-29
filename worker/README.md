# workout-ai-worker

Cloudflare Worker that backs the WorkoutApp AI coach. It is the only place the
Anthropic API key lives. It verifies the caller's Firebase ID token, checks an
email allow-list and a daily limit (Workers KV), and serves the `chat`,
`parse`, `readLift` and `findExercise` actions.

Separate package — not part of the root app build, lint or test run.

```bash
npm install
npm test            # vitest
npm run typecheck   # tsc --noEmit
npm run dev         # wrangler dev (local only)
```

Deploying (`wrangler login`, `wrangler secret put ANTHROPIC_API_KEY`,
`wrangler deploy`, KV namespace id in `wrangler.toml`) is done by the owner —
see Phase 9 of `docs/plans/2026-09-29-ai-coach.md`.

## Evals (manual, costs a few cents)

Run `npm --prefix worker run eval` after changing prompts or models. It sends
the cases in `evals/lift-entries.json` (readLift) and `evals/missed-reps.json`
(chat, missed reps) to the real API and prints a pass/fail table:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm --prefix worker run eval
```

Only the fields listed in each case's `expect` are compared (numbers exactly,
strings case-insensitively; `"question": true` means a clarifying question was
asked). Chat cases pass when every `expectTools` name is called and no
`forbidTools` name is. Chat cases name a shared context from the `contexts`
map in the same file. Without the key the runner prints a note and exits;
it always exits 0 and never runs in `npm test` or CI.
