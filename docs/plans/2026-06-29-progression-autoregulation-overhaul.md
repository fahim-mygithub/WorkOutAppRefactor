# Progression, Autoregulation & Deload Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the buggy, partly-dead progression/deload code with a single, pure, evidence-aligned progression engine — adaptive load from logged history (e1RM), double progression over real rep *ranges* (killing the bogus "13"), optional-RIR autoregulation with a live reduce/repeat/end decision, and a softened opt-in "welcome back" replacing the automatic days-since deload.

**Architecture:** A new pure, fully-unit-tested core under `src/lib/progression/` owns all decisions; it composes the existing math in `src/lib/oneRepMax.ts` and the currently-dead helpers in `src/lib/charlie/progression.ts` (`smoothedE1RM`, `pullupTrainable1RM`). `ProgressiveOverloadService` becomes a thin Firebase/history adapter that delegates to the core. The Charlie generator carries rep *ranges* onto sets instead of collapsing them to a midpoint. The UI surfaces ranges, an optional RIR tap, and the in-session suggestion. All new fields are optional → no destructive migration.

**Tech Stack:** React + TS, Redux Toolkit, Vitest + Testing Library, Firebase. Pure logic in `src/lib/`, gated by `npm run typecheck:strict-paths`.

**Decisions locked (from brainstorming):**
- Progression: **full adaptive engine** (e1RM-driven load) + double progression + visible ranges.
- Deload: **fix bugs + soften the layoff cut to opt-in** ("welcome back"); no volume-based redesign this round.
- Missed sets: **build real autoregulation** (live reduce/repeat/end + next-session feedback) and delete the dead code.
- Effort signal: **optional RIR tap** (hybrid) — use it when present, fall back to reps-vs-range when skipped.

**Conventions every task follows:** TDD (red → green), one logical change per commit, `feat(progression):`/`fix(progression):` messages, run `npm run typecheck:strict-paths` (must stay green) before each commit, push at the end of each phase (standing preference). New pure code lives under `src/lib/progression/**` which is covered by the strict-paths tsconfig.

---

## Phase 0 — Data model & foundations (non-breaking)

Adds the optional fields the engine needs. Nothing reads them yet, so the app behaves identically.

### Task 0.1: Extend `WorkoutSet` with prescribed range + RIR

**Files:**
- Modify: `src/types/exercise.ts:35-45` (`WorkoutSet`)

**Step 1 — change.** Add to `WorkoutSet` (keep `reps` as the logged/edited actual count):
```ts
export interface WorkoutSet {
  id: string;
  reps: number;            // logged/edited actual reps (defaults to repMin)
  repMin?: number;         // prescribed range floor (double-progression start)
  repMax?: number;         // prescribed range ceiling (advance load when beaten)
  weight?: number;
  unit?: 'lbs' | 'kg';
  time?: number;
  distance?: number;
  rpe?: number;            // existing; RPE 1-10
  rir?: number;            // NEW: reps-in-reserve (0/1/2/3+), optional effort tap
  completed: boolean;
  failed?: boolean;        // now actually written in Phase 4 (actual < repMin)
}
```

**Step 2 — verify.** `npm run typecheck:strict-paths` → green (additive optional fields).
**Step 3 — commit.** `feat(progression): add repMin/repMax/rir to WorkoutSet`

### Task 0.2: Extend `PerformedSet` and progression types

**Files:**
- Modify: `src/types/exerciseHistory.ts:1-10` (`PerformedSet`)
- Modify: `src/types/progression.ts:44-58` (`ProgressionRecommendation`)

