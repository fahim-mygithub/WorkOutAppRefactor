export interface Prescription {
  repMin: number;
  repMax: number;
  sets: number;
}

export interface LastSession {
  weight: number;
  reps: number[];
  rir?: number[];
}

export interface NextPrescription {
  weight: number;
  repTarget: number;
  repMin: number;
  repMax: number;
  advanced: boolean;
  reason: string;
}

/**
 * Double progression over a rep range: earn every set to the top of the range
 * (with real effort) before adding load, then reset to the floor.
 *
 * Pure: the load step is passed in as `increment` (already a real-world step),
 * never looked up from config. When `last` is null — OR no sets were logged —
 * there is no weight to carry, so this returns `weight: 0` and the caller
 * supplies its own seed weight.
 *
 * Load only advances when the lifter actually completed the prescribed work:
 * at least `prescription.sets` logged sets, every one at `repMax`, with
 * sufficient effort. A partial session (fewer sets than prescribed) holds.
 */
export function nextDoubleProgression(
  prescription: Prescription,
  last: LastSession | null,
  increment: number,
): NextPrescription {
  const { repMin, repMax, sets } = prescription;
  const base = { repMin, repMax };

  // No history, or an empty session (no logged sets) — nothing to carry.
  if (last === null || last.reps.length === 0) {
    return { ...base, weight: 0, repTarget: repMin, advanced: false, reason: 'first session' };
  }

  const topSet = Math.max(...last.reps);
  const worstSet = Math.min(...last.reps);
  const completedAllSets = last.reps.length >= sets;
  const everySetAtTop = completedAllSets && worstSet >= repMax;
  const effortSufficient = !last.rir || last.rir.every((r) => r <= 1);

  if (everySetAtTop && effortSufficient) {
    return {
      ...base,
      weight: last.weight + increment,
      repTarget: repMin,
      advanced: true,
      reason: `Added ${increment} lb — hit the top of every set; reset to ${repMin} reps`,
    };
  }

  if (topSet < repMin) {
    return {
      ...base,
      weight: last.weight,
      repTarget: repMin,
      advanced: false,
      reason: 'Missed the floor last time — rebuild to range floor',
    };
  }

  return {
    ...base,
    weight: last.weight,
    repTarget: Math.min(repMax, topSet + 1),
    advanced: false,
    reason: 'Hold the load and re-earn the top of the range',
  };
}
