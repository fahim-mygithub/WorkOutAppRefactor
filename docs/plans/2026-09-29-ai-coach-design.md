# AI coach for tracked lifts and custom exercises

Date: 2026-09-29 · Branch: `feat/tempo-ui` · Status: design approved, not built

## Goal

Let Claude help where the rule engine can't: read free-form lift entries, advise
after missed reps or an exercise you can't do, act on the app for you through an
"Ask AI" button, and add exercises missing from the library (with demo media
found on the web).

**The rule: the engine owns every number; Claude owns interpretation and
judgement.** Prescriptions stay deterministic (see
`2026-09-26-tracked-lift-progression-design.md`); every number Claude proposes
passes through the engine before it lands.

## What already exists (not rebuilt)

- `src/lib/trackedLiftProgression.ts` — Volume / Strength / Checkpoint
  prescriptions from 1RM, N-rep max or reps-at-load benchmarks; level, bodyweight
  and timed-hold exceptions; per-lift session log.
- `src/lib/progression/inSession.ts` + `InSessionSuggestion` — rule-based
  reduce / repeat / end after a missed set.
- `functions/` — Firebase callable `ai` (never deployed; its tools, prompts and
  Zod schemas are ported to the Worker, then the package is removed).
- `src/components/ai/AiChatSheet.tsx`, `ApplyRejectCard.tsx`,
  `src/components/CustomExerciseModal.tsx`.

## Decisions

| Question | Decision |
|---|---|
| Where AI sits | Hybrid: engine computes, Claude interprets and advises |
| AI moments (v1) | Lift setup, missed reps, floating Ask AI agent, custom-exercise lookup |
| Autonomy | Tiered: today-only changes apply with Undo; anything touching saved data or future numbers is Apply/Reject |
| Backend | A Cloudflare Worker (free tier, no card) holds the owner's Anthropic API key; Firebase Functions dropped because Blaze needs a card and has no hard cap |
| Billing | The owner's Anthropic API key, hard monthly spend cap in the Anthropic Console, allow-listed accounts |
| Subscription auth | Not allowed (see below); an MCP connector is the later, compliant way to use Claude plans |
| Exercise media | Any source, link only, verified server-side |

### Why not the Claude subscription

The Agent SDK plan-credit change
(support.claude.com/en/articles/15036540) was paused on June 15. The Claude Code
legal page says Agent SDK products "should use API key authentication", and
"developers may not collect, store, or intermediate Claude.ai credentials or
session tokens". An owner's API key serving the owner's own authorized users is
permitted. A remote MCP connector used from each person's own Claude app is the
compliant subscription route; it reuses this tool catalog and is out of scope for
v1 (it also needs tracked lifts synced to Firestore).

## 1. Architecture

```
 App (GitHub Pages)                              Cloudflare Worker `workout-ai`
 ─────────────────                               ──────────────────────────────
 Ask AI button ─┐   Firebase ID token ──────────► verifies token, allow-listed emails
 Lift editor   ─┼─► context: lifts, today's  ──►  model call with typed tools
 Player (miss) ─┘   sets, recent sessions         (+ web search for lookups)
        ▲                                                 │
        └── engine re-checks every tool call ◄────────────┘
            today-only → apply + Undo · saved data → Apply/Reject
```

- **Stateless Worker, no Firestore sync in v1.** The client sends the relevant
  slice: the tracked lifts involved, their last 6 sessions, today's sets.
- **Models:** `claude-haiku-4-5-20251001` for entry reading; `claude-sonnet-5-5`
  for the agent, missed-rep advice and exercise lookup (replacing
  `claude-sonnet-4-6`).
- **Auth:** the client sends the signed-in user's Firebase ID token; the Worker
  verifies it against Google's public keys (issuer/audience = the Firebase
  project) and checks the email against the allow-list. No Firebase Admin SDK.
