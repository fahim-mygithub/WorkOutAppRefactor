/**
 * Muscle heat for the Home body map: which muscles were worked recently and
 * how hard, cooling down over two days.
 *
 * On the last day a muscle was worked:
 *   - 2+ exercises hit it → hot (red); 1 exercise → warm (orange).
 * Then, with no more work on it:
 *   - hot turns warm after 1 day (one rest day);
 *   - anything goes back to rest (grey) 2 days after it was last worked.
 *
 * Days are local calendar days, so a Monday-night workout is "1 day ago" on
 * Tuesday morning.
 */
import { ALL_MUSCLE_TERMS, MUSCLE_TERMS } from './muscleTerms';

export type HeatLevel = 'hot' | 'warm';

/** One exercise from a finished workout, reduced to the muscles it hit. */
export interface MuscleLogEntry {
  /** ISO date-time the workout was finished. */
  date: string;
  /** The workout it came from (used to de-duplicate local vs. synced history). */
  workoutId?: string;
  /** Muscle terms (see ALL_MUSCLE_TERMS). */
  terms: string[];
}

/** Hot needs this many exercises on the day. */
export const HOT_EXERCISES = 2;
/** A muscle is back to rest this many days after it was last worked. */
export const COOL_DAYS = 2;

/**
 * Terms an exercise hits, from its catalog muscle list (which may also carry
 * equipment words, e.g. "Barbell, Chest, Mid and Lower Chest"). Substring
 * match, the same rule the body map's tap-to-filter uses.
 */
export function musclesForExercise(exercise: { muscleGroup?: string; muscleGroups?: string[] }): string[] {
  const text = [exercise.muscleGroup ?? '', ...(exercise.muscleGroups ?? [])].join(', ').toLowerCase();
  if (!text.trim()) return [];
  return ALL_MUSCLE_TERMS.filter((term) => text.includes(term.toLowerCase()));
}

function dayKey(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((dayKey(to) - dayKey(from)) / 86_400_000);
}

/** Current heat per muscle term; rested muscles are absent. */
export function muscleHeat(entries: readonly MuscleLogEntry[], now: Date = new Date()): Record<string, HeatLevel> {
  // term → { last day worked, exercises on that day }
  const last = new Map<string, { day: number; count: number; date: Date }>();
  for (const entry of entries) {
    const date = new Date(entry.date);
    if (Number.isNaN(date.getTime())) continue;
    const day = dayKey(date);
    for (const term of new Set(entry.terms)) {
      const seen = last.get(term);
      if (!seen || day > seen.day) last.set(term, { day, count: 1, date });
      else if (day === seen.day) seen.count += 1;
    }
  }

  const heat: Record<string, HeatLevel> = {};
  for (const [term, { count, date }] of last) {
    const since = daysBetween(date, now);
    if (since < 0 || since >= COOL_DAYS) continue;
    heat[term] = count >= HOT_EXERCISES && since === 0 ? 'hot' : 'warm';
  }
  return heat;
}

/** SVG group ids per term (Shoulders → front + rear, Traps → traps + middle). */
export function groupIdsByTerm(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [id, term] of Object.entries(MUSCLE_TERMS)) (out[term] ??= []).push(id);
  return out;
}
