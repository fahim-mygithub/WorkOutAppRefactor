/**
 * The engine's gate on AI-proposed loads: within ±30% of the reference (what
 * the lifter is or was about to lift) and on the equipment's step. A small
 * miss (off-step) snaps; anything else is rejected with a reason.
 */
import { roundLoad } from './trackedLiftProgression';
import type { WeightUnit } from '../types/trackedLifts';

export const MAX_CHANGE = 0.3;

export type LoadCheck =
  | { ok: true; value: number; snapped: boolean }
  | { ok: false; reason: string };

export function checkProposedLoad(
  proposed: number,
  reference: number | null,
  unit: WeightUnit,
  step?: number,
): LoadCheck {
  if (!(proposed > 0)) return { ok: false, reason: 'Load must be above zero.' };
  if (reference != null && reference > 0 && Math.abs(proposed / reference - 1) > MAX_CHANGE) {
    return { ok: false, reason: `${proposed} ${unit} is too far from ${reference} ${unit}.` };
  }
  const value = roundLoad(proposed, unit, step);
  return { ok: true, value, snapped: value !== proposed };
}
