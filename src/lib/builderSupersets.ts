/**
 * Supersets made in the builder's Visual tab. The pairing is stored ON the
 * exercises (`supersetGroup`), not in the configurator's component state, so it
 * survives reorders and reaches the workout that gets started.
 */

export interface GroupableExercise {
  supersetGroup?: number;
}

/** Drop groups left with a single member (a superset of one is not one). */
function pruneSingles<T extends GroupableExercise>(exercises: T[]): T[] {
  const counts = new Map<number, number>();
  for (const ex of exercises) {
    if (ex.supersetGroup != null) counts.set(ex.supersetGroup, (counts.get(ex.supersetGroup) ?? 0) + 1);
  }
  return exercises.map((ex) => {
    if (ex.supersetGroup == null || (counts.get(ex.supersetGroup) ?? 0) > 1) return ex;
    const { supersetGroup: _dropped, ...rest } = ex;
    return rest as T;
  });
}

/**
 * Pair exercise `b` with `a`. If `a` is already in a superset, `b` joins it
 * (tri-sets); otherwise both start a new group. `b` leaves any old group.
 */
export function pairSuperset<T extends GroupableExercise>(exercises: T[], a: number, b: number): T[] {
  if (a === b || !exercises[a] || !exercises[b]) return exercises;
  const used = exercises.map((ex) => ex.supersetGroup ?? 0);
  const group = exercises[a].supersetGroup ?? Math.max(0, ...used) + 1;
  const next = exercises.map((ex, i) => (i === a || i === b ? { ...ex, supersetGroup: group } : ex));
  return pruneSingles(next);
}

/** Take one exercise out of its superset (a partner left alone is freed too). */
export function unpairSuperset<T extends GroupableExercise>(exercises: T[], index: number): T[] {
  const next = exercises.map((ex, i) => {
    if (i !== index) return ex;
    const { supersetGroup: _dropped, ...rest } = ex;
    return rest as T;
  });
  return pruneSingles(next);
}

/** After a delete: keep the remaining groups valid. */
export function removeExercise<T extends GroupableExercise>(exercises: T[], index: number): T[] {
  return pruneSingles(exercises.filter((_, i) => i !== index));
}

/**
 * The workout order: each superset's members pulled together at the position
 * of its first member (the player expects partners to be adjacent).
 */
export function orderForWorkout<T extends GroupableExercise>(exercises: T[]): (T | T[])[] {
  const units: (T | T[])[] = [];
  const seen = new Set<number>();
  for (const ex of exercises) {
    if (ex.supersetGroup == null) {
      units.push(ex);
    } else if (!seen.has(ex.supersetGroup)) {
      seen.add(ex.supersetGroup);
      units.push(exercises.filter((e) => e.supersetGroup === ex.supersetGroup));
    }
  }
  return units;
}
