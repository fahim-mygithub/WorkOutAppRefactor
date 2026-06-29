import { estimateOneRepMax } from '../oneRepMax';

/** e1RM accounting for unused reps: a set left N reps short of failure is
 *  estimated as a max-effort set of (reps + N) at the same load. */
export function effortAdjustedE1RM(weight: number, reps: number, rir = 0): number {
  if (weight <= 0 || reps <= 0) return 0;
  return estimateOneRepMax(weight, reps + Math.max(0, rir));
}
