# workout-ai-worker

Cloudflare Worker that backs the WorkoutApp AI coach. It is the only place the
Anthropic API key lives. It verifies the caller's Firebase ID token, checks an
email allow-list and a daily limit (Workers KV), and serves the `chat`,
`readLift` and `findExercise` actions.

Separate package — not part of the root app build, lint or test run.

```bash
npm install
npm test            # vitest
npm run typecheck   # tsc --noEmit
npm run dev         # wrangler dev (local only)
```

## Deploying

Done by the owner — see Phase 9 of `docs/plans/2026-09-29-ai-coach.md`
(`wrangler login`, KV namespace id in `wrangler.toml`, the two secrets below,
`wrangler deploy`). Prerequisites and gotchas:

- **Web search must be on.** `findExercise` uses Anthropic's server web search
  tool: enable the web search tool for your organization in the Console
  (Settings → Privacy / Tools), or every lookup fails.
- **Secrets, not vars.** Set both with `wrangler secret put` — never in
  `wrangler.toml`, which is in a public repo:
  - `ANTHROPIC_API_KEY` — the API key.
  - `AI_ALLOWED_EMAILS` — comma-separated emails allowed to use AI
    (`me@example.com,pal@example.com`). Unset means nobody is allowed.
- `AI_DAILY_LIMIT` (in `[vars]`) is calls per user per day; `0` turns AI off.
- `ALLOWED_ORIGINS` lists the sites that may call the Worker (GitHub Pages,
  the Firebase Hosting domains, and `http://localhost:5290`).
- The app finds the Worker through `VITE_AI_URL` in the root `.env.production`,
  which is committed and holds only that (non-secret) URL.

## Evals (manual, costs a few cents)

Run `npm --prefix worker run eval` after changing prompts or models. It sends
the cases in `evals/lift-entries.json` (readLift) and `evals/missed-reps.json`
(chat, missed reps) to the real API and prints a pass/fail table:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm --prefix worker run eval
```

Only the fields listed in each case's `expect` are compared (numbers exactly,
strings case-insensitively; `"question": true` means a clarifying question was
asked). Chat cases pass when every `expectTools` name is called, at least
one `expectAnyTools` name is (when given), and no `forbidTools` name is. Chat cases name a shared context from the `contexts`
map in the same file. Without the key the runner prints a note and exits;
it always exits 0 and never runs in `npm test` or CI.
