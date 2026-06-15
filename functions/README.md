# `functions/` — WorkoutApp AI layer (`/ai` callable)

An **isolated** Firebase Cloud Functions package implementing the AI layer from
the PWA-hardening design (§4). It is its own npm package with its own
`package.json` and `tsconfig.json`, and is **deliberately excluded from the root
app build** (root `tsconfig.json` only `include`s `src`; the root `vite build`
never touches this directory). Changing or building this package cannot move the
root TypeScript baseline, the root Vite build, or the root test suite.

## What it exposes

A single callable HTTPS function, `ai` (`onCall`, so the Firebase SDK handles
CORS for the hosting origin — a raw `onRequest` would need explicit CORS).

It is **gated by Firebase Auth**: unauthenticated calls are rejected with
`unauthenticated`. Input is **Zod-validated** before any model call. Two actions:

| Action  | Model                              | Returns |
| ------- | ---------------------------------- | ------- |
| `parse` | `claude-haiku-4-5-20251001`        | Structured sets parsed from free text (`{ exercises: [{ exerciseName, sets[] }] }`). |
| `chat`  | `claude-sonnet-4-6`                | `{ text, toolCalls[], stopReason }` — assistant prose plus any proposed tool calls. |

### Request shapes (client → callable `data`)

```ts
// parse
{ action: 'parse', text: string }

// chat
{
  action: 'chat',
  messages: { role: 'user' | 'assistant', content: string }[],
  context?: { activeWorkout?, recentHistory?, units?, goal? }
}
```

### Tool catalog (`chat`)

Defined once as typed Zod schemas in `src/tools.ts` and converted to Anthropic
tool JSON schemas. ~11 mutation tools plus the chart vocabulary:

- **Mutations:** `swapExercise`, `reduceWeight`, `addBackoffSet`, `markFailedReps`,
  `deloadExercise`, `regenerateRoutine`, `adjustSetCount`, `adjustRestTime`,
  `addExercise`, `removeExercise`, `createSuperset`.
- **Chart vocabulary:** `renderChart({ kind, series, range, filter })`.

**Mutations are never applied server-side.** The function validates each
`tool_use.input` against its Zod schema and returns the tool calls to the
client, which presents the Apply / Reject confirmation UX described in §4.

### Prompt caching

System prompts are frozen (no per-request interpolation) and sent with
`cache_control: { type: 'ephemeral' }` so the cached prefix is reused across
requests. Volatile context (the active workout, recent history) rides in the
user turn, never in the cached system block.

## Configuration — the Anthropic API key (never client-side)

The key lives in Functions config only. Resolution order at runtime:
`ANTHROPIC_KEY` secret (Secret Manager) → `ANTHROPIC_KEY` / `ANTHROPIC_API_KEY`
env (`.env`) → legacy `anthropic.key` runtime config.

**Preferred (Secret Manager):**

```bash
cd functions
npm install
firebase functions:secrets:set ANTHROPIC_KEY   # paste the key when prompted
```

**Or via legacy runtime config:**

```bash
cd functions && npm install
firebase functions:config:set anthropic.key=sk-ant-...
```

**Or via `.env` (local emulator):** copy `.env.example` to `functions/.env` and
set `ANTHROPIC_KEY`. Never commit a real key (`.gitignore` excludes `.env`).

## Deploy

```bash
cd functions
npm install
# configure the key (see above), then:
firebase deploy --only functions
```

The root `firebase.json` registers this package under `functions` with
`codebase: "ai"` and a `predeploy` hook that runs `npm run build` here only —
deploying functions does not build or touch the root app, and deploying hosting
(`npm run deploy` at the root) does not touch this package.

## Local development

```bash
cd functions
npm run build          # tsc -> lib/
npm run typecheck      # tsc --noEmit (this package only)
npm run serve          # build + functions emulator
```

## Calling it from the client (sketch — not included in this package)

```ts
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '@/firebase/config';

const ai = httpsCallable(getFunctions(app), 'ai');
const { data } = await ai({ action: 'parse', text: 'bench 3x5 @ 185' });
```
