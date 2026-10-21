# List mode for the workout screen — design

2026-10-21. Branch: feat/tempo-ui.

## Why

The player flips through one exercise at a time. Once you know the routine you
want the whole day on one page, loggable, with the rest timer. List mode is that;
cards mode stays the default.

## Decisions

- **Logging:** inline steppers per set (the existing `SetInput`), not tap-to-check.
- **Switch:** a Cards/List toggle in the workout top bar, switchable mid-workout.
  The choice is remembered (`workoutViewMode`: `'cards' | 'list'`, localStorage,
  default `'cards'`). Both views read and write the same `activeWorkout`, so
  switching loses nothing.
- **Supersets:** no grouped card. Each exercise is its own card in workout order;
  members show the player's "Superset with X + Y" badge and link icon.
  Rest follows the existing logic (any logged set starts the rest timer); list
  mode does not force A→B alternation.
- **In-session cue:** shown as a slim inline strip under the set just logged, with
  the same Apply / Keep actions. Apply fills the remaining sets through the
  existing `overrideWeight` path.

## Structure

`components/workout/list/WorkoutListView.tsx` renders one scrollable page, one card
per exercise:

- Header: name, "3 of 4 sets done", superset badge, Replace and Edit-sets buttons.
- Body: one `SetInput` per set. A logged set collapses to a checked summary row
  ("8×70 ✓"); tapping it reopens it to edit or undo.
- Also: a "Last time" line and a "How to" link to the existing instructions modal.
- Dropped versus the player: the demo clip and the set-chip row.
- The existing `RestTimerBar` stays pinned at the bottom.
- `WorkoutTopBar` gains the toggle; its segment strip scrolls to that exercise.

## Wiring

`completeSet` / `uncompleteSet` already take `exerciseIndex` + `setIndex`, so no
Redux changes. In `WorkoutPage.tsx`, lift the complete-set logic (in-session
suggestion, superset advance, rest-timer start) into a handler taking
`(exerciseIndex, setIndex, reps, weight, rir)`. The player calls it with the
current indices, the list with the row's. One source of truth for rest and
superset behavior.

Per-set weight precedence is unchanged: applied load > the set's own weight >
progression recommendation (fills empty sets only).

## Error handling and edge cases

- Empty or single-exercise workouts render normally.
- The suggestion strip is per logged set and clears on undo, as in the player.
- If the stored mode is missing or unreadable, fall back to cards.

## Testing

- Unit: the lifted handler (indices, superset advance, rest start), the view-mode
  preference (default and fallback), `WorkoutListView` (renders every exercise,
  logs the right set, collapses a logged set, shows the superset badge).
- Browser: demo build, 390px iframe (see phone-viewport testing): log sets across
  exercises, toggle modes mid-workout, check the rest timer and the cue.
