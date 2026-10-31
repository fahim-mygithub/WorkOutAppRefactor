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
  `list_plans`, `plan_workout`, `list_history` (date range and paging), `get_history_entry`,
  `log_workout` (dictate past workouts with sets, exercise IDs and PR updates),
  `update_history_entry`, `add_exercise` (with duplicate detection and media_url),
  `search_exercises` (searches library + custom exercises), `update_exercise`,
  `attach_media_from_url`, and `create_media_upload_link`.
- `src/media/` — Cloudflare R2 media storage, magic-bytes sniffing, size validation,
  temporary upload token generation and mobile upload web handler.
- `src/mcp/` — the MCP server, the OAuth provider and the `/authorize` page
  (Google sign-in with the Firebase JS SDK; the ID token is checked with
  `verifyIdToken` and the email must be in `AI_ALLOWED_EMAILS`).

### History and Personal Records

- `log_workout` writes workout summaries to `workout_history`, individual exercise performances to `exercise_history`, and updates `exercise_stats` and per-doc `personalRecords` flags matching the app's `exerciseHistoryService.ts`. It generates `workoutId` upfront and writes the summary doc in a single write with its ID. Notes are stored per exercise (`exercises[].notes`) or per set (`exercises[].sets[].notes`), matching the app's data model (`workout_history` has no session-level notes field).
- **Exercise name resolution**: Exercise names are matched against the bundled index of 1,540 exercises (`public/exercises.json`) and the user's `customExercises` collection (checked first). Matches record canonical `exerciseId`, `muscleGroups`, and `equipment`. Unmatched exercises use deterministic `fallback-<hash>` IDs with `Unknown` muscle groups / equipment and are reported in tool output (`unmatchedExercises` and `fallbackNotice`) advising the user to define them via `add_exercise`.
- `update_history_entry` supports safe partial updates: omitting an existing exercise does **not** delete it. Exercises can be explicitly deleted with `removeExerciseIds: [...]` or `replaceAllExercises: true`. Sets support in-place edits or granular operations (`addSets: [...]`, `removeSetNumbers: [...]`).
- **Timezone support**: Both `log_workout` and `update_history_entry` accept optional `tz` (IANA timezone name) or `utcOffset` (minutes offset) to validate local dates and prevent future date entries.
- **Query efficiency**: `get_history_entry` queries `exercise_history` by `workoutId` without `orderBy`, sorting results in memory in the user's dictated exercise order to avoid Firestore composite index requirements.
- `update_history_entry` recomputes workout summary totals and recalculates overall `exercise_stats` for all affected exercises. Per-doc PR flags are updated for exercises in the edited workout. As in the app's own edit flow, per-document PR flags on other past workout records are not re-evaluated retroactively across the entire historical timeline.

Packages: `@modelcontextprotocol/sdk` 1.32.2, `@cloudflare/workers-oauth-provider`
1.2.4, `@cfworker/json-schema` 4.1.4; Firebase JS SDK 11.10.0 (from gstatic, on
the sign-in page only).

### Deploy (owner)

1. **OAuth KV namespace:** `npx wrangler kv namespace create OAUTH_KV` and put
   the id in `wrangler.toml` (`binding = "OAUTH_KV"`).
2. **Exercise Media R2 Bucket:** Create the R2 bucket for exercise demo media and photos:

   ```bash
   npx wrangler r2 bucket create workout-media
   ```

   Add the binding to `wrangler.toml`:
   ```toml
   [[r2_buckets]]
   binding = "EXERCISE_MEDIA"
   bucket_name = "workout-media"
   ```
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

### Media Storage & Snapshot-to-Log Tools

Custom exercise photos, GIFs, and videos are stored in Cloudflare R2 under bucket `workout-media` (`EXERCISE_MEDIA` binding).

- **Endpoints**:
  - `GET /media/<uid>/<id>.<ext>`: Serves exercise media with strong cache headers (`public, max-age=31536000, immutable`), `ALLOWED_ORIGINS` CORS headers, and HTTP 206 Partial Content support for video playback range requests in `<video>` / `<img>` elements. URLs end in the media extension (`.mp4`, `.webm`, `.gif`, `.jpg`, `.png`) so the app's media players recognize them immediately.
  - `POST /media`: Direct upload authenticated with Firebase ID token (`Authorization: Bearer <token>`). Validates type by sniffing file magic bytes (not request content-type header) and enforces strict file size caps:
    - **Photos** (JPEG, PNG, WebP, HEIC): <= 8 MB
    - **GIFs**: <= 15 MB
    - **Videos** (MP4, WebM, MOV): <= 60 MB
    - Daily upload count rate-limited per user via `AI_USAGE` KV.
  - Upload bodies (`POST /media`, `POST /upload/<token>`) are counted as they stream in: a declared `Content-Length` over 61 MB, or a stream that runs past it, gets `413` without being buffered.
  - `GET /upload/<token>` & `POST /upload/<token>`: Temporary mobile web page for users to upload media directly from device camera (`accept="image/*,video/*"`, `capture="environment"`). Tokens are single-use, expire after 15 minutes, bound to user and exercise IDs, and managed in KV.

- **Connector Tools for Agents**:
  - `search_exercises(query)`: Searches both the 1,540-exercise built-in library and the user's custom exercises by name, muscle groups, or equipment. Returns canonical IDs, names, muscle groups, equipment, whether custom, and existing media URLs.
  - `add_exercise`: Adds a new custom exercise with support for `media_url`. Refuses near-duplicates of library exercises or existing custom exercises, returning the matching exercise in the response.
  - `update_exercise`: Updates custom exercise fields (name, muscles, equipment, setup cues, notes, media URL). Refuses edits to built-in library exercises.
  - `attach_media_from_url(exercise_id, url)`: Downloads a media file from a public HTTPS URL, validates magic bytes and size caps (photos <= 8MB, GIF <= 15MB, video <= 60MB), uploads to R2, and links it to the exercise's `videoLinks`. Refuses non-https, credentials in the URL, localhost/private/link-local/`.local`/`.internal` hosts and IPv6 literals; redirects are followed by hand (max 3 hops) and every hop is re-checked. The body is read as a stream and cut off as soon as it passes the cap or its first bytes are not media (`global_fetch_strictly_public` is the runtime backstop).
  - `create_media_upload_link(exercise_id)`: Generates a temporary 15-minute single-use upload URL for the user to upload photos or videos from their phone camera.
  - `log_workout`: Accepts exercises by `id` directly from `search_exercises` or `add_exercise`, avoiding fallback IDs and correctly mapping equipment and muscle groups.

- **Snapshot Flow**:
  1. Inspect the machine/equipment photo.
  2. Call `search_exercises` with the machine or exercise name.
  3. If missing, call `add_exercise` to register it in the user's directory. If duplicate refusal triggers, use the returned match.
  4. Log or plan the workout with `log_workout` or `plan_workout`, referencing the exercise by its ID.
  5. Call `create_media_upload_link` to give the user a link to upload the photo/video to the exercise.

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
