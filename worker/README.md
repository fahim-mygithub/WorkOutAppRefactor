# workout-ai-worker

Cloudflare Worker that backs the WorkoutApp AI coach. It is the only place the
Anthropic API key lives. It verifies the caller's Firebase ID token, checks an
email allow-list and a daily limit (Workers KV), and serves the `chat`,
`readLift` and `findExercise` actions.

It also hosts the **Claude connector** (`/mcp`): a remote MCP server the Claude
app and Claude Code use to read and edit your workouts — see [Connector](#connector).

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

## Connector

A remote MCP server at `/mcp` (Streamable HTTP, stateless) behind OAuth 2.1, so
claude.ai (Settings → Connectors) and Claude Code can read and change your
profile, saved workouts, plans, history and custom exercises. Entry
`src/main.ts` sends `/mcp`, `/authorize`, `/oauth/token`, `/register` and
`/.well-known/*` to the connector and everything else to `src/index.ts`
unchanged.

- `src/data/` — Firestore REST client signed in as a service account; every
  path is `users/{uid}/…` with the uid from the OAuth grant, and documents are
  written in the exact shape the app's services read.
- `src/agentTools/` — the tool registry (zod inputs, model-facing
  descriptions): `get_profile`, `update_profile`, `list_workouts`,
  `get_workout`, `create_workout` (one or many), `update_workout`,
  `list_plans`, `plan_workout`, `list_history`, `add_exercise`.
- `src/mcp/` — the MCP server, the OAuth provider and the `/authorize` page
  (Google sign-in with the Firebase JS SDK; the ID token is checked with
  `verifyIdToken` and the email must be in `AI_ALLOWED_EMAILS`).

Packages: `@modelcontextprotocol/sdk` 1.32.2, `@cloudflare/workers-oauth-provider`
1.2.4, `@cfworker/json-schema` 4.1.4; Firebase JS SDK 11.10.0 (from gstatic, on
the sign-in page only).

### Deploy (owner)

1. **OAuth KV namespace:** `npx wrangler kv namespace create OAUTH_KV` and put
   the id in `wrangler.toml` (`binding = "OAUTH_KV"`).
2. **Service account:** Firebase console → Project settings → Service accounts
   → *Generate new private key*. Store the whole JSON file as a secret, then
   delete the file:

   ```bash
   npx wrangler secret put FIREBASE_SERVICE_ACCOUNT < path/to/key.json
   ```

   It bypasses Firestore rules; the Worker limits it to the signed-in uid.
3. **Sign-in domain:** Firebase console → Authentication → Settings →
   Authorized domains → add the Worker's host
   (`workout-ai.<your-subdomain>.workers.dev`), or the Google popup on
   `/authorize` fails with `auth/unauthorized-domain`.
4. **Allow-list:** your email must be in `AI_ALLOWED_EMAILS` (same secret as the
   AI coach). Removing an email cuts off its connector tokens on the next call.
5. `npx wrangler deploy`.

### Add it to Claude

- **claude.ai / Claude app:** Settings → Connectors → *Add custom connector* →
  URL `https://workout-ai.<your-subdomain>.workers.dev/mcp` → *Connect*. A
  window opens on the Worker: *Sign in with Google*, then *Allow*.
- **Claude Code:**

  ```bash
  claude mcp add --transport http workout https://workout-ai.<your-subdomain>.workers.dev/mcp
  ```

  then run `/mcp` inside Claude Code and pick `workout` to sign in.

Changes appear in the app the next time it loads its data (saved workouts and
custom exercises on their screens, plans when the planner syncs). Photos stay
in Claude: the connector takes fields, never images.
