import type { InSessionDecision } from '../../types/progression';
import type { LoggedSet } from './types';
import { round5 } from './round';

export interface SetTarget {
  repMin: number;
  repMax: number;
  weight: number;
  setIndex: number;
  totalSets: number;
}

/**
 * Real-time call after a logged set: continue, reduce, or end.
 *
 * Every `suggestedWeight` is derived from `logged.weight` — the load ACTUALLY
 * lifted — never a historical target. (This fixes a known bug where a cut was
 * applied to the prescribed weight instead of the one the lifter used.) Cuts are
 * rounded to the nearest 5 lb. Bodyweight sets never get a numeric cut.
 *
 * Note: the `InSessionDecision` action 'repeat' and the `suggestedReps` field are
 * reserved for a future redo-the-set path and are intentionally unused here today.
 */
export function inSessionDecision(t: SetTarget, logged: LoggedSet): InSessionDecision {
  const isLastSet = t.setIndex >= t.totalSets - 1;

  // Bodyweight / loadless: a percentage cut would be a silent no-op, so steer
  // toward an easier/harder variation instead of touching the (zero) load.
  if (t.weight <= 0 || logged.weight <= 0) {
    return isLastSet
      ? { action: 'end', message: 'Bodyweight set — adjust the variation, not the load, next session.' }
      : { action: 'continue', message: 'Bodyweight — switch to an easier variation if the reps run short. Keep your form tight.' };
  }

  // Last (or only) set: nothing left to change in-session.
  if (isLastSet) {
    return {
      action: 'end',
      message: 'Last set logged — no change now; next session is set from how this went.',
    };
  }

  // Hit the range.
  if (logged.reps >= t.repMin) {
    if (logged.rir === 0) {
      return {
        action: 'continue',
        message: 'You hit failure but made the range — fine to hold this load for the next set.',
      };
    }
    return {
      action: 'continue',
      message: 'In the range with reps in reserve — keep this load going.',
    };
  }

  // Missed the floor, sets remain — cut off the weight actually lifted.
  if (logged.reps >= t.repMin - 2) {
    return {
      action: 'reduce',
      suggestedWeight: round5(logged.weight * 0.9),
      message: 'A touch short of the range — drop ~10% to finish the working sets in range.',
    };
  }

  return {
    action: 'reduce',
    suggestedWeight: round5(logged.weight * 0.85),
    message: 'Well below the range — reset ~15% lighter and rebuild the reps.',
  };
}
