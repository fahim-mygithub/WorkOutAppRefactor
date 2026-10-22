import type { WorkoutExercise } from '../../../types/exercise';

export interface WorkoutCardGroup {
  id: string;
  isSuperset: boolean;
  exercises: WorkoutExercise[];
  exerciseIndices: number[];
  firstExercise: WorkoutExercise;
  firstExerciseIndex: number;
  titles: string[];
}

export const WEIGHT_STEP = 5;
export const TIME_STEP = 5;

/** Weight nudge helper with 2-decimal-place rounding. */
export function nudgeWeight(value: number, dir: 1 | -1, step = WEIGHT_STEP): number {
  return Math.max(0, Math.round((value + dir * step) * 100) / 100);
}

/** Reps nudge helper. */
export function nudgeReps(value: number, dir: 1 | -1, step = 1): number {
  return Math.max(0, Math.round(value + dir * step));
}

/** Timed set duration nudge helper. */
export function nudgeTime(value: number, dir: 1 | -1, step = TIME_STEP): number {
  return Math.max(0, Math.round(value + dir * step));
}

export function groupWorkoutCards(exercises: WorkoutExercise[]): WorkoutCardGroup[] {
  const groups: WorkoutCardGroup[] = [];
  const supersetMap = new Map<string, WorkoutCardGroup>();

  exercises.forEach((exercise, exerciseIndex) => {
    if (exercise.isSuperset && exercise.supersetId) {
      const existing = supersetMap.get(exercise.supersetId);
      if (existing) {
        existing.exercises.push(exercise);
        existing.exerciseIndices.push(exerciseIndex);
        existing.titles.push(exercise.customTitle || exercise.exercise.name);
      } else {
        const group: WorkoutCardGroup = {
          id: exercise.supersetId,
          isSuperset: true,
          exercises: [exercise],
          exerciseIndices: [exerciseIndex],
          firstExercise: exercise,
          firstExerciseIndex: exerciseIndex,
          titles: [exercise.customTitle || exercise.exercise.name],
        };
        supersetMap.set(exercise.supersetId, group);
        groups.push(group);
      }
    } else {
      const group: WorkoutCardGroup = {
        id: exercise.id || `exercise-${exerciseIndex}`,
        isSuperset: false,
        exercises: [exercise],
        exerciseIndices: [exerciseIndex],
        firstExercise: exercise,
        firstExerciseIndex: exerciseIndex,
        titles: [exercise.customTitle || exercise.exercise.name],
      };
      groups.push(group);
    }
  });

  return groups;
}

/**
 * Labels superset exercises unambiguously as 'A', 'B', etc.
 * based on their position in the superset group.
 */
export function getExerciseTag(indexInCard = 0): string {
  return String.fromCharCode(65 + (indexInCard % 26));
}