**Step 1.** Add `rir?: number` to `PerformedSet` (alongside existing `rpe?`), so history can feed the engine. Add to `ProgressionRecommendation`:
```ts
  recommendedRepMin?: number;
  recommendedRepMax?: number;
  source?: 'seed' | 'e1rm' | 'double-progression' | 'first-time' | 'layoff';
```
Add a new exported type for the live decision:
```ts
export type InSessionAction = 'continue' | 'reduce' | 'repeat' | 'end';
export interface InSessionDecision {
  action: InSessionAction;
  suggestedWeight?: number;   // for 'reduce'/'repeat'; based on the weight ACTUALLY lifted
  suggestedReps?: number;
  message: string;            // user-facing, one line
}
```

**Step 2.** `npm run typecheck:strict-paths` → green.
**Step 3.** Commit `feat(progression): add e1rm/range fields and InSessionDecision type`

### Task 0.3: Read & document the math base (no code change)

**Files (read-only):** `src/lib/oneRepMax.ts`, `src/lib/charlie/progression.ts`, `src/config/progressionConfig.ts` (`equipmentIncrements`, `defaultDeloadFactors`), and `roundToAvailableWeight` in `src/services/progressiveOverloadService.ts`.

Confirm the exact signatures of `estimateOneRepMax`, `workingWeightFor1RM`, `seedWorkingWeight`, `smoothedE1RM`, `pullupTrainable1RM`. The new core REUSES these (DRY) — do not reimplement Epley or rounding. Note the available-weight rounding so the core can call it. No commit.

---

## Phase 1 — Pure progression core (`src/lib/progression/`)

The heart of the overhaul. Pure, deterministic, no Firebase, no React. Heavy TDD. Each function is its own task (write tests first, watch them fail, implement, watch them pass, commit).

### Task 1.1: RIR-adjusted e1RM

**Files:**
- Create: `src/lib/progression/e1rm.ts`
- Test: `src/lib/progression/e1rm.test.ts`

**Step 1 — failing tests.**
```ts
import { describe, it, expect } from 'vitest';
import { effortAdjustedE1RM } from './e1rm';

describe('effortAdjustedE1RM', () => {
  it('equals a plain Epley estimate at 0 RIR (taken to failure)', () => {
    // Epley: w*(1+reps/30); 100*(1+10/30)=133.3
    expect(effortAdjustedE1RM(100, 10, 0)).toBeCloseTo(133.3, 1);
  });
  it('treats reps-in-reserve as additional effective reps', () => {
    // 8 reps @ 2 RIR ≈ a 10-rep max effort at that load
    expect(effortAdjustedE1RM(100, 8, 2)).toBeCloseTo(effortAdjustedE1RM(100, 10, 0), 5);
  });
  it('defaults to failure (rir=0) when rir is undefined', () => {
    expect(effortAdjustedE1RM(100, 10)).toBeCloseTo(effortAdjustedE1RM(100, 10, 0), 5);
  });
  it('returns the load itself for a 1-rep max effort', () => {
    expect(effortAdjustedE1RM(200, 1, 0)).toBeCloseTo(200, 1);
  });
});
```

**Step 2 — run, expect FAIL** (`npx vitest run src/lib/progression/e1rm.test.ts`).

**Step 3 — implement** (reuse the existing Epley in `oneRepMax.ts`):
```ts
import { estimateOneRepMax } from '../oneRepMax';

/** e1RM that accounts for unused reps: a set left N reps short of failure is
 *  estimated as a max-effort set of (reps + N) at the same load. */
export function effortAdjustedE1RM(weight: number, reps: number, rir = 0): number {
  if (weight <= 0 || reps <= 0) return 0;
  return estimateOneRepMax(weight, reps + Math.max(0, rir));
}
```

**Step 4 — run, expect PASS.** **Step 5 — commit** `feat(progression): RIR-adjusted e1RM`.

### Task 1.2: Session e1RM smoothing (wire the dead helper)

**Files:**
- Create: `src/lib/progression/sessionE1RM.ts`
- Test: `src/lib/progression/sessionE1RM.test.ts`

