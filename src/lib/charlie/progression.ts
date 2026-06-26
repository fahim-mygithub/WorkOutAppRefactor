/**
 * Charlie-Split load logic that is pure & testable. Regime-A seeds the FIRST
 * session's working weight from the entered 1RM; thereafter the existing
 * performance-gated engine + a smoothed e1RM drive load (wired in a later phase —
 * see §3e/§3i). Volume/accessory work uses double progression elsewhere.
 */
import type { CompoundEntry } from './definition';
import { estimateOneRepMax, workingWeightFor1RM } from '../oneRepMax';

/** Regime-A seed: working weight from a %1RM compound's entered 1RM. */
export function seedWorkingWeight(entry: CompoundEntry, oneRm: number): number {
  return workingWeightFor1RM(oneRm, entry.scheme.percentOf1RM, entry.lift.equipment, {
    micro: entry.scheme.microLoad,
  });
}

/**
 * Smoothed e1RM that drives heavy-compound working weight between formal retests:
 * the best (highest) Epley estimate across the most recent heavy sessions, so a
 * single bad set never moves the program (1RM test CV ~4%). Returns null with no
 * history (caller falls back to the entered 1RM seed).
 */
export function smoothedE1RM(
  recent: ReadonlyArray<{ weight: number; reps: number }>,
  window = 3,
): number | null {
  if (recent.length === 0) return null;
  const slice = recent.slice(-window);
  return Math.max(...slice.map((s) => estimateOneRepMax(s.weight, s.reps)));
}

/** Epley estimate for a weighted pull-up, netting out bodyweight to a trainable max. */
export function pullupTrainable1RM(addedLoad: number, bodyweight: number, reps: number): number {
  const total = estimateOneRepMax(bodyweight + addedLoad, reps);
  return Math.max(0, total - bodyweight);
}
