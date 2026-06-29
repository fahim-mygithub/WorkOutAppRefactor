import { effortAdjustedE1RM } from './e1rm';

interface LoggedSet {
  weight: number;
  reps: number;
  rir?: number;
}

/** Best (max) effort-adjusted e1RM across one session's sets. 0 for an empty session. */
export function bestSetE1RM(sets: LoggedSet[]): number {
  let best = 0;
  for (const s of sets) {
    const e = effortAdjustedE1RM(s.weight, s.reps, s.rir);
    if (e > best) best = e;
  }
  return best;
}

/** Median of a non-empty numeric list (average of the two middle values when even). */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Smoothed session e1RM: the median of the per-session bests over the last
 * `window` sessions. Median (not max) so a single PR set cannot jump the
 * program and a single bad session cannot tank it. `null` when there is no history.
 */
export function smoothedSessionE1RM(
  sessions: LoggedSet[][],
  window = 3,
): number | null {
  if (sessions.length === 0) return null;
  const recent = sessions.slice(-window);
  return median(recent.map(bestSetE1RM));
}
