import { findExerciseInDatabase, createFallbackExercise, generateFallbackExerciseId } from '../utils/workoutConversion';
import type { Exercise } from '../types/exercise';
import type { ExerciseHistory, WorkoutSummary } from '../types/exerciseHistory';
/**
 * The app's real save paths behind `EffectServices` (effects.ts), plus the
 * saved-workout list the chat context reads. Kept in one module so tests mock
 * it instead of Firestore.
 */
import { WorkoutStorageService } from '../services/workoutStorageService';
import { UserProfileService } from '../services/userProfileService';
import { ExerciseHistoryService } from '../services/exerciseHistoryService';
import type { ParsedWorkout } from '../parser/types';
import type { ActiveWorkout } from '../types/exercise';
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
  savePastWorkout: async (userId, w, library) => {
    const startTime = new Date(w.date.includes('T') ? w.date : `${w.date}T10:00:00.000Z`);
    const duration = w.durationMinutes ?? Math.max(15, w.exercises.reduce((n, e) => n + e.sets.length * 2, 0));
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
    const dateStamp = startTime.toISOString().slice(0, 10).replace(/-/g, '');
    const fallbackHash = generateFallbackExerciseId(w.name + startTime.toISOString());
    const workoutId = `past-${dateStamp}-${fallbackHash}`;

    const activeWorkout: ActiveWorkout = {
      id: workoutId,
      name: w.name,
      startTime: startTime.toISOString(),
      duration,
      isActive: false,
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      exercises: w.exercises.map((e, ei) => {
        const dbExercise = library ? findExerciseInDatabase(e.name, library) : null;
        const exercise = dbExercise ?? createFallbackExercise(e.name, ei);
        return {
          id: `we-${ei}-${startTime.getTime()}`,
          exercise,
          sets: e.sets.map((s, si) => ({
            id: `s-${ei}-${si}-${startTime.getTime()}`,
            reps: s.reps,
            weight: s.weight ?? 0,
            unit: s.unit ?? 'lbs',
            completed: true,
            rpe: s.rpe,
          })),
          notes: e.notes,
        };
      }),
    };

    const res = await WorkoutStorageService.saveCompletedWorkout(userId, activeWorkout, undefined, endTime);
    const summaryId = typeof res === 'string' ? res : res.workoutId;
    const exerciseIds = typeof res === 'object' && res && 'exerciseIds' in res ? res.exerciseIds : [];
    return { workoutId: summaryId, exerciseIds };
  },
  deletePastWorkout: async (userId, workoutId, exerciseIds) => {
    await ExerciseHistoryService.deleteWorkoutHistory(userId, workoutId);
    if (exerciseIds?.length) {
      for (const exId of exerciseIds) {
        await ExerciseHistoryService.deleteExerciseHistory(userId, exId);
      }
    }
  },
  updatePastWorkout: async (userId, workoutId, update) => {
    const updateData: Record<string, unknown> = {};
    if (update.name !== undefined) updateData.name = update.name;
    if (update.notes !== undefined) updateData.notes = update.notes;
    if (update.durationMinutes !== undefined) updateData.duration = update.durationMinutes;
    if (update.date !== undefined) {
      const d = new Date(update.date.includes('T') ? update.date : `${update.date}T10:00:00.000Z`);
      updateData.startTime = d.toISOString();
      updateData.endTime = new Date(d.getTime() + (update.durationMinutes ?? 45) * 60000).toISOString();
    }
    await ExerciseHistoryService.updateWorkoutHistory(userId, workoutId, updateData);

    if (update.exercises?.length) {
      let existingExercises: ExerciseHistory[] | null = null;
      for (const ex of update.exercises) {
        let exId = ex.id;
        if (!exId) {
          if (!existingExercises) {
            existingExercises = await ExerciseHistoryService.getExerciseHistoryByWorkoutId(userId, workoutId);
          }
          const matched = existingExercises.find(
            (e) => e.exerciseName.toLowerCase() === ex.name.toLowerCase(),
          );
          if (matched) {
            exId = matched.id;
          }
        }

        const sets = ex.sets.map((s, si) => ({
          setNumber: si + 1,
          targetReps: s.reps,
          actualReps: s.reps,
          weight: s.weight ?? 0,
          unit: s.unit ?? 'lbs',
          completed: true,
          rpe: s.rpe,
          notes: '',
        }));

        if (exId) {
          await ExerciseHistoryService.updateExerciseHistory(userId, exId, {
            exerciseName: ex.name,
            sets,
            notes: ex.notes,
            workoutName: update.name,
            workoutDate: update.date,
          });
        } else {
          await ExerciseHistoryService.saveExercisePerformance(userId, {
            exerciseId: generateFallbackExerciseId(ex.name),
            exerciseName: ex.name,
            workoutId,
            workoutName: update.name,
            workoutDate: update.date,
            sets,
            muscleGroups: [],
            equipment: '',
            notes: ex.notes,
          });
        }
      }
    }
  },
  getPastWorkout: async (userId, workoutId) => {
    const summary = await ExerciseHistoryService.getWorkoutSummaryById(userId, workoutId);
    if (!summary) return null;
    const exercises = await ExerciseHistoryService.getExerciseHistoryByWorkoutId(userId, workoutId);
    return { summary, exercises };
  },
};
