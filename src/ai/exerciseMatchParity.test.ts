import { describe, it, expect } from 'vitest';
import {
  convertSavedWorkoutToExercises,
  generateFallbackExerciseId,
} from '../utils/workoutConversion';
import {
  resolveExercise,
  getCachedLibrary,
} from '../../worker/src/data/exerciseIndex';
import type { SavedWorkout } from '../services/workoutStorageService';

describe('Exercise match parity: App vs Worker', () => {
  it('Worker resolveExercise matches the exact exerciseId written by the app through useFinishWorkout / saveCompletedWorkout / ExerciseHistoryService in a fresh session', () => {
    const library = getCachedLibrary();
    const testCases = [
      'Barbell Bench Press',
      'bench press',
      'Squat',
      'Deadlift',
      'Incline Dumbbell Press',
      'NonExistent Fancy Move 99',
    ];

    const savedWorkout: SavedWorkout = {
      id: 'saved-w-1',
      userId: 'u1',
      name: 'Test Day',
      workoutText: '',
      parsedWorkout: {
        exercises: testCases.map((name) => ({ name, sets: [{ reps: 5, weight: 135 }] })),
        supersets: [],
      },
      customExercises: [],
      tags: [],
      category: 'Strength',
      difficulty: 'Intermediate',
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      performanceCount: 0,
    };

    // 1. App converts saved workout to active workout exercises:
    const appExercises = convertSavedWorkoutToExercises(savedWorkout, library as any);

    // 2. When useFinishWorkout runs, WorkoutStorageService.saveCompletedWorkout maps:
    //    activeWorkout.exercises.map(exercise => ExerciseHistoryService.saveExercisePerformance(userId, { exerciseId: exercise.exercise.id, ... }))
    for (let i = 0; i < testCases.length; i++) {
      const name = testCases[i];
      const appExercise = appExercises[i].exercise;
      const appStoredExerciseId = appExercise.id;

      // 3. Worker resolves the exercise for log_workout:
      const workerResolved = resolveExercise(name);

      // Verify exact ID parity between app and worker
      expect(workerResolved.id).toBe(appStoredExerciseId);
      expect(workerResolved.isFallback).toBe(appStoredExerciseId.startsWith('fallback-'));
    }
  });

  it('reuses the user historical fallback ID (fallback-eo82lz) when logging via canonical name or gym shorthand', () => {
    const library = getCachedLibrary();
    // In the real app, when a workout plan is created before the library loads,
    // "Barbell Bench Press" gets assigned generateFallbackExerciseId("Barbell Bench Press") -> "fallback-eo82lz".
    // When completed, it was saved to exercise_history under that id.
    const appHistoricalId = generateFallbackExerciseId('Barbell Bench Press');
    expect(appHistoricalId).toBe('fallback-eo82lz');

    const history = [
      {
        exerciseId: appHistoricalId,
        exerciseName: 'Barbell Bench Press',
        workoutDate: new Date('2026-10-01'),
        muscleGroups: ['Barbell', 'Chest', 'Mid and Lower Chest'],
        equipment: 'Barbell',
      },
    ];

    // Canonical name match:
    const canonical = resolveExercise('Barbell Bench Press', undefined, library, history);
    expect(canonical.id).toBe('fallback-eo82lz');
    expect(canonical.matchedBy).toBe('history');

    // Gym shorthand match: "bench press" matches "Barbell Bench Press" in history
    const shorthand = resolveExercise('bench press', undefined, library, history);
    expect(shorthand.id).toBe('fallback-eo82lz');
    expect(shorthand.matchedBy).toBe('history');
  });
});