Build `bestSetE1RM(sets)` (max `effortAdjustedE1RM` across a session's sets) and `smoothedSessionE1RM(sessions, window=3)` that returns the **median** of recent per-session bests (a single PR set shouldn't jump the program; a single bad session shouldn't tank it — the audit flagged the current `Math.max`-only `smoothedE1RM` as never even called).

**Tests** cover: empty history → `null`; single session → that session's best; 3 sessions → median; window caps to the last N. Reuse `effortAdjustedE1RM`.

Commit `feat(progression): smoothed session e1RM (median of recent bests)`.

### Task 1.3: Double progression over rep ranges

**Files:**
- Create: `src/lib/progression/doubleProgression.ts`
- Test: `src/lib/progression/doubleProgression.test.ts`

**Contract:**
```ts
interface Prescription { repMin: number; repMax: number; sets: number; equipment: EquipmentType; }
interface LastSession { weight: number; reps: number[]; rir?: number[]; }
interface NextPrescription { weight: number; repTarget: number; repMin: number; repMax: number; advanced: boolean; reason: string; }
export function nextDoubleProgression(p: Prescription, last: LastSession | null, increment: number): NextPrescription;
```

**Rules (tested):**
- No history → start at `repMin` at the seeded weight (`advanced:false`, reason `'first session'`).
- All working sets reached `repMax` (and effort sufficient: any logged `rir <= 1`, or rir absent) → **add `increment`**, reset target to `repMin`, `advanced:true`.
- Otherwise → **hold weight**, target = `min(repMax, bestReps + 1)` to re-earn the top of the range (`advanced:false`).
- A clearly missed session (top set `< repMin`) → hold weight, target `repMin`, reason `'rebuild to range floor'`.
- `increment` comes from `equipmentIncrements` (caller passes it; do not hardcode).

Use a fixed `increment` arg so the function stays pure; the service maps equipment→increment. Commit `feat(progression): double progression over rep ranges`.

### Task 1.4: In-session autoregulation decision

**Files:**
- Create: `src/lib/progression/autoregulation.ts`
- Test: `src/lib/progression/autoregulation.test.ts`

**Contract:**
```ts
interface SetTarget { repMin: number; repMax: number; weight: number; setIndex: number; totalSets: number; }
interface LoggedSet { reps: number; weight: number; rir?: number; }
export function inSessionDecision(t: SetTarget, logged: LoggedSet): InSessionDecision;
```

**Rules (tested) — note: suggestedWeight is derived from `logged.weight` (the weight ACTUALLY lifted), fixing the audit bug where it used `previousWeight`:**
- Hit the range (`reps >= repMin`) with reps-in-reserve (`rir >= 1` or undefined-but-hit) → `continue`, no change.
- Hit the range but to failure (`rir === 0`) and more sets remain → `continue` with a "consider holding here" message (still effective; not a cut).
- Missed by a little (`repMin - 2 <= reps < repMin`) with sets remaining → `reduce` to `round(logged.weight * 0.9)` for the remaining sets.
- Missed badly (`reps < repMin - 2`) → `reduce` to `round(logged.weight * 0.85)`, message about resetting.
- Last set or single-set exercise → `end` (nothing left to adjust), with a next-session note.
- Bodyweight / `weight <= 0` → never suggest a numeric cut; `continue`/`end` with a form/variation message (prevents the silent no-op the audit found).

Commit `feat(progression): in-session reduce/repeat/end decision`.

### Task 1.5: Softened return-from-layoff suggestion

**Files:**
- Create: `src/lib/progression/layoff.ts`
- Test: `src/lib/progression/layoff.test.ts`

**Contract:**
```ts
interface LayoffInput { daysSinceLastWorkout: number; lastWeight: number; }
interface LayoffSuggestion { suggestedWeight: number; reductionPct: number; optional: true; message: string; }
export function returnFromLayoffSuggestion(i: LayoffInput): LayoffSuggestion | null;
```

**Rules (tested) — evidence-aligned: strength is well preserved ~2–4 weeks, so be gentle and honest:**
- `< 21` days → `null` (no suggestion at all; raises the trigger from 14 to 21 days).
- `21–34` days → `-10%`.
- `>= 35` days → `-20%`.
- `reductionPct` is the **real** number (no hardcoded 15) and `message` states the actual gap and % ("~3 weeks off — optional 10% lighter to ease back in"). Weight rounded via the available-weight rounder (passed in or rounded by the caller).
- Never returns a negative/zero suggestion for `lastWeight <= 0`.

Commit `feat(progression): opt-in welcome-back suggestion (no auto load cut)`.

### Task 1.6: Barrel export

Create `src/lib/progression/index.ts` re-exporting all five modules. Commit `chore(progression): barrel export`. **Push Phase 1.**

---

## Phase 2 — Charlie generator: real ranges + adaptive load

Stop collapsing ranges to a midpoint (the "13"); carry the range; use history-driven e1RM when available.

### Task 2.1: Carry rep ranges onto generated sets

**Files:**
- Modify: `src/lib/charlie/generateDay.ts` (`buildSets`, ~`:93-114`; compound `:174-184`; accessory `:218-223`)
- Modify: `src/lib/charlie/definition.ts:135` (the `Math.round((min+max)/2)` helper)
- Test: `src/lib/charlie/generateDay.test.ts` (existing — extend)

**Step 1 — failing test:** assert generated sets carry `repMin`/`repMax` from the scheme, and that an accessory with a 10–15 scheme has `repMin:10, repMax:15` and `reps === 10` (the double-progression start) — **not 13**.

**Step 2 — implement:** `buildSets` writes `set.repMin = scheme.minReps`, `set.repMax = scheme.maxReps`, and `set.reps = scheme.minReps` (range floor) unless a fixed `targetReps` is explicitly the intent for hard-coded compound schemes (keep compounds' fixed numbers; only ranged accessories change). Keep `definition.ts:135` for any display fallback but it no longer drives the logged number.

**Step 3 — pass. Step 4 — commit** `fix(progression): carry rep ranges to sets; start ranged work at the floor, not Math.round 13`.

### Task 2.2: Adaptive working weight from history (wire the dead helpers)

**Files:**
- Modify: `src/lib/charlie/generateDay.ts:159-171` (compound load) and the pull-up branch
- Modify: `src/lib/charlie/progression.ts` (export usage of `smoothedE1RM`/`pullupTrainable1RM`)
- Test: `src/lib/charlie/generateDay.test.ts`

Add an optional input to `CharlieDayInputs`: `recentSessions?: Record<OneRmKey | string, { weight: number; reps: number; rir?: number }[]>`. When present for a lift, compute `smoothedSessionE1RM` and seed the working weight from that instead of the static entered-1RM seed; fall back to `seedWorkingWeight` when there is no history. Wire `pullupTrainable1RM` for the weighted-pull-up branch. Tests: with history the weight tracks the smoothed e1RM; with none it matches today's seeded value (no regression).

Commit `feat(progression): seed working load from smoothed e1RM when history exists`. **Push Phase 2.**

---

## Phase 3 — Service refactor (thin adapter + bug fixes)

`ProgressiveOverloadService` stops owning logic; it fetches history and delegates to the core. This is where the audit's correctness bugs die.

### Task 3.1: Delegate next-session recommendation to the core

**Files:**
- Modify: `src/services/progressiveOverloadService.ts` (`getRecommendation`, `calculateWeightProgression`, `getFirstTimeRecommendation`)
- Test: `src/services/progressiveOverloadService.test.ts` (existing — extend; keep the Phase-0 configured-weight tests green)

Map stored `ExerciseHistory` → the core's `LastSession`/sessions shape, call `nextDoubleProgression` (+ `smoothedSessionE1RM`), and return a `ProgressionRecommendation` with `recommendedRepMin/Max`, `source`, correct `recommendedWeight`. Pass the equipment increment from `equipmentIncrements`. First-time path keeps the prescribed-weight seeding from the earlier fix.

Tests: all-sets-hit-top-of-range ⇒ weight +increment, range reset to floor; partial ⇒ same weight, higher target; missed ⇒ rebuild. Commit `refactor(progression): service delegates next-session calc to pure core`.

### Task 3.2: Fix the fatigue/in-session cut (actual weight, not previousWeight)

**Files:**
- Modify: `src/services/progressiveOverloadService.ts:584-623` (`applyFatigueAdjustment`)

Replace with a call to `inSessionDecision` using the **weight actually lifted** (passed in from the active set), not `previousWeight`. Bodyweight/time exercises return a non-numeric message (no silent no-op). Update/keep tests. Commit `fix(progression): base in-session cut on the weight actually lifted`.

### Task 3.3: Replace time-based auto-deload with the opt-in layoff suggestion

**Files:**
- Modify: `src/services/progressiveOverloadService.ts:117-123` (`getDeloadFactor`), `:246-255` (deload application), `:111-116` (`calculateDaysSince`)
- Modify: `src/config/progressionConfig.ts` (`defaultDeloadFactors` — keep for reference, but the service no longer auto-applies them to load)

Remove the automatic `recommendedWeight *= deloadFactor` from the load calc. Day-gap no longer silently cuts working load; instead the service exposes `returnFromLayoffSuggestion(...)` for the UI to offer. Fix `calculateDaysSince` to floor whole days and guard future dates. Tests: a 16-day gap no longer reduces the recommended load; a 25-day gap yields an optional -10% suggestion object, not an applied cut. Commit `fix(progression): stop auto-cutting load by calendar gap; expose opt-in layoff suggestion`. **Push Phase 3.**

---

## Phase 4 — UI: ranges, RIR tap, live suggestion

Surface the engine. This is the user-visible payoff.

### Task 4.1: Show the prescribed rep range

**Files:**
- Modify: `src/components/SetInput.tsx` (labels/defaults), `src/components/workout/player/ExercisePlayCard.tsx` (`fmtSet`, set pips)
- Test: `src/components/SetInput.test.tsx` (new)

Render the target as a range ("10–15") wherever a single rep number is shown when `repMin !== repMax`; the editable reps input still defaults to `repMin`. Set pips show `repMin–repMax × weight`. Test via RTL that a set with `repMin:10, repMax:15` renders "10–15", not "13".

Commit `feat(progression): surface rep ranges in the player`.

### Task 4.2: Optional RIR tap on set logging

**Files:**
- Modify: `src/components/SetInput.tsx`
- Test: `src/components/SetInput.test.tsx`

Add a compact, optional segmented control after the weight/reps row: `RIR: 0 · 1 · 2 · 3+` (and a "skip" default of unset). On complete, write `set.rir` (and `set.rpe = 10 - rir` for history compatibility). Keep it unobtrusive in `compact` mode (the no-scroll player). When skipped, nothing changes downstream (engine falls back to reps-vs-range). Test: tapping "2" then Complete calls `onComplete` with the rir captured.

> Note: `onComplete(reps, weight)` currently takes two args. Extend its signature to `onComplete(reps, weight, rir?)` and thread through `handleCompleteSet`. Update all call sites (`ExercisePlayCard`, `WorkoutPage`).

Commit `feat(progression): optional RIR tap on set logging`.

### Task 4.3: Live in-session reduce/repeat/end suggestion + wire `handleCompleteSet`

**Files:**
- Modify: `src/pages/WorkoutPage.tsx` (`handleCompleteSet` `:255-275`, the `failedSetsCount` reset `:122-125`)
- Modify: `src/store/slices/workoutSlice.ts:124-133` (`completeSet` reducer — write `failed` based on `actualReps < repMin`)
- Replace usage of: `src/components/workout/FatigueCheck.tsx` → render the core's `InSessionDecision`
- Test: RTL/integration for handleCompleteSet → suggestion shown

On set completion, call `inSessionDecision` with the just-logged reps/weight/rir and show a small actionable card: e.g. "Missed the range — drop to 90 lb for the last set? [Apply] [Keep]". Applying sets the remaining sets' weight (reuse the existing remaining-sets autofill in `SetInput.tsx:93-100`). **Fix the "consecutive" bug**: reset the miss counter on a successful set (or drop the counter entirely now that each set gets a per-set decision). Make `failed` a real, written field.

Commit `feat(progression): live in-session suggestion after each set`.

### Task 4.4: Give anonymous/demo users the engine

**Files:**
- Modify: `src/hooks/useProgressionRecommendation.ts:80-83` (early-return without uid)

Let the hook run the pure core for anonymous users using in-memory/just-logged data (no Firebase fetch): ranges + double progression + in-session decisions work without an account; only cross-session *history* persistence needs auth. This closes audit gap #9. Test: hook returns a non-null recommendation with ranges for an anonymous user.

Commit `feat(progression): progression works for anonymous/demo users`. **Push Phase 4.**

---

## Phase 5 — Deload → opt-in "Welcome back"

### Task 5.1: Repurpose the deload modal

**Files:**
- Rename/rework: `src/components/workout/DeloadSuggestion.tsx` → `WelcomeBackSuggestion.tsx`
- Modify: `src/pages/WorkoutPage.tsx:594-606` (wiring), remove the dead `showDeloadModal` state/effect (`:113`, `:179-186`, `:604`)

Drive the modal from `returnFromLayoffSuggestion`. Show the **correct** percentage (from the suggestion object — no hardcoded 15), frame it as optional ("Welcome back — want to start ~10% lighter?"), with [Yes, lighter] / [No, full load]. Remove the dead local modal state and the `daysSinceLastWorkout || 14` reasoning bug. Gate consistently (or extend to anonymous per 4.4).

Commit `feat(progression): opt-in welcome-back replaces auto deload modal; correct %`. **Push Phase 5.**

---

## Phase 6 — Dead-code removal & final verification

### Task 6.1: Delete the dead code

**Files:**
- Delete: `src/components/workout/ProgressionIntegration.tsx` (never imported; contains a "remove in production" block) and update/remove `PROGRESSION_INTEGRATION_GUIDE.md`
- Modify: `src/hooks/useProgressionRecommendation.ts` — remove `checkForFailedSet`'s now-unused branches and the unreturned `failedSetInfo` (its job is now the per-set `inSessionDecision`)
- Grep first: confirm zero remaining references before deleting each symbol.

Commit `chore(progression): remove dead progression-integration code`.

### Task 6.2: Full verification sweep

Run and paste output:
- `npx vitest run` (all suites; the pre-existing `card.test.tsx` failures are unrelated and tracked)
- `npm run typecheck:strict-paths` → must be green
- `npm run typecheck` → confirm no NET-NEW errors vs the 73 known baseline
- `npm run lint`

Commit `test(progression): overhaul verification green`. **Push Phase 6.** Then offer `/code-review` and a Pages deploy (`npm run deploy:pages`) for live testing.

---

## Risks & notes

- **Back-compat:** all new set fields are optional; old stored sets (no `repMin/repMax/rir`) flow through the `null`/fallback branches. No data migration. Verify in Task 6.2 that loading a pre-existing workout doesn't throw.
- **`onComplete` signature change (4.2)** touches three files — do it in one task so the tree stays green.
- **Scope guard (YAGNI):** velocity-based training, RPE-curve calibration, and per-exercise increment profiles are explicitly out of scope this round.
- **Branch:** this overhaul is unrelated to `feat/whiteboard-chalkboard-ui`; recommend implementing on a fresh `feat/progression-engine` branch (or worktree) cut from `main`.
