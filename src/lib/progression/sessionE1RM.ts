import { effortAdjustedE1RM } from './e1rm';
import type { LoggedSet } from './types';

/** Best (max) effort-adjusted e1RM across one session's sets. 0 for an empty session. */
export function bestSetE1RM(sets: LoggedSet[]): number {
  return sets.reduce((best, s) => Math.max(best, effortAdjustedE1RM(s.weight, s.reps, s.rir)), 0);
}

/** Median of a non-empty numeric list (average of the two middle values when even). */
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Smooth a session history to one number: each session collapses to its best set
 * via `estimator`, sessions with no usable load (best ≤ 0) drop out, then the
 * median of the last `window` real sessions. Median (not max) so a single PR set
 * cannot jump the program and a single bad session cannot tank it. `null` when
 * nothing usable remains. Generic over the logged-set shape so callers can supply
 * their own per-set estimator (e.g. bodyweight-netting for pull-ups).
 */
export function smoothedSessions<T>(
  sessions: ReadonlyArray<ReadonlyArray<T>>,
  estimator: (set: T) => number,
  window = 3,
): number | null {
  const bests = sessions
    .map((sets) => sets.reduce((best, s) => Math.max(best, estimator(s)), 0))
    .filter((e) => e > 0);
  if (bests.length === 0) return null;
  return median(bests.slice(-window));
}

/**
 * Smoothed session e1RM: the median of the per-session bests over the last
 * `window` sessions, each set effort-adjusted for reps-in-reserve. `null` when
 * there is no usable history.
 */
export function smoothedSessionE1RM(
  sessions: LoggedSet[][],
  window = 3,
): number | null {
  return smoothedSessions(sessions, (s) => effortAdjustedE1RM(s.weight, s.reps, s.rir), window);
}
