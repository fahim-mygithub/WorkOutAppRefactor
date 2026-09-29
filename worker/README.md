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
