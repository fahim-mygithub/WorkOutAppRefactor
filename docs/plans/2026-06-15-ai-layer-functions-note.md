# AI layer (`/ai` callable) — implementation note

**Date:** 2026-06-15
**Branch:** `feat/pwa-hardening`
**Implements:** §4 of `docs/plans/2026-06-14-pwa-hardening-design.md` (Phase 4 — AI layer).

The `/ai` Firebase Cloud Function is built as an **isolated package** under
[`functions/`](../../functions/README.md). It is intentionally **not** part of
the root app build:

- Root `tsconfig.json` `include`s only `src`, and references only
  `tsconfig.node.json` — it does not reference `functions/`, so `tsc -b` /
  `tsc --noEmit` never compile it. Root tsc baseline stays at 46 errors.
- The root `vite build` only bundles `src` — it never imports from `functions/`.
  Root build stays PASS; the 323-test suite stays green.
- `functions/` has its own `package.json` + `tsconfig.json` (`outDir: lib`) and
  its own `node_modules`. `firebase.json` registers it under `functions`
  (`codebase: "ai"`) with a `predeploy` hook scoped to that directory only.

## Summary

- Single `onCall` callable `ai` (CORS handled by the callable contract).
- **Firebase Auth gated** — unauthenticated requests rejected.
- **Zod-validated** request envelope (discriminated union on `action`).
- `parse` → Haiku 4.5 (`claude-haiku-4-5-20251001`): free text → structured sets.
- `chat` → Sonnet 4.6 (`claude-sonnet-4-6`): tool-use with ~11 mutation tools +
  `renderChart` chart vocabulary.
- Tool catalog defined once as typed Zod schemas; tool inputs validated before
  being returned to the client.
- **Mutations are returned, never auto-applied** — the client owns the
  Apply/Reject confirmation UX.
- System prompts are frozen and prompt-cached (`cache_control` ephemeral).
- Anthropic API key lives in Functions config only (Secret Manager / `.env` /
  legacy runtime config) — never client-side.

## Deploy

```bash
cd functions
npm install
firebase functions:secrets:set ANTHROPIC_KEY   # or functions:config:set anthropic.key=... / .env
firebase deploy --only functions
```

See [`functions/README.md`](../../functions/README.md) for the full contract,
request shapes, tool catalog, and a client-call sketch.
