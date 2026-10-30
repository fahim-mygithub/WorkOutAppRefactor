# Claude agent: connector + in-app tools — design

Date: 2026-10-30. Orders: `agent-mcp` (this doc, the connector) and `agent-inapp` (in-app chat tools).

The owner wants Claude to create and update workouts, plans and the profile — "add multiple workouts etc." — from the
Claude app and Claude Code, and the in-app assistant (premium = `AI_ALLOWED_EMAILS`) to do the same with Apply/Reject.
Photos (a gym machine) are read by Claude itself; our code only ever receives fields.

## Two entry points

| | Connector (MCP) | In-app chat |
|---|---|---|
| Caller | claude.ai custom connector, Claude Code (`claude mcp add --transport http`) | The PWA's AI sheet (Sonnet via the Worker's `chat` action) |
| Route | `/mcp` on the `workout-ai` Worker, `src/main.ts` | `POST /` action `chat` / `readMachine`, `src/index.ts` (unchanged by the connector) |
| Auth | OAuth 2.1 (`@cloudflare/workers-oauth-provider`): DCR + CIMD, `/authorize` signs in with Google (Firebase JS SDK), ID token checked by `verifyIdToken`, email must be on `AI_ALLOWED_EMAILS` (re-checked every call) | Firebase ID token per request + same allow-list + daily limit |
| Writes | Directly to Firestore as a service account, scoped to the grant's uid | Proposals: the client shows Apply/Reject and saves through the app's own services (undo supported) |

## Tools

Registry in `worker/src/agentTools/registry.ts` (zod `.strict()` inputs, model-facing descriptions; importable by a
second consumer). No input can name a user: unknown keys are rejected and document ids must match `[A-Za-z0-9_-]`.

- `get_profile`, `update_profile` — display name and training preferences only (unit, rest, progression, theme); never
  email, photo, stats or auth.
- `list_workouts` (paged), `get_workout`, `create_workout` (1–10 per call), `update_workout` (exercise list replaced
  whole; read first).
- `list_plans` (date range), `plan_workout` — dateKey + saved `workoutId` or exercises; merged into the plans document
  by id (optimistic `updateTime` precondition, re-read on conflict); `planId` replaces one plan, others untouched.
- `list_history` — read only, paged; finished sessions or per-exercise logs.
- `add_exercise` — custom exercise: name, muscle groups, equipment, setup cues (→ `instructions`), default
  sets/reps/weight (→ `notes`, the app has no field for them).

The in-app order adds `createWorkout`, `updateWorkout`, `planWorkout`, `updateProfile`, `addExercise` as chat tools
in `worker/src/tools.ts` with the same field set, applied client-side.

## Data access (connector)

`worker/src/data/`: Firestore REST v1 with a Google access token from the service-account key (`jose` RS256 JWT
bearer, cached ~1 h). `UserData` is the access rule — the service account bypasses security rules, so every path is
built as `users/{uid}/…` from the verified grant. Documents mirror the app's writers exactly (`shapes.ts`, tested
against fixtures captured by running the app's parser and conversion code):

- `users/{uid}/savedWorkouts/{id}` — `WorkoutStorageService.saveWorkout` shape: `parsedWorkout` as `serialized_v1`,
  Timestamp `createdAt`/`updatedAt`, `lastPerformedAt: null`, and `workoutText` in parser syntax
  (`3x8-12 Bench Press @135lbs`, supersets joined by ` ss `) because picking a saved workout re-parses the text.
- `users/{uid}/schedule/plannedWorkouts` — `{ plans, schemaVersion: 1, updatedAt }` with `PlannedWorkout` entries as
  `planAdded` prepares them; exercises use the app's `fallback-<hash>` ids.
- `users/{uid}/customExercises/{id}` — `CustomExerciseService.saveCustomExercise` shape.
- `users/{uid}` — field-masked writes (`displayName`, `preferences.<key>`, `updatedAt`), profile must already exist.
- `workout_history`, `exercise_history` — read only.

MCP transport: `@modelcontextprotocol/sdk` 1.32.2 `WebStandardStreamableHTTPServerTransport`, stateless (a server per
request, JSON responses), so no Durable Object; `CfWorkerJsonSchemaValidator` because Workers forbid `eval`.

## Owner's steps

1. `npx wrangler kv namespace create OAUTH_KV`; put the id in `worker/wrangler.toml`.
2. Firebase console → Service accounts → generate a key; `npx wrangler secret put FIREBASE_SERVICE_ACCOUNT < key.json`;
   delete the file.
3. Firebase Auth → Authorized domains → add the Worker host (`workout-ai.<subdomain>.workers.dev`).
4. Make sure your email is in `AI_ALLOWED_EMAILS`; `npx wrangler deploy`.
5. claude.ai → Settings → Connectors → Add custom connector → `https://workout-ai.<subdomain>.workers.dev/mcp`;
   Claude Code: `claude mcp add --transport http workout <same URL>` then `/mcp` to sign in.

## Known limits

- Plans reach the phone on the planner's next remote sync (`usePlannedWorkoutsSync` merges by id/updatedAt); the
  phone then writes its merged list back.
- Exercises in agent-made plans are not matched to the app's exercise library (no library in the Worker); they use the
  same fallback ids the app gives unmatched names. Saved workouts are unaffected: the app matches names when started.
