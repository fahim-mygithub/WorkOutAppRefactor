/**
 * Charlie-Split load logic that is pure & testable. Regime-A seeds the FIRST
 * session's working weight from the entered 1RM; thereafter the smoothed e1RM
 * from logged history drives load (see generateDay.ts). Volume/accessory work
 * uses double progression elsewhere.
 */
import type { CompoundEntry } from './definition';
import type { EquipmentType } from '../../types/progression';
import type { LoggedSet } from '../progression';
import { loadForReps, roundToIncrement, workingWeightFor1RM } from '../oneRepMax';
import { effortAdjustedE1RM, smoothedSessions } from '../progression';

/** Regime-A seed: working weight from a %1RM compound's entered (or smoothed) 1RM. */
export function seedWorkingWeight(entry: CompoundEntry, oneRm: number): number {
  return workingWeightFor1RM(oneRm, entry.scheme.percentOf1RM, entry.lift.equipment, {
    micro: entry.scheme.microLoad,
  });
}

/**
 * Trainable 1RM for a weighted pull-up: the bodyweight-net Epley estimate, effort-
 * adjusted for reps-in-reserve so a set left `rir` reps short counts as a heavier
 * max (parity with the compound path). Clamped at 0.
 */
export function pullupTrainable1RM(
  addedLoad: number,
  bodyweight: number,
  reps: number,
  rir = 0,
): number {
  return Math.max(0, effortAdjustedE1RM(bodyweight + addedLoad, reps, rir) - bodyweight);
}

/**
 * Smoothed weighted-pull-up trainable 1RM from history: each session's best
 * bodyweight-net trainable max (RIR-aware), median-smoothed over the last `window`
 * sessions via the shared pipeline. `null` with no usable history.
 */
export function smoothedPullupTrainable1RM(
  sessions: LoggedSet[][],
  bodyweight: number,
  window = 3,
): number | null {
  return smoothedSessions(
    sessions,
    (s) => pullupTrainable1RM(s.weight, bodyweight, s.reps, s.rir),
    window,
  );
}

/**
 * Added load that nets `reps` reps at the given trainable 1RM (inverse Epley),
 * rounded to the equipment's real-world step and clamped at 0 (= bodyweight only).
 */
export function addedLoadForReps(
  trainable1RM: number,
  bodyweight: number,
  reps: number,
  equipment: EquipmentType,
): number {
  const total = loadForReps(bodyweight + trainable1RM, reps);
  return Math.max(0, roundToIncrement(total - bodyweight, equipment));
}
