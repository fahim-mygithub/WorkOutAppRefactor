/**
 * Shared, pure read-helpers for a set's prescription. Single source of truth so
 * the editable reps default, the written `failed` flag, the in-session decision
 * floor, and the displayed range can never drift apart.
 */

/** The reps a set is judged against. */
interface RepFloor {
  reps: number;
  repMin?: number;
}

/** The bounds used to render a range label. */
interface RepBounds {
  repMin?: number;
  repMax?: number;
}

/**
 * The rep target floor: the prescribed range floor (`repMin`) when a range is
 * set, otherwise the single configured rep count. Double-progression starts at
 * the bottom of the range, so this is both the input default and the threshold a
 * logged set must clear to avoid being marked `failed`.
 */
export function prescribedFloor(set: RepFloor): number {
  return set.repMin ?? set.reps;
}

/**
 * The "10–15" (en-dash) range label, or `null` when there is no real range to
 * surface — i.e. the bounds are equal (single target) or either bound is absent.
 */
export function formatRepRange(set: RepBounds): string | null {
  const { repMin, repMax } = set;
  return repMin != null && repMax != null && repMin !== repMax
    ? `${repMin}–${repMax}`
    : null;
}
