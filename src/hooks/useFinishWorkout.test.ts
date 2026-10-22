import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import workoutReducer, { activeWorkoutRestored, endWorkout } from '../store/slices/workoutSlice';
import scheduleReducer from '../store/slices/scheduleSlice';
import trackedLiftsReducer from '../store/slices/trackedLiftsSlice';
import plannedWorkoutsReducer, { planAdded } from '../store/slices/plannedWorkoutsSlice';
import { useFinishWorkout, buildLocalSummary } from './useFinishWorkout';
import {
  setStoredPlanContext,
  clearStoredPlanContext,
  clearWorkoutSnapshot,
  saveWorkoutSnapshot,
  loadWorkoutSnapshot,
  ACTIVE_PLAN_CONTEXT_KEY,
  type ActivePlanContext,
} from '../lib/workoutSession';
import { MuscleLogService } from '../services/muscleLogService';
import { ScheduleService } from '../services/scheduleService';
import { WorkoutStorageService } from '../services/workoutStorageService';
import type { ActiveWorkout } from '../types/exercise';
import type { TrackedLift } from '../types/trackedLifts';

// Mock services
vi.mock('../services/muscleLogService', () => ({
  MuscleLogService: {
    recordWorkout: vi.fn(),
  },
}));

vi.mock('../services/scheduleService', () => ({
  ScheduleService: {
    appendPerformedLocal: vi.fn(),
  },
}));

