import {
  effectiveEmphasis,
  syncExerciseEmphasis,
  type WorkoutExercise,
  type WorkoutSet,
  type Exercise,
} from '../types/exercise';
import { SavedWorkout } from '../services/workoutStorageService';
import { ExerciseHistory, WorkoutSummary } from '../types/exerciseHistory';
import { matchExercise } from '../lib/exerciseMatch';

/**
 * Find a typed exercise name in the library (ranked match; see lib/exerciseMatch).
 */
export const findExerciseInDatabase = (exerciseName: string, exerciseDatabase: Exercise[]): Exercise | null =>
  matchExercise(exerciseName, exerciseDatabase);

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
export const createFallbackExercise = (exerciseName: string, _index: number): Exercise => ({
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
    const emphasis = effectiveEmphasis(exercise);

    const workoutSets: WorkoutSet[] = exercise.sets.map((set: any, setIndex: number) => ({
      id: `set-${Date.now()}-${index}-${setIndex}`,
      reps: typeof set.reps === 'number' ? set.reps : set.reps.min,
      ...(typeof set.reps === 'object' && { repMin: set.reps.min, repMax: set.reps.max }),
      weight: set.weight,
      unit: set.unit,
      ...(set.time && { time: set.time }),
      completed: false,
    }));

    workoutExercises.push(
      syncExerciseEmphasis({
        id: `exercise-${Date.now()}-${index}`,
        exercise: dbExercise || createFallbackExercise(exercise.name, index),
        sets: workoutSets,
        restTime: exercise.restTime || 120,
        ...(exercise.notes ? { notes: exercise.notes } : {}),
        ...(exercise.tracked ? { tracked: exercise.tracked } : {}),
        ...(emphasis ? { emphasis } : {}),
      }),
    );
  });

  // Process supersets
  parsedWorkout.supersets.forEach((superset: any[], supersetIndex: number) => {
    const supersetId = `superset-${Date.now()}-${supersetIndex}`;
    const supersetExercises: WorkoutExercise[] = [];

    superset.forEach((parsedExercise: any, exerciseIndex: number) => {
      const dbExercise = findExerciseInDatabase(parsedExercise.name, exerciseDatabase);
      const emphasis = effectiveEmphasis(parsedExercise);

      const workoutSets: WorkoutSet[] = parsedExercise.sets.map((set: any, setIndex: number) => ({
        id: `set-superset-${Date.now()}-${supersetIndex}-${exerciseIndex}-${setIndex}`,
        reps: typeof set.reps === 'number' ? set.reps : set.reps.min,
        ...(typeof set.reps === 'object' && { repMin: set.reps.min, repMax: set.reps.max }),
        weight: set.weight,
        unit: set.unit,
        ...(set.time && { time: set.time }),
        completed: false,
      }));

      const noteParts = [
        `Superset ${supersetIndex + 1}${superset.length > 1 ? ` (${exerciseIndex + 1}/${superset.length})` : ''}`,
        parsedExercise.notes,
      ].filter(Boolean);

      const supersetExercise: WorkoutExercise = syncExerciseEmphasis({
        id: `exercise-superset-${Date.now()}-${supersetIndex}-${exerciseIndex}`,
        exercise: dbExercise || createFallbackExercise(parsedExercise.name, workoutExercises.length + exerciseIndex),
        sets: workoutSets,
        restTime: parsedExercise.restTime || 90,
        isSuperset: true,
        supersetId,
        supersetIndex: exerciseIndex,
        notes: noteParts.join(' · '),
        ...(parsedExercise.tracked ? { tracked: parsedExercise.tracked } : {}),
        ...(emphasis ? { emphasis } : {}),
      });

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
  return exercises.map(workoutExercise => {
    const emphasis = effectiveEmphasis(workoutExercise);
    const tracked = workoutExercise.tracked
      ? {
          ...workoutExercise.tracked,
          goal:
            workoutExercise.tracked.goal === 'checkpoint'
              ? 'checkpoint'
              : (emphasis ?? workoutExercise.tracked.goal),
        }
      : undefined;

    return {
      id: workoutExercise.id,
      exercise: sanitizeExerciseForRedux(workoutExercise.exercise),
      sets: workoutExercise.sets.map((set: any) => ({
        id: set.id,
        reps: set.reps,
        weight: set.weight || 0,
        unit: set.unit || 'lbs',
        completed: Boolean(set.completed),
        rpe: set.rpe,
        ...(set.repMin !== undefined && { repMin: set.repMin }),
        ...(set.repMax !== undefined && { repMax: set.repMax }),
        ...(set.time !== undefined && { time: set.time }),
      })),
      restTime: workoutExercise.restTime || 120,
      isSuperset: Boolean(workoutExercise.isSuperset),
      supersetId: workoutExercise.supersetId,
      supersetIndex: workoutExercise.supersetIndex,
      supersetExerciseIds: workoutExercise.supersetExerciseIds,
      notes: workoutExercise.notes || '',
      ...(tracked ? { tracked } : {}),
      ...(emphasis ? { emphasis } : {}),
    };
  });
};

/**
 * Prepare workout data for the configurator: expand supersets into individual
 * exercise rows sharing a `supersetGroup` so each partner can be configured,
 * reordered, unpaired, and given its own Volume/Strength emphasis.
 */
export const prepareWorkoutForConfigurator = (workout: any) => {
  if (!workout) return workout;

  const rawExercises: any[] = Array.isArray(workout.exercises) ? workout.exercises : [];
  let maxGroup = rawExercises.reduce(
    (max, ex) => (typeof ex?.supersetGroup === 'number' && ex.supersetGroup > max ? ex.supersetGroup : max),
    0,
  );

  const allExercises: any[] = [];

  for (const ex of rawExercises) {
    if (ex?.isSuperset && Array.isArray(ex.supersetExercises)) {
      if (ex.supersetExercises.length > 1) {
        const groupId = ++maxGroup;
        for (const partner of ex.supersetExercises) {
          allExercises.push(syncExerciseEmphasis({ ...partner, supersetGroup: groupId }));
        }
      } else if (ex.supersetExercises.length === 1) {
        allExercises.push(syncExerciseEmphasis({ ...ex.supersetExercises[0] }));
      }
    } else {
      allExercises.push(syncExerciseEmphasis({ ...ex }));
    }
  }

  for (const superset of workout.supersets ?? []) {
    if (!Array.isArray(superset) || superset.length === 0) continue;
    if (superset.length > 1) {
      const groupId = ++maxGroup;
      for (const partner of superset) {
        allExercises.push(syncExerciseEmphasis({ ...partner, supersetGroup: groupId }));
      }
    } else {
      allExercises.push(syncExerciseEmphasis({ ...superset[0] }));
    }
  }

  return {
    ...workout,
    exercises: allExercises,
    supersets: [],
  };
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
      ...(history.emphasis ? { emphasis: history.emphasis } : {}),
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
