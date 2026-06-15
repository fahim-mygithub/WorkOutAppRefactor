// Pure timestamp math for the background-resilient rest timer.
//
// The timer is anchored to an absolute `targetEndTime` (epoch ms) captured when
// it starts, rather than decremented by a `setInterval`. A bare interval drifts
// (timers throttle in the background) and freezes (timers stop entirely when the
// tab is fully backgrounded), so on resume the displayed time would be wrong.
// Deriving the remaining time from `Date.now()` against the stored anchor means
// the value is always correct the moment we recompute it — on each tick and on
// `visibilitychange` — regardless of how long the tab was away.
//
// Kept dependency-free and side-effect-free so it lives under the strict-paths
// TS gate (src/lib/**) and is exhaustively unit-testable without a clock mock.

/**
 * Absolute epoch-ms instant at which a timer started `now` for `durationSeconds`
 * should fire completion. Negative durations clamp to `now` (end immediately)
 * so a target is never placed in the past.
 */
export function computeTargetEndTime(
  durationSeconds: number,
  now: number,
): number {
  return now + Math.max(0, durationSeconds) * 1000;
}

/**
 * Whole seconds remaining until `targetEndTime`, derived from `now`. Rounds the
 * partial second up (ceil) so the display never shows `0` while time genuinely
 * remains, and never drops below `0` even when the tab resumes long past the
 * end time.
 */
export function remainingSeconds(targetEndTime: number, now: number): number {
  return Math.max(0, Math.ceil((targetEndTime - now) / 1000));
}

/** True once `now` has reached or passed `targetEndTime`. */
export function isElapsed(targetEndTime: number, now: number): boolean {
  return now >= targetEndTime;
}