- **Cost guard:** monthly spend cap in the Anthropic Console; per-account daily
  request limit in Workers KV; allow-list of accounts. Workers free tier:
  100k requests/day, 10 ms CPU per request (waiting on Anthropic doesn't count).
- **No AI → today's behaviour.** Every entry point degrades to the rule-based
  suggestion or the manual form.

## 2. Tool catalog and apply rules

| Tool | Does | Applies |
|---|---|---|
| `readLiftEntry(text)` | Free text → load, target, sets, RIR, equipment, `step` | Fills the form; user saves |
| `logSet(exercise, reps, weight \| time)` | Records a described set | Immediately + Undo |
| `adjustSet(setId, weight, reps)` | Today's remaining sets | Immediately + Undo |
| `suggestNextStep(liftId, note?)` | Lower load / repeat / lighter variation / end | Card with options |
| `swapExercise(from, to, scope, reason)` | Library alternative, today or ongoing | Apply/Reject |
| `updateBenchmark(liftId, load, target)` | Changes future prescriptions | Apply/Reject |
| `addTrackedLift` / `removeTrackedLift` | Manage the tracked list | Apply/Reject |
| `findExercise(name)` | Library match, else web lookup + media | Apply/Reject (preview) |
| `getPrescription(liftId, goal)` | Read-only engine output | — |

Existing workout-mutation tools (`reduceWeight`, `addBackoffSet`,
`markFailedReps`, …) stay; overlapping ones are folded into `adjustSet` when
built.

**Tiering rule:** only affects today's workout and matches what the user just
said → apply with Undo. Changes saved data or future numbers → ask first.

### Engine addition: equipment increments

`TrackedLift` gains optional `equipment` and `step` (e.g. stack 10 lb, dumbbells
5 lb, kg barbell 2.5 kg). `roundLoad` and every AI-proposed load round to `step`,
so suggestions are loads the user can actually set.

## 3. Flows

**A. Lift setup (Haiku).** A "Describe it" field above the Add/Edit lift form.
"Can front squat 250 for 3 sets of 5, barely" → 250 lb, 5 reps, 3 sets, RIR ≈ 0,
barbell, step 5. Fields fill and highlight; the user saves. Ambiguity → one
short inline question. Never saves on its own.

**B. Missed reps (Sonnet).** The player's existing suggestion gains an
**Ask coach** chip. Context: today's sets (planned vs done, RIR), the lift's last
6 sessions, benchmark, cycle position, optional note ("shoulder pinches").
Reply: short text + 1–3 cards, e.g. "Drop to 205 × 3" (`adjustSet`), "Third
miss at 225 — next Strength day at 215" (`updateBenchmark`), "Can't do it today —
DB press at 70 lb" (`swapExercise`).

**C. Floating Ask AI (Sonnet).** Opens `AiChatSheet` with the current screen's
context (workout in progress or Build lifts); any catalog tool, tiered. Hidden
while a set timer is running.

**D. Custom exercise (Sonnet + web search).** When a search in Add lift or Add
exercise has no match, a **Look it up with AI** row runs `findExercise`:
1. Map the name onto the 1,540-entry library first (synonyms: "skull crusher",
   "RDL").
2. Otherwise web search/fetch: muscle groups, equipment, instructions,
   difficulty, candidate media.
3. Verify media server-side (below).
4. Preview card with the clip playing → Apply / Reject / pick another clip.
   Saved through the existing custom-exercise path.

### Media verification

Any source, link only (no rehosting). A candidate passes if a GET with the app's
origin as `Referer` returns 200, `Content-Type` `video/mp4`, `video/webm` or
`image/gif`, and size under a limit. Custom-exercise URLs join the periodic link
check; broken media falls back to the glyph placeholder.

## 4. Error handling and safety

| Situation | Behaviour |
|---|---|
| Offline / unreachable | AI entry points disabled ("Offline"); rules and manual form work |
| Cap or daily limit | `resource-exhausted` → "AI limit reached until <date>", chips hidden for the day |
| Account not allow-listed | `permission-denied` → AI entry points hidden |
| Load outside ±30% of estimate or off-`step` | Small miss → snap to nearest valid; else discard card ("Suggestion discarded"), log for tuning |
| Tool references a missing lift/set | Dropped with a quiet notice |
| No verifiable media | Save without media, or paste a URL |
| Undo | One tap for 8 s or from workout history; restores exact prior values |

- **Privacy:** prompts carry lift names, numbers and the user's note only (no
  email or tokens). The Worker logs counts, not contents.
- **Prompt injection:** web content is data. The lookup step only accepts the
  `findExercise` result schema, so a page can't trigger other tools.

## 5. Testing

- **Engine (Vitest, strict paths):** `step` rounding; out-of-range snap/reject;
  a reducer per tool with apply + undo round-trips.
- **Worker:** Zod schema per tool; allow-list, rate limit and cap with a mocked
  Anthropic client; media verifier against fixtures (200 mp4, 403 hotlink, HTML
  posing as gif).
- **UI:** Apply/Reject card and Undo toast; one Chrome pass on a local dev
  server with a stubbed Worker.
- **Evals:** ~20 real lift descriptions and ~10 missed-rep scenarios with
  expected structured output, rerun when prompts or models change.

## Out of scope (v1)

- MCP connector and Firestore sync for tracked lifts.
- AI-generated prescriptions or plan previews.
- Stall detection across cycles (the agent can advise when asked).
- Rehosting media.

## Prerequisites before deploying

- A free Cloudflare account; `npx wrangler login` run by the user.
- `wrangler secret put ANTHROPIC_API_KEY`, a Console spend cap, and the
  account allow-list.
