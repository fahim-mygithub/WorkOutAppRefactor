# WorkoutApp v2 — Design

**Status:** Approved, ready for `/ultraplan` of Phase 0
**Date:** 2026-04-23
**Author:** Fahim (with Claude Code, brainstorming session)

---

## 1. Project framing

Resurrect an existing 28.7k-LOC React/Firebase workout tracker. The goal is **not** a rewrite. The goal is a **disciplined refactor + Capacitor wrap + a constrained AI layer + a UI/UX overhaul**, replacing buggy rule-based parsing and overly-simplified UX with something that feels modern without becoming a different app.

The original drivers (Tauri, "escape the codebase") were partially wrong. Real drivers: better code health, modern mobile UX, smarter (but bounded) AI, ship to iOS/Android stores from one codebase, web stays.

**Targets:** web (Firebase Hosting PWA), iOS (TestFlight → App Store), Android (Internal Testing → Play Store).

---

## 2. Design principle (load-bearing)

**Least intrusive during the workout.** Rich during planning and review; near-invisible during execution. Every UX decision in v1 passes this filter:

- Big tap targets, single-action set logging, locked scroll during a live set.
- Haptics replace toasts.
- No modals during a live workout — they queue or dismiss.
- Rest timer dominates rest screens with native LocalNotification when backgrounded.
- AI surfaces hide unless invoked; never auto-popup mid-set.

---

## 3. Stack & architecture

### Stack (kept)
- React 19 + Vite + TypeScript (strict)
- Tailwind CSS + design tokens
- Redux Toolkit + `redux-persist`
- Firebase 11 (Auth, Firestore, Storage, Hosting, Functions)

### Stack (added)
- **Capacitor 7** — native shell for iOS / Android. Three build targets from one codebase.
- **Framer Motion** — motion library, ~30KB, supports gestures, springs, layout animations.
- **Shadcn (Radix UI primitives)** — accessible component primitives composing with Tailwind. Replaces the bespoke modal/dropdown/sheet code in oversized components.
- **`date-fns`** + custom calendar — bespoke calendar component (existing libraries are designed for meeting calendars, not workout schedules).

### State persistence
`redux-persist` with Capacitor `Preferences` adapter on native, `localStorage` on web. Kill the ad-hoc `localStorage` paths in `BuildPage` and `WorkoutPage`.

### Serialization
One `firestore/serde.ts`. Replace duplicated logic in `sharedWorkoutService.ts` and `exerciseHistoryService.ts`. Every `setDoc`/`getDoc` goes through it.

### Backend addition
One Firebase Cloud Function `/ai`, Firebase Auth-gated, Zod-validated I/O, prompt-cached system prompt. `ANTHROPIC_API_KEY` in Functions config — never client-side.

---

## 4. AI layer (tool use, not generative UI)

**Two AI surfaces only:**

### Parse (one-shot, Haiku 4.5)
Freeform text → structured sets. Replaces the regex parser and most of `EnhancedTextInput`'s 642-LOC parse path. Deterministic regex fallback for offline.

### Chat-with-tools (multi-turn, Sonnet 4.6)
The AI can only call typed tools the app ships. Two layers:

**Mutation tools (~10):**
- `swapExercise(currentId, replacementCriteria)`
- `reduceWeight(setId, percent)`
- `addBackoffSet(exerciseId)`
- `markFailedReps(setId, repsCompleted)`
- `deloadExercise(exerciseId)`
- `regenerateRoutine(constraints)`
- (final list locked at start of Phase 3)

**Visualize tools (~5):**
- `renderChart({ kind: "line"|"bar"|"prTable"|"volumeHeatmap"|"distribution", series, range, filter })`
- AI picks from shipped chart vocabulary; no SVG hallucination.

### UX contract
- **Mutations:** never auto-apply. Surface as `[Apply] / [Reject]` cards.
- **Visualizations:** read-only, render immediately, dismissible.
- **Every surface has a deterministic fallback** so the app works offline or when the API is down.

### Models
- Haiku 4.5 — parse
- Sonnet 4.6 — chat-with-tools

The chat surface **subsumes** what would have been three separate buttons (suggest-next-set, generate-workout, deload-prompt). They become tools the chat can call; optional shortcuts pre-fill the prompt.

---

## 5. UI/UX overhaul (folded into the refactor)

The redesign happens **at the same time** as the component decomposition. Touching every component twice (decompose → redesign) is wasted work.

### Phase 0 deliverables (week 1)
- **UI/UX gap research doc** — `docs/research/2026-04-23-ui-gap-analysis.md`. Audit of `Hevy`, `Strong`, `Caliber`, `Future`, `Apple Fitness`, `Whoop`, `Strava`. Per app: navigation, motion vocabulary, calendar/scheduling, set-logging UX, color/typography, iconography. Side-by-side current vs. target with named gaps.
- **Design tokens** — semantic Tailwind tokens (color, spacing, radius, elevation, motion duration/easing) checked into `tailwind.config.ts`.
- **Motion principles** — 3–4 named transitions (snap, spring, fade, slide-up sheet) with timings, used everywhere.
- **Iconography** — keep Lucide for utility icons. Add custom muscle-group SVG set: push, pull, legs, core, cardio, full-body, mobility. Sized 24/32/48.
- **Calendar wireframe** — replaces current basic calendar. Shows upcoming workouts with muscle-group SVG icons (replacing circle-letters), session intensity, completion state.
- **Base primitives** — `Button`, `Card`, `Sheet`, `Stack`, `IconButton`, `Skeleton` shipped via Shadcn + custom.

