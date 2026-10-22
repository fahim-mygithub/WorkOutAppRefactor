import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useAuth } from '../contexts/AuthContext';
import { endWorkout } from '../store/slices/workoutSlice';
import { sessionsRecorded } from '../store/slices/trackedLiftsSlice';
import { dayOverrideSet, retestAdvanced } from '../store/slices/scheduleSlice';
import { planMarkedDone } from '../store/slices/plannedWorkoutsSlice';
import { trackedSessionsFromWorkout } from '../lib/trackedLiftProgression';
import { MuscleLogService } from '../services/muscleLogService';
import { ScheduleService } from '../services/scheduleService';
import { WorkoutStorageService } from '../services/workoutStorageService';
import {
  getStoredPlanContext,
  clearStoredPlanContext,
  clearWorkoutSnapshot,
  readSharedSessionFlag,
  type ActivePlanContext,
} from '../lib/workoutSession';
import type { ActiveWorkout } from '../types/exercise';
import type { WorkoutSummary } from '../types/exerciseHistory';

/**
 * Build a calendar-shaped WorkoutSummary from a finished ActiveWorkout, for the
 * local performed store (so completed Charlie days render in the loginless demo).
 */
export function buildLocalSummary(workout: ActiveWorkout, userId: string): WorkoutSummary {
  const start = new Date(workout.startTime);
  const end = new Date();
  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;
  const exercisesSummary = workout.exercises.map((we) => {
    const done = we.sets.filter((s) => s.completed);
    const sets = done.length;
    const reps = done.reduce((n, s) => n + (s.reps || 0), 0);
    const volume = done.reduce((n, s) => n + (s.weight || 0) * (s.reps || 0), 0);
    totalSets += sets;
    totalReps += reps;
    totalVolume += volume;
    return { exerciseId: we.exercise.id, exerciseName: we.exercise.name, sets, reps, volume };
  });
  return {
    id: `local-${workout.id}`,
    userId,
    name: workout.name,
    workoutId: workout.id,
    templateId: 'charlie-split',
    startTime: start,
    endTime: end,
    duration: workout.duration || Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000)),
    totalExercises: workout.exercises.length,
    totalSets,
    totalReps,
    totalVolume,
    exercisesSummary,
  };
}

/**
 * True for a signed-out viewer of a shared workout session — the value
 * WorkoutPage passes to `finishWorkout`. `shareId` is the route param, when the
 * caller is on a shared route.
 */
export function useIsAnonymousWorkoutUser(shareId?: string): boolean {
  const { user } = useAuth();
  return (!!shareId || readSharedSessionFlag()) && !user;
}

export interface FinishWorkoutOptions {
  isAnonymousUser?: boolean;
  workout?: ActiveWorkout;
  planContext?: ActivePlanContext | null;
}

/**
 * Shared workout close-out path used by both WorkoutPage and ResumeWorkoutSheet.
 * Handles Firebase save if signed in, records tracked-lift sessions, registers
 * muscle map heat, completes plan days with retest progression, and ends the session.
 */
export function useFinishWorkout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const trackedLifts = useAppSelector((state) => state.trackedLifts.lifts);
  const activeWorkout = useAppSelector((state) => state.workout.activeWorkout);

  const finishWorkout = useCallback(
    async (options: FinishWorkoutOptions = {}) => {
      const targetWorkout = options.workout ?? activeWorkout;
      if (!targetWorkout) return false;

      const planCtx = options.planContext !== undefined
        ? options.planContext
        : getStoredPlanContext();
      const isAnonymousUser = options.isAnonymousUser ?? false;

      // Saving counts even when the Firestore write fails (the sets were done).
      const recordTracked = () => {
        dispatch(
          sessionsRecorded({
            date: new Date().toISOString(),
            entries: trackedSessionsFromWorkout(targetWorkout.exercises, trackedLifts),
          }),
        );
        MuscleLogService.recordWorkout(user?.uid ?? 'anon', targetWorkout);
      };

      const completePlanDay = () => {
        if (!planCtx) return;
        if (planCtx.templateId === 'planned-workout' && planCtx.plannedWorkoutId) {
          dispatch(planMarkedDone(planCtx.plannedWorkoutId));
          clearStoredPlanContext();
          return;
        }
        if (planCtx.templateId === 'charlie-split' && planCtx.dayType) {
          const idKey = user?.uid ?? 'anon';
          const summary = buildLocalSummary(targetWorkout, idKey);
          ScheduleService.appendPerformedLocal(idKey, summary);
          dispatch(
            dayOverrideSet({
              dateKey: planCtx.dateKey,
              status: 'completed',
              dayType: planCtx.dayType,
              cycleOrdinal: planCtx.cycleOrdinal ?? 1,
              completedSummaryId: summary.id,
              updatedAt: new Date().toISOString(),
            }),
          );
          if (planCtx.isRetest) {
            dispatch(retestAdvanced({ testedAtKey: planCtx.dateKey }));
          }
          clearStoredPlanContext();
        }
      };

      try {
        if (user?.uid) {
          await WorkoutStorageService.saveCompletedWorkout(user.uid, targetWorkout);
        }

        recordTracked();
        completePlanDay();
        dispatch(endWorkout());
        clearWorkoutSnapshot();

        // Plan days route home so the calendar flip is visible; others keep prior behavior.
        if (planCtx) {
          navigate('/');
        } else if (!isAnonymousUser) {
          navigate('/profile', { state: { showWorkoutComplete: true } });
        }
        return true;
      } catch (error) {
        console.error('❌ Error saving workout:', error);
        alert('Failed to save workout. Your progress will still be ended. Please check your connection and try again.');
        recordTracked();
        completePlanDay();
        dispatch(endWorkout());
        clearWorkoutSnapshot();
        if (planCtx || !isAnonymousUser) {
          navigate('/');
        }
        return false;
      }
    },
    [dispatch, navigate, user, trackedLifts, activeWorkout],
  );

  return { finishWorkout };
}
