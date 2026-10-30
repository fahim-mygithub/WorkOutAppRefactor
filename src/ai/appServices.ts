/**
 * The app's real save paths behind `EffectServices` (effects.ts), plus the
 * saved-workout list the chat context reads. Kept in one module so tests mock
 * it instead of Firestore.
 */
import { WorkoutStorageService } from '../services/workoutStorageService';
import { UserProfileService } from '../services/userProfileService';
import type { ParsedWorkout } from '../parser/types';
import type { SavedWorkoutRef } from './applyTool';
import type { EffectServices, SavedWorkoutDraft } from './effects';

/** How many saved workouts the chat sees. */
const SAVED_WORKOUTS_LISTED = 20;

/**
 * The stored shape of a parsed workout: Firestore rejects nested arrays, so
 * supersets travel as JSON (the same 'serialized_v1' format
 * WorkoutStorageService.saveWorkout writes and its readers expect).
 */
function storedParsedWorkout(w: ParsedWorkout): ParsedWorkout {
  return {
    exercises: w.exercises,
    supersets_serialized: JSON.stringify(w.supersets ?? []),
    _dataFormat: 'serialized_v1',
  } as unknown as ParsedWorkout;
}

export const appServices: EffectServices & {
  listSavedWorkouts: (userId: string) => Promise<SavedWorkoutRef[]>;
} = {
  saveWorkout: (userId, w: SavedWorkoutDraft) =>
    WorkoutStorageService.saveWorkout(userId, {
      name: w.name,
      description: `Created with AI: ${w.parsedWorkout.exercises.length} exercises`,
      workoutText: w.workoutText,
      parsedWorkout: w.parsedWorkout,
      customExercises: [],
      tags: ['AI'],
      category: 'Strength',
      difficulty: 'Intermediate',
    }),
  updateWorkout: (userId, id, w) =>
    WorkoutStorageService.updateWorkout(userId, id, {
      name: w.name,
      workoutText: w.workoutText,
      parsedWorkout: storedParsedWorkout(w.parsedWorkout),
    }),
  deleteWorkout: (userId, id) => WorkoutStorageService.deleteWorkout(userId, id),
  saveProfile: async (userId, { displayName, preferences }) => {
    if (displayName !== undefined) await UserProfileService.updateUserProfile(userId, { displayName });
    if (preferences) await UserProfileService.updateUserPreferences(userId, preferences);
  },
  listSavedWorkouts: async (userId) =>
    (await WorkoutStorageService.getUserWorkouts(userId, SAVED_WORKOUTS_LISTED)).map((w) => ({
      id: w.id,
      name: w.name,
      workoutText: w.workoutText ?? '',
      parsedWorkout: w.parsedWorkout,
    })),
};
