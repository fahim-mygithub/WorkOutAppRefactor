# Tracked-lift progression: Volume / Strength / Checkpoint

Date: 2026-09-26 · Branch: `feat/tempo-ui` · Status: built (see Implementation notes)

## Goal

Tracked lifts (Build page) are benchmarks the user wants to beat. Some are
**progression lifts** (e.g. Bench Press 265 1RM): the builder works their sets out
from the workout log, alternating Volume and Strength sessions, with a dedicated
**checkpoint day** (a max attempt) after 2 of each. Everything else is an
**accessory**: repeated exactly as tracked until the user edits the entry.

## Two kinds of tracked lift

| | Progression lift | Accessory (default) |
|---|---|---|
| Set by | Flag button on the list row (tap to toggle) | Flag off |
| Volume/Strength switch | Applies | Ignored |
| Sets come from | Current estimate (log) | The tracked entry, verbatim |
| Checkpoint | After 2 Volume + 2 Strength sessions | None |
| "New best" prompt | Yes | No |
| Moves up | From the log | Only when the user edits the entry |

## Build page (chooser)

- Each tracked-lift row: checkbox (left) · name + target (tap → editor) · load ·
  **progression flag** (right, IconButton, amber when on, `aria-pressed`).
- Flagged rows add a status line: `est. 248 · goal 265 · V 1/2 S 2/2`, or
  `Checkpoint due`, or `No history yet`.
- **Volume | Strength** segmented switch appears above the button only when a
  progression lift is checked; defaults to the goal used last.
- If any checked progression lift is due, the button reads **Build checkpoint
  day**: the workout contains only the due lifts, with a line naming the ones
  left out, and the switch hides. Otherwise **Build workout**: progression lifts
  are prescribed for the chosen goal, accessories copied from their entry.
- The lift editor gets a **Sets** field (default 3) so an accessory entry is a
  complete plan (e.g. Seal Row 3 × 10 @ 160 lb).

## Current estimate (progression lifts)

1. Link the lift to a library exercise on first build (exact name, then the
   builder's existing matcher) and store `exerciseId` on the lift.
2. Estimate = `smoothedSessionE1RM` over that exercise's history: each session's
   best effort-adjusted e1RM, median of the last 3.
3. No history → the benchmark: repMax N → e1RM of (load, N); reps target →
   e1RM of (load, min reps); no target → e1RM of (load, 10).

## Prescriptions

Weighted loads (rounded to 5 lb / 2.5 kg):

| Goal | Sets × reps | Load | Rest |
|---|---|---|---|
| Strength | 4 × 3 | 85% of estimate | 3 min |
| Volume | 4 × 8–12 | 65–70% of estimate | 90 s |
| Checkpoint | 5@50%, 3@70%, 1@85%, 1@95%, then 1 @ 100–102% | | 3 min |

Volume uses the existing double progression (top of range on every set → add load).

Exceptions (no load math; the tracked step/load is kept):

| Load kind | Volume | Strength | Checkpoint |
|---|---|---|---|
| Level (med ball, band) | 4 × 12 | 5 × 5 + "Try the next step up" | Next step for the usual reps |
| Bodyweight (± added) | 4 × 12 | 5 × 5 | Max reps (or heavier added single) |
| Time under tension | 4 holds at time | 3 holds at time × 1.25 | One max hold |

## Cycle counting

- Built exercises carry `goal: 'volume' | 'strength' | 'checkpoint'` through the
  active workout into history, so only **finished** workouts count.
- One session per lift per workout. Due when `volume ≥ 2 && strength ≥ 2`
  (any order). Finishing a checkpoint resets both to 0.
- Editing a benchmark by hand does not reset the cycle.

## New best

At workout complete, for each progression lift: a logged set beats the benchmark
if it is heavier at ≥ the benchmark reps, or more reps at the same load (1RM:
a heavier single). Show a "New best" card: **Update benchmark** / **Keep**.

## Data changes

`TrackedLift` adds: `progression?: boolean`, `sets?: number`,
`exerciseId?: string`, `lastGoal?: 'volume' | 'strength'`,
`cycle?: { volume: number; strength: number }`. Storage stays local (as today);
Firestore sync is a later step.

## Code layout

- Pure logic in `src/lib/trackedLifts/` (tested): `currentEstimate`,
  `prescribe(lift, goal, estimate)` (switch on load kind), `checkpointDue`,
  `beatsBenchmark`, `recordSession`.
- UI: `TrackedLifts` row flag + status, `TrackedLiftEditor` Sets field,
  `BuildWizardPage` switch + button label, `BuildPage` receives prescribed sets
  (as today), workout-complete counting + New best cards.

## Edge cases

Missing exercise link → re-resolve by name. Lift appearing twice in one workout
→ counted once. Unit mismatch → convert the estimate to the lift's unit.

## Implementation notes (as built)

- **Log source:** each tracked lift keeps its own session log (last 6 finished
  sessions, recorded on Save and end) instead of linking to Firestore exercise
  history. Works offline and in the demo build; sessions of the same exercise
  logged outside a tracked build don't count toward the estimate or cycle.
- **Checkpoint attempt floor:** the attempt is max(102% of the estimate, one
  loadable step above the benchmark), and the warm-up ladder scales from it, so
  submaximal logged sets (no RIR tapped) never make a checkpoint target below
  the benchmark.
- **Seed:** Bench Press and Front Squat start flagged; Seal Row is an accessory.
- New best sheet is app-wide (AppShell) and never opens over the player.
