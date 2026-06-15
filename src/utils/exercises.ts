import { Exercise } from '../types/exercise';

// NOTE: The CSV parsing path (papaparse + parseExerciseCSV + loadExercisesFromCSV)
// has been removed. The exercise database is now generated at build time into
// public/exercises.json (see scripts/build-exercises.mjs) and loaded via
// src/utils/loadExercises.ts, so papaparse no longer ships in the client bundle.

export const filterExercises = (exercises: Exercise[], searchTerm: string, muscleGroup?: string): Exercise[] => {
  let filtered = exercises;

  if (searchTerm) {
    const search = searchTerm.toLowerCase();
    filtered = filtered.filter(exercise =>
      exercise.name.toLowerCase().includes(search) ||
      exercise.muscleGroup.toLowerCase().includes(search) ||
      exercise.muscleGroups.some(mg => mg.toLowerCase().includes(search)) ||
      exercise.equipment.toLowerCase().includes(search) ||
      exercise.searchKeywords.some(keyword =>
        keyword.toLowerCase().includes(search)
      ) ||
      exercise.instructions.some(instruction =>
        instruction.toLowerCase().includes(search)
      )
    );
  }

  if (muscleGroup && muscleGroup !== 'all') {
    filtered = filtered.filter(exercise =>
      exercise.muscleGroups.some(mg => mg.toLowerCase() === muscleGroup.toLowerCase()) ||
      exercise.muscleGroup.toLowerCase() === muscleGroup.toLowerCase()
    );
  }

  return filtered;
};