vi.mock('../services/workoutStorageService', () => ({
  WorkoutStorageService: {
    saveCompletedWorkout: vi.fn().mockResolvedValue('summary-123'),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-456' } }),
}));

const sampleLift: TrackedLift = {
  id: 'lift-bench',
  name: 'Bench Press',
  category: 'Push',
  load: { kind: 'weight', value: 200, unit: 'lb' },
  target: { kind: 'reps', min: 5 },
  progression: true,
  cycle: { volume: 1, strength: 1 },
};

const sampleWorkout: ActiveWorkout = {
  id: 'workout-test-1',
  name: 'Push Day A',
  exercises: [
    {
      id: 'we-1',
      exercise: {
        id: 'bench-press',
        name: 'Bench Press',
        muscleGroup: 'Chest',
        muscleGroups: ['Chest'],
        equipment: 'Barbell',
        videoLinks: [],
        instructions: [],
        difficulty: 'Intermediate',
        force: 'Push',
        grips: 'Overhand',
        mechanic: 'Compound',
        searchKeywords: [],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      tracked: { liftId: 'lift-bench', goal: 'volume' },
      sets: [
        { id: 'set-1', reps: 10, weight: 200, unit: 'lbs', completed: true },
        { id: 'set-2', reps: 8, weight: 200, unit: 'lbs', completed: true },
        { id: 'set-3', reps: 6, weight: 200, unit: 'lbs', completed: false },
      ],
    },
  ],
  currentExerciseIndex: 0,
  currentSetIndex: 2,
  startTime: '2026-10-22T10:00:00.000Z',
  duration: 40,
  isActive: true,
};

const samplePlanContext: ActivePlanContext = {
  dateKey: '2026-10-22',
  templateId: 'charlie-split',
  dayType: 'push',
  cycleOrdinal: 2,
  isRetest: true,
};

function setupStore() {
  const store = configureStore({
    reducer: {
      workout: workoutReducer,
      schedule: scheduleReducer,
      trackedLifts: trackedLiftsReducer,
      plannedWorkouts: plannedWorkoutsReducer,
    },
  });
  store.dispatch(
    activeWorkoutRestored({
      activeWorkout: sampleWorkout,
    }),
  );
  return store;
}

describe('useFinishWorkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('builds local summary with completed sets, reps, and volume', () => {
    const summary = buildLocalSummary(sampleWorkout, 'user-456');
    expect(summary.totalSets).toBe(2);
    expect(summary.totalReps).toBe(18); // 10 + 8
    expect(summary.totalVolume).toBe(3600); // (10 * 200) + (8 * 200)
    expect(summary.exercisesSummary[0].sets).toBe(2);
  });

  it('records tracked sessions and completes the plan day from localStorage plan context', async () => {
    const store = setupStore();
    setStoredPlanContext(samplePlanContext);
    saveWorkoutSnapshot({ activeWorkout: sampleWorkout, planContext: samplePlanContext });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(Provider, { store, children });

    const { result } = renderHook(() => useFinishWorkout(), { wrapper });

    await act(async () => {
      await result.current.finishWorkout();
    });

    // Saved to Firebase
    expect(WorkoutStorageService.saveCompletedWorkout).toHaveBeenCalledWith('user-456', sampleWorkout);

    // Tracked sessions recorded via MuscleLogService
    expect(MuscleLogService.recordWorkout).toHaveBeenCalledWith('user-456', sampleWorkout);

    // Completed plan day
    expect(ScheduleService.appendPerformedLocal).toHaveBeenCalled();
    const scheduleState = store.getState().schedule;
    expect(scheduleState.overrides['2026-10-22']?.status).toBe('completed');

    // Workout ended and snapshot cleared
    expect(store.getState().workout.activeWorkout).toBeNull();
    expect(loadWorkoutSnapshot()).toBeNull();
    expect(localStorage.getItem(ACTIVE_PLAN_CONTEXT_KEY)).toBeNull();

    // Routed to home because it was a plan day
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('completes the plan day when falling back to sessionStorage', async () => {
    const store = setupStore();
    // Only in sessionStorage (e.g. session started before migration)
    sessionStorage.setItem(ACTIVE_PLAN_CONTEXT_KEY, JSON.stringify(samplePlanContext));

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(Provider, { store, children });

    const { result } = renderHook(() => useFinishWorkout(), { wrapper });

    await act(async () => {
      await result.current.finishWorkout();
    });

    // Schedule completed
    const scheduleState = store.getState().schedule;
    expect(scheduleState.overrides['2026-10-22']?.status).toBe('completed');
    expect(sessionStorage.getItem(ACTIVE_PLAN_CONTEXT_KEY)).toBeNull();
  });

  it('marks a planned workout as done when finishWorkout completes', async () => {
    const store = setupStore();
    store.dispatch(
      planAdded({
        id: 'plan-custom-1',
        dateKey: '2026-10-22',
        name: 'Custom Push',
        exercises: [],
      }),
    );

    const plannedContext: ActivePlanContext = {
      templateId: 'planned-workout',
      dateKey: '2026-10-22',
      plannedWorkoutId: 'plan-custom-1',
    };
    setStoredPlanContext(plannedContext);

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(Provider, { store, children });

    const { result } = renderHook(() => useFinishWorkout(), { wrapper });

    await act(async () => {
      await result.current.finishWorkout();
    });

    // Plan should be marked done
    const plans = store.getState().plannedWorkouts.plans;
    expect(plans.find((p) => p.id === 'plan-custom-1')?.status).toBe('done');
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('leaves the planned workout in planned status when workout is discarded', () => {
    const store = setupStore();
    store.dispatch(
      planAdded({
        id: 'plan-custom-2',
        dateKey: '2026-10-22',
        name: 'Leg Day',
        exercises: [],
      }),
    );

    const plannedContext: ActivePlanContext = {
      templateId: 'planned-workout',
      dateKey: '2026-10-22',
      plannedWorkoutId: 'plan-custom-2',
    };
    setStoredPlanContext(plannedContext);

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(Provider, { store, children });

    const { result } = renderHook(() => useFinishWorkout(), { wrapper });

    // Discarding a workout invokes discardWorkout, clearing snapshot & plan context without marking the plan done
    act(() => {
      result.current.discardWorkout();
    });

    // The plan in store must still be 'planned'
    const plans = store.getState().plannedWorkouts.plans;
    expect(plans.find((p) => p.id === 'plan-custom-2')?.status).toBe('planned');
  });
});
