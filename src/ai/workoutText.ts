/**
 * Parser-format text for workouts the AI writes or reads ("3x8-12 Bench Press
 * @135lbs", supersets joined by " ss "), so a saved workout opens in Build's
 * Text tab the same way a typed one does.
 */
import type { ParsedExercise, ParsedWorkout } from '../parser/types';

/** One exercise as a parser line, from its first set and its set count. */
export function exerciseLine(e: ParsedExercise): string {
  const first = e.sets[0];
  if (!first) return e.name;
  const reps = typeof first.reps === 'number' ? `${first.reps}` : `${first.reps.min}-${first.reps.max}`;
  const load = first.weight ? ` @${first.weight}${first.unit ?? 'lbs'}` : '';
  return `${e.sets.length}x${reps} ${e.name}${load}`;
}

/** One superset as a parser line. */
export const supersetLine = (group: readonly ParsedExercise[]): string => group.map(exerciseLine).join(' ss ');

/** The whole workout as parser text: straight sets, then supersets. */
export function workoutText(w: ParsedWorkout): string {
  return [...w.exercises.map(exerciseLine), ...(w.supersets ?? []).map(supersetLine)].join('\n');
}
