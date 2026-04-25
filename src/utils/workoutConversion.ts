import { WorkoutExercise, WorkoutSet, Exercise } from '../types/exercise';
import { SavedWorkout } from '../services/workoutStorageService';
import { ExerciseHistory, WorkoutSummary } from '../types/exerciseHistory';

/**
 * Helper function to find exercise in database with improved matching
 */
export const findExerciseInDatabase = (exerciseName: string, exerciseDatabase: Exercise[]): Exercise | null => {
  const name = exerciseName.toLowerCase().trim();

  // First try exact match
  const exactMatch = exerciseDatabase.find(ex =>
    ex.name.toLowerCase() === name
  );
  if (exactMatch) return exactMatch;

  // Try partial match (database name contains search term or vice versa)
  const partialMatch = exerciseDatabase.find(ex => {
    const dbName = ex.name.toLowerCase();
    return dbName.includes(name) || name.includes(dbName);
  });
  if (partialMatch) return partialMatch;

  // Then try common variations (handle plurals, common abbreviations)
  const variations = [
    name,
    name.endsWith('s') ? name.slice(0, -1) : name + 's', // Handle plurals
    name.replace(/\bbarbell\b/g, 'bb').replace(/\bdumbbell\b/g, 'db'), // Common abbreviations
    name.replace(/\bbb\b/g, 'barbell').replace(/\bdb\b/g, 'dumbbell'), // Expand abbreviations
    name.replace(/\bpress\b/g, ''), // Try without "press"
    name + ' press', // Try adding "press"
  ];

  for (const variation of variations) {
    const match = exerciseDatabase.find(ex => {
      const dbName = ex.name.toLowerCase();
      return dbName === variation ||
             dbName.includes(variation) ||
             variation.includes(dbName) ||
             ex.searchKeywords.some(keyword => keyword.toLowerCase().includes(variation));
    });
    if (match) return match;
  }

  return null;
};

/**
 * Generate a deterministic ID for fallback exercises based on exercise name
 */
export const generateFallbackExerciseId = (exerciseName: string): string => {
  // Simple hash function to create deterministic ID from exercise name
  let hash = 0;
  const name = exerciseName.trim().toLowerCase();
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `fallback-${Math.abs(hash).toString(36)}`;
};

/**
 * Create a fallback exercise for when the exercise is not found in the database
 */