### Mobile UX remediation (Phase 2, ordered by user priority)
1. **Navigation overhaul** — biggest pain, especially in PWA. Bottom nav with safe-area insets, native back-gesture on iOS, Android hardware back-button mapping, no PWA address-bar jumping.
2. **Modals → bottom sheets** — `CustomExerciseModal`, `ExerciseHistoryDetailModal`, `ShareWorkoutModal`.
3. **Rest timer reliability** — Capacitor `LocalNotifications` so the timer survives backgrounding.
4. **Keyboard handling** — replace `useIOSKeyboardFix` hack with Capacitor `Keyboard` plugin.
5. **Touch targets + sticky-header behavior** during live workouts.
6. **Performance pass on `WorkoutPage`** — memoization, decomposition. Saved for Phase 4.

---

## 6. Tooling workflow

This v2 explicitly leverages three Anthropic tools in sequence:

1. **`superpowers:brainstorming`** (this doc) → consolidated design.
2. **Claude Design** (`claude.ai/design`, Research Preview) → visual prototypes per surface.
   - Set up a Design System in Claude Design encoding the Phase 0 token decisions.
   - Per surface in Phase 2: prototype (wireframe → hi-fi) → user reviews / "checks off" → implement.
   - **Lightweight integration:** use it where it earns its keep (calendar, nav, AI chat, charts), skip for mechanical work (lint config, serde refactor).
3. **`/ultraplan`** (Claude Code slash command, Research Preview) → cloud-generated implementation plan per phase.
   - Once per phase, takes this design doc as input, returns an interactive plan you comment on.
   - For individual tickets inside a phase, use `superpowers:writing-plans` (faster, no cloud round-trip).
4. **Claude Code locally** → executes plans, referencing Claude Design mockups.

---

## 7. Quality bar

- **ESLint config** checked in (currently absent).
- **Error boundaries** at route level + around `WorkoutPage`.
- **Tests required** for: any new code, any refactored surface, the AI tool catalog, the `firestore/serde.ts` helper. Vitest already installed and unused. **No backfill mandate** for untouched code.
- **Delete the 263 `console.log`s** in a single Phase 1 pass.

---

## 8. Sequencing

| Phase | Weeks | Focus | Exit gate |
|---|---|---|---|
| **0** | 1 | UI/UX gap research, design tokens, motion, icons, calendar wireframe, Shadcn + Framer Motion installed, base primitives | ✅ Complete 2026-05-04 |
| **1** | 2–3 | Code-health quick wins: ESLint, console.log cleanup, error boundaries, `firestore/serde.ts`, redux-persist, kill ad-hoc localStorage. Capacitor scaffolded but not shipping yet. | All tests pass; clean lint |
| **2** | 4–10 | Per-surface decompose + redesign + Capacitor plugin wiring: Nav overhaul, **Calendar redesign**, modals → bottom sheets, rest timer + LocalNotifications, keyboard plugin, haptics sweep, share/clipboard. | First TestFlight + Play Internal builds |
| **3** | 11–13 | AI: `/ai` Cloud Function, parse surface, chat-with-tools, chart vocabulary, confirmation UX | Both AI surfaces live; tool catalog locked |
| **4** | 14–15 | `WorkoutPage` decomposition + redesign (saved for last — by now tokens / primitives / motion are battle-tested) | `WorkoutPage` < 200 LOC; under-200-LOC components throughout |
| **5** | 16+ | Public store release after two real workouts on TestFlight build | App Store + Play public listings |

**Honest timeline: ~16 weeks.**

---

## 9. Explicitly out of scope (the trap door)

These are good ideas. They are **not** v1. Adding any one slips v1 by ≥ a month:

- Voice control during workout (wake word, audio session ducking)
- Apple Watch / Wear OS sensor-based rep counting
- On-device LLMs (incl. Apple Foundation Models — file as v1.1 fast path for parse)
- Voice input for parsing
- Post-workout AI recap
- Form review (vision)
- Replacing Redux
- Replacing Firebase
- Tauri / desktop targets

---

## 10. Filed for v2 / later

(Don't lose, don't build yet.)

- Apple Foundation Models on-device parse for iPhone 15 Pro+ as a fast path.
- Hands-free workout mode via Siri Shortcuts.
- watchOS rep counter (separate native project).
- Smart deload heuristic without an LLM call.
- Post-workout AI recap.

---

## 11. Open decisions to lock in Phase 0

1. **Tool catalog enumeration** — confirm the ~10 mutation tools and ~5 chart types before Phase 3 starts.
2. **Apple Developer ($99/yr) + Play Console ($25 one-time)** — accounts ready, or signup is part of Phase 2?
3. **Existing share-link compatibility** — does v2 keep the same shared-workout URL format so old links don't break?
4. **Telemetry** — Firebase Analytics + Sentry in v1, or punt to v1.1?
5. **Brand identity** — name, color, logo. Current is "WorkOutAppRefactor". Real product name?
6. **Dark mode** — first-class in v1, or punt?
7. **Custom muscle-group SVGs** — DIY, commission, or open-source set?

---

## 12. Next action

User invokes `/ultraplan` with this document as input, scoped to **Phase 0 only**. The cloud session produces a commentable Phase 0 implementation plan. Approve / iterate in browser, then teleport back to local Claude Code for execution.
