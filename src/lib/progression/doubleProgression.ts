interface Prescription {
  repMin: number;
  repMax: number;
  sets: number;
}

interface LastSession {
  weight: number;
  reps: number[];
  rir?: number[];
}

interface NextPrescription {
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
 * never looked up from config. When `last` is null there is no weight to carry,
 * so this returns `weight: 0` and the caller supplies its own seed weight.
 */
export function nextDoubleProgression(
  prescription: Prescription,
  last: LastSession | null,
  increment: number,
): NextPrescription {
  const { repMin, repMax } = prescription;
  const base = { repMin, repMax };

  if (last === null) {
    return { ...base, weight: 0, repTarget: repMin, advanced: false, reason: 'first session' };
  }

  const topSet = Math.max(...last.reps);
  const worstSet = Math.min(...last.reps);
  const everySetAtTop = worstSet >= repMax;
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
