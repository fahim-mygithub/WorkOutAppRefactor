/**
 * 1RM math for the Charlie Split — Epley estimate, research-validated %1RM
 * anchors, and equipment-aware rounding (with an optional micro-loading tier).
 *
 * Design notes (see docs/plans/…charlie split): working %1RM targets sit a few
 * percent BELOW the single-set rep-max so all four working sets are reachable.
 * These values SEED session 1; thereafter performance-gated double progression
 * and a smoothed e1RM drive the load (see progressiveOverloadService / §3i).
 */
import type { EquipmentType } from '../types/progression';

/** Epley 1RM estimate. `reps <= 1` returns the weight unchanged. */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

/** Inverse of `estimateOneRepMax`: the load that yields `oneRm` for `reps` reps.
 *  `reps <= 1` returns `oneRm` unchanged (mirrors the Epley guard above). */
export function loadForReps(oneRm: number, reps: number): number {
  if (reps <= 1) return oneRm;
  return oneRm / (1 + reps / 30);
}

/**
 * Research-validated multi-set %1RM anchors (Nuzzo 2024 reconciled to a 4-set
 * working target, ~3–5% below the single-set rep-max). Monotonically decreasing;
 * linearly interpolated between anchors. Heavy compound schemes pin their own
 * `percentOf1RM` explicitly in the definition; this is the general fallback.
 */
const REP_PERCENT_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [1, 1.0],
  [2, 0.9],
  [3, 0.85],
  [4, 0.845],
  [5, 0.84],
  [6, 0.82],
  [8, 0.74],
  [10, 0.72],
  [12, 0.7],
  [15, 0.65],
];

export function percentForReps(reps: number): number {
  if (reps <= 1) return 1;
  if (reps >= 15) return 0.65;
  for (let i = 1; i < REP_PERCENT_ANCHORS.length; i++) {
    const [r0, p0] = REP_PERCENT_ANCHORS[i - 1];
    const [r1, p1] = REP_PERCENT_ANCHORS[i];
    if (reps <= r1) {
      const t = (reps - r0) / (r1 - r0);
      return p0 + t * (p1 - p0);
    }
  }
  return 0.65;
}

export interface RoundOpts {
  /** Use the fine micro-loading step (fractional plates / add-ons) where available. */
  micro?: boolean;
}

/** Smallest practical real-world weight step for an equipment type. */
export function incrementStep(equipment: EquipmentType, micro = false): number {
  switch (equipment) {
    case 'barbell':
    case 'smith-machine':
      return micro ? 1.25 : 2.5;
    case 'dumbbell':
      return micro ? 1.25 : 5; // per-dumbbell
    case 'cable':
    case 'plate':
      return micro ? 2.5 : 5;
    case 'machine':
      return micro ? 2.5 : 10; // magnet add-ons make the fine step
    case 'kettlebell':
      return micro ? 4 : 8; // kettlebells jump coarsely
    default:
      return micro ? 1.25 : 5; // bodyweight added-load, band, trx
  }
}

/** Round a weight to the nearest real-world increment for its equipment. */
export function roundToIncrement(
  weight: number,
  equipment: EquipmentType,
  opts: RoundOpts = {},
): number {
  const step = incrementStep(equipment, opts.micro);
  return Math.round(weight / step) * step;
}

/** Working weight = round(1RM × percent) for the equipment's increment. */
export function workingWeightFor1RM(
  oneRm: number,
  percent: number,
  equipment: EquipmentType,
  opts: RoundOpts = {},
): number {
  return roundToIncrement(oneRm * percent, equipment, opts);
}
