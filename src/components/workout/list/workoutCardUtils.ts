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

export function getExerciseTag(exercise: WorkoutExercise): string {
  const name = exercise.customTitle || exercise.exercise.name;
  if (/\braise\b/i.test(name)) return 'Raise';
  if (/\bincline\b/i.test(name)) return 'Incline';
  const nonEquipWords = name.split(/\s+/).filter(
    (w) => !/^(barbell|dumbbell|cable|machine|smith|weighted)$/i.test(w),
  );
  if (nonEquipWords.length > 0) return nonEquipWords[0];
  return name.split(/\s+/)[0] || 'Set';
}
