/**
 * Recommend-by-muscle engine for the build wizard's "By muscle group" branch.
 *
 * Given the loaded exercise catalog and a muscle term (one of ALL_MUSCLE_TERMS),
 * it finds the candidate pool, picks a sensible default ("recommend one"), and
 * supports re-rolling a different one ("randomize") and hydrating the chosen
 * Exercise into a launch-ready `WorkoutExercise` with default sets.
 *
 * Matching mirrors the `filterByMuscle` reducer: a case-insensitive SUBSTRING
 * match against the comma-joined `muscleGroup` field (and the `muscleGroups[]`
 * array). Because we only ever query by a curated muscle term — never enumerate
 * groups — the equipment tokens that pollute those fields can't surface as
 * "muscles" here; they simply never match a muscle term.
 */
import type {
  Exercise,
  ExerciseDifficulty,
  WorkoutExercise,
  WorkoutSet,
} from '../types/exercise';

export const DEFAULT_SET_COUNT = 3;
export const DEFAULT_REPS = 10;
export const DEFAULT_REST_SECONDS = 120;

const DIFFICULTY_RANK: Record<ExerciseDifficulty, number> = {
  Beginner: 0,
  Novice: 1,
  Intermediate: 2,
  Advanced: 3,
  Expert: 4,
};

/**
 * Equipment "categories" in the catalog that are NOT resistance training and so
 * must never be recommended/offered as a muscle's exercise: mobility, yoga,
 * static stretches, and cardio drills. These are tagged with muscleGroups + a
 * mechanic just like real lifts (so neither field filters them), but their
 * `equipment` cleanly identifies them. Excluding these is what stops "Cobra
 * Pose" being recommended for Lower back or "Cardio Box Quick Feet" for Calves.
 * Verified against public/exercises.json: every muscle term keeps a healthy pool
 * (smallest, Calves, is 37) after exclusion.
 */
export const NON_STRENGTH_EQUIPMENT: ReadonlySet<string> = new Set([
  'recovery',
  'yoga',
  'stretches',
  'cardio',
]);

function isStrengthExercise(e: Exercise): boolean {
  return !NON_STRENGTH_EQUIPMENT.has(e.equipment.toLowerCase().trim());
}

/**
 * Candidate pool for a muscle term: every STRENGTH exercise that trains it
 * (mobility/yoga/stretch/cardio excluded). Substring match against the
 * comma-joined `muscleGroup` and the `muscleGroups[]` array — mirrors the
 * `filterByMuscle` reducer, plus the strength filter.
 */
export function exercisesForMuscle(exercises: Exercise[], term: string): Exercise[] {
  const t = term.toLowerCase().trim();
  if (!t) return [];
  return exercises.filter(
    (e) =>
      isStrengthExercise(e) &&
      (e.muscleGroup.toLowerCase().includes(t) ||
        e.muscleGroups.some((mg) => mg.toLowerCase().includes(t))),
  );
}

/**
 * How "primary" the muscle is for this exercise. The catalog lists muscles
 * roughly primary-mover first in `muscleGroups[]` (after an optional equipment
 * token), so a small index means the term is a main target; a large index (or
 * absence from the array) means it's only a stabilizer. This is the dominant
 * ranking signal — it's what stops a bench press being recommended for "Abs".
 */
function primaryIndex(e: Exercise, lowerTerm: string): number {
  const idx = e.muscleGroups.findIndex((mg) => mg.toLowerCase().includes(lowerTerm));
  return idx === -1 ? 99 : idx;
}

/**
 * Recommendation ordering for a given muscle term:
 *   1. primary mover first (term appears earliest in muscleGroups),
 *   2. then compound lifts (they anchor a muscle's day),
 *   3. then easier-to-perform first,
 *   4. then alphabetical for a stable tiebreak.
 * Pure + deterministic, so the default pick is repeatable (randomize is the only
 * source of variation).
 */
function recommendationRank(a: Exercise, b: Exercise, lowerTerm: string): number {
  const aPrimary = primaryIndex(a, lowerTerm);
  const bPrimary = primaryIndex(b, lowerTerm);
  if (aPrimary !== bPrimary) return aPrimary - bPrimary;

  const aCompound = a.mechanic === 'Compound' ? 0 : 1;
  const bCompound = b.mechanic === 'Compound' ? 0 : 1;
  if (aCompound !== bCompound) return aCompound - bCompound;

  const aDiff = DIFFICULTY_RANK[a.difficulty] ?? 2;
  const bDiff = DIFFICULTY_RANK[b.difficulty] ?? 2;
  if (aDiff !== bDiff) return aDiff - bDiff;

  return a.name.localeCompare(b.name);
}

/**
 * The default recommended exercise for a muscle term, or undefined if the
 * catalog has nothing for it. `excludeIds` lets callers avoid duplicating an
 * exercise already placed in the workout (e.g. when adding a second exercise for
 * the same muscle).
 */
export function recommendOne(
  exercises: Exercise[],
  term: string,
  excludeIds: ReadonlySet<string> = new Set(),
): Exercise | undefined {
  const pool = exercisesForMuscle(exercises, term).filter((e) => !excludeIds.has(e.id));
  if (pool.length === 0) return undefined;
  const lowerTerm = term.toLowerCase().trim();
  return [...pool].sort((a, b) => recommendationRank(a, b, lowerTerm))[0];
}

/**
 * A RANDOM different exercise for a muscle term (the "randomize" / re-roll
 * action). Prefers something not already in use (`excludeIds`); if everything is
 * excluded it re-rolls within the full pool but still avoids `avoidId` (the
 * exercise being replaced) so "randomize" never silently returns the same thing.
 * Returns undefined only when the muscle has no strength exercises at all, or a
 * single one (nothing else to pick).
 */
export function randomForMuscle(
  exercises: Exercise[],
  term: string,
  excludeIds: ReadonlySet<string> = new Set(),
  avoidId?: string,
): Exercise | undefined {
  const full = exercisesForMuscle(exercises, term);
  if (full.length === 0) return undefined;

  let pool = full.filter((e) => !excludeIds.has(e.id));
  if (pool.length === 0) {
    // Everything is excluded — re-roll within the full pool, but still skip the
    // exercise we're replacing so the user always sees a change.
    pool = avoidId ? full.filter((e) => e.id !== avoidId) : full;
    if (pool.length === 0) pool = full; // pool of exactly one — unavoidable.
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

/** A short unique id suffix; runtime-only (never used inside workflow scripts). */
function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Default sets for a freshly added exercise (weight left blank for the user). */
export function buildDefaultSets(
  count: number = DEFAULT_SET_COUNT,
  reps: number = DEFAULT_REPS,
): WorkoutSet[] {
  return Array.from({ length: count }, () => ({
    id: uid('set'),
    reps,
    completed: false,
  }));
}

/** Hydrate a catalog Exercise into a launch-ready WorkoutExercise. */
export function toWorkoutExercise(exercise: Exercise): WorkoutExercise {
  return {
    id: uid('ex'),
    exercise,
    sets: buildDefaultSets(),
    restTime: DEFAULT_REST_SECONDS,
  };
}