export const createFallbackExercise = (exerciseName: string, index: number): Exercise => ({
  id: generateFallbackExerciseId(exerciseName),
  name: exerciseName.trim(),
  muscleGroup: 'Unknown',
  muscleGroups: ['Unknown'],
  equipment: 'Unknown',
  videoLinks: [],
  instructions: [],
  difficulty: 'Intermediate',
  force: null,
  grips: null,
  mechanic: null,
  searchKeywords: [exerciseName.trim().toLowerCase()],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

/**
 * Convert a SavedWorkout to WorkoutExercise[] format for starting a workout
 */
export const convertSavedWorkoutToExercises = (
  savedWorkout: SavedWorkout,
  exerciseDatabase: Exercise[]
): WorkoutExercise[] => {
  if (!savedWorkout?.parsedWorkout) return [];

  const workoutExercises: WorkoutExercise[] = [];
  const { parsedWorkout } = savedWorkout;

  // Process regular exercises
  parsedWorkout.exercises.forEach((exercise: any, index: number) => {
    const dbExercise = findExerciseInDatabase(exercise.name, exerciseDatabase);

    const workoutSets: WorkoutSet[] = exercise.sets.map((set: any, setIndex: number) => ({
      id: `set-${Date.now()}-${index}-${setIndex}`,
      reps: typeof set.reps === 'number' ? set.reps : set.reps.min,
      weight: set.weight,
      unit: set.unit,
      completed: false,
    }));

    workoutExercises.push({
      id: `exercise-${Date.now()}-${index}`,
      exercise: dbExercise || createFallbackExercise(exercise.name, index),
      sets: workoutSets,
      restTime: exercise.restTime || 120,
    });
  });

  // Process supersets
  parsedWorkout.supersets.forEach((superset: any[], supersetIndex: number) => {
    const supersetId = `superset-${Date.now()}-${supersetIndex}`;
    const supersetExercises: WorkoutExercise[] = [];

    superset.forEach((parsedExercise: any, exerciseIndex: number) => {
      const dbExercise = findExerciseInDatabase(parsedExercise.name, exerciseDatabase);

      const workoutSets: WorkoutSet[] = parsedExercise.sets.map((set: any, setIndex: number) => ({
        id: `set-superset-${Date.now()}-${supersetIndex}-${exerciseIndex}-${setIndex}`,
        reps: typeof set.reps === 'number' ? set.reps : set.reps.min,
        weight: set.weight,
        unit: set.unit,
        completed: false,
      }));

      const supersetExercise: WorkoutExercise = {
        id: `exercise-superset-${Date.now()}-${supersetIndex}-${exerciseIndex}`,
        exercise: dbExercise || createFallbackExercise(parsedExercise.name, workoutExercises.length + exerciseIndex),
        sets: workoutSets,
        restTime: parsedExercise.restTime || 90,
        isSuperset: true,
        supersetId,
        supersetIndex: exerciseIndex,
        notes: `Superset ${supersetIndex + 1}${superset.length > 1 ? ` (${exerciseIndex + 1}/${superset.length})` : ''}`,
      };

      supersetExercises.push(supersetExercise);
    });

    // Add superset exercise IDs to the first exercise for navigation
    if (supersetExercises.length > 0) {
      supersetExercises[0].supersetExerciseIds = supersetExercises.map(ex => ex.id);
    }

    // Add all superset exercises to the main workout
    workoutExercises.push(...supersetExercises);
  });

  return workoutExercises;
};

/**
 * Sanitize a single exercise object to ensure it's serializable for Redux
 */
export const sanitizeExerciseForRedux = (exercise: any): any => {
  return {
    id: exercise.id,
    name: exercise.name,
    muscleGroup: exercise.muscleGroup,
    muscleGroups: exercise.muscleGroups || [exercise.muscleGroup],
    equipment: exercise.equipment,
    videoLinks: exercise.videoLinks || [],
    instructions: exercise.instructions || [],
    difficulty: exercise.difficulty,
    force: exercise.force,
    grips: exercise.grips,
    mechanic: exercise.mechanic,
    searchKeywords: exercise.searchKeywords || [],
    // Ensure dates are strings, not Date objects
    createdAt: typeof exercise.createdAt === 'string' ? exercise.createdAt : new Date().toISOString(),
    updatedAt: typeof exercise.updatedAt === 'string' ? exercise.updatedAt : new Date().toISOString(),
  };
};

/**
 * Sanitize workout exercises to ensure they're serializable for Redux
 */
export const sanitizeWorkoutExercisesForRedux = (exercises: any[]): any[] => {
  return exercises.map(workoutExercise => ({
    id: workoutExercise.id,
    exercise: sanitizeExerciseForRedux(workoutExercise.exercise),
    sets: workoutExercise.sets.map((set: any) => ({
      id: set.id,
      reps: set.reps,
      weight: set.weight || 0,
      unit: set.unit || 'lbs',
      completed: Boolean(set.completed),
      rpe: set.rpe,
    })),
    restTime: workoutExercise.restTime || 120,
    isSuperset: Boolean(workoutExercise.isSuperset),
    supersetId: workoutExercise.supersetId,
    supersetIndex: workoutExercise.supersetIndex,
    supersetExerciseIds: workoutExercise.supersetExerciseIds,
    notes: workoutExercise.notes || '',
  }));
};

/**
 * Prepare workout data for the configurator (merge supersets into exercises array)
 */
export const prepareWorkoutForConfigurator = (workout: any) => {
  if (!workout) return workout;

  const preparedWorkout = { ...workout };
  const allExercises = [...workout.exercises];

  // Add supersets as grouped exercises to the exercises array
  workout.supersets.forEach((superset: any[], supersetIndex: number) => {
    // Create a combined superset exercise for display
    const supersetExercise = {
      name: superset.map(ex => ex.name).join(' + '),
      sets: superset[0].sets, // Use the first exercise's sets as reference
      restTime: superset[0].restTime || 90,
      isSuperset: true,
      supersetIndex,
      supersetExercises: superset,
      notes: `Superset (${superset.length} exercises)`,
    };

    allExercises.push(supersetExercise);
  });

  preparedWorkout.exercises = allExercises;
  return preparedWorkout;
};

/**
 * Convert workout history (exercise history entries) to WorkoutExercise[] format
 * for restarting a completed workout
 */
export const convertWorkoutHistoryToExercises = (
  exerciseHistories: ExerciseHistory[],
  exerciseDatabase: Exercise[],
  workoutSummary?: WorkoutSummary
): { exercises: WorkoutExercise[], workoutName: string } => {
  const workoutExercises: WorkoutExercise[] = [];

  // Process each exercise history entry
  exerciseHistories.forEach((history, index) => {
    // Find the exercise in the database
    const dbExercise = findExerciseInDatabase(history.exerciseName, exerciseDatabase);

    // Convert performed sets to workout sets
    const workoutSets: WorkoutSet[] = history.sets.map((set, setIndex) => ({
      id: `set-replay-${Date.now()}-${index}-${setIndex}`,
      reps: set.targetReps || set.actualReps,
      weight: set.weight,
      unit: set.unit || 'lbs',
      completed: false,
    }));

    // Create workout exercise
    const workoutExercise: WorkoutExercise = {
      id: `exercise-replay-${Date.now()}-${index}`,
      exercise: dbExercise || createFallbackExercise(history.exerciseName, index),
      sets: workoutSets,
      restTime: 120, // Default rest time (will be overridden by user preferences)
      notes: history.customTitle || history.notes || undefined,
    };

    workoutExercises.push(workoutExercise);
  });

  // Generate workout name
  let workoutName = workoutSummary?.name || 'Workout';

  // Add date suffix to differentiate from original
  const today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
  workoutName = `${workoutName} (${today})`;

  return {
    exercises: workoutExercises,
    workoutName,
  };
};