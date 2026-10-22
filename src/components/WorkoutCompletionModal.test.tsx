import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import workoutReducer, {
  activeWorkoutRestored,
  setShowCompletionModal,
} from '../store/slices/workoutSlice';
import scheduleReducer from '../store/slices/scheduleSlice';
import trackedLiftsReducer from '../store/slices/trackedLiftsSlice';
import plannedWorkoutsReducer, { planAdded } from '../store/slices/plannedWorkoutsSlice';
import {
  setStoredPlanContext,
  ACTIVE_PLAN_CONTEXT_KEY,
  type ActivePlanContext,
} from '../lib/workoutSession';
import { MuscleLogService } from '../services/muscleLogService';
import { WorkoutStorageService } from '../services/workoutStorageService';
import type { ActiveWorkout } from '../types/exercise';
import { WorkoutCompletionModal } from './WorkoutCompletionModal';

vi.mock('../services/muscleLogService', () => ({
  MuscleLogService: { recordWorkout: vi.fn() },
}));
vi.mock('../services/scheduleService', () => ({
  ScheduleService: { appendPerformedLocal: vi.fn() },
}));
vi.mock('../services/workoutStorageService', () => ({
  WorkoutStorageService: { saveCompletedWorkout: vi.fn().mockResolvedValue('summary-1') },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

let mockUser: { uid: string } | null = { uid: 'user-1' };
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const workout: ActiveWorkout = {
  id: 'workout-1',
  name: 'Push Day',
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
      sets: [{ id: 's1', reps: 10, weight: 100, unit: 'lbs', completed: true }],
    },
  ],
  currentExerciseIndex: 0,
  currentSetIndex: 0,
  startTime: '2026-10-22T10:00:00.000Z',
  duration: 600,
  isActive: true,
};

function setup() {
  const store = configureStore({
    reducer: {
      workout: workoutReducer,
      schedule: scheduleReducer,
      trackedLifts: trackedLiftsReducer,
      plannedWorkouts: plannedWorkoutsReducer,
    },
  });
  store.dispatch(activeWorkoutRestored({ activeWorkout: workout }));
  store.dispatch(setShowCompletionModal(true));
  store.dispatch(
    planAdded({ id: 'p1', dateKey: '2026-10-22', name: 'Plan', exercises: [] }),
  );
  render(
    <Provider store={store}>
      <WorkoutCompletionModal isOpen onClose={() => {}} />
    </Provider>,
  );
  return store;
}

const planStatus = (store: ReturnType<typeof setup>) =>
  store.getState().plannedWorkouts.plans.find((p) => p.id === 'p1')?.status;

const save = () => fireEvent.click(screen.getByRole('button', { name: /save workout/i }));

describe('WorkoutCompletionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockUser = { uid: 'user-1' };
  });

  it('marks a planned-workout plan done and clears the stored context', async () => {
    const ctx: ActivePlanContext = {
      templateId: 'planned-workout',
      dateKey: '2026-10-22',
      plannedWorkoutId: 'p1',
    };
    setStoredPlanContext(ctx);
    const store = setup();
    save();
    await waitFor(() => expect(store.getState().workout.activeWorkout).toBeNull());
    expect(planStatus(store)).toBe('done');
    expect(localStorage.getItem(ACTIVE_PLAN_CONTEXT_KEY)).toBeNull();
    expect(store.getState().workout.showCompletionModal).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('completes a charlie-split day via dayOverrideSet', async () => {
    setStoredPlanContext({
      templateId: 'charlie-split',
      dateKey: '2026-10-22',
      dayType: 'push',
      cycleOrdinal: 1,
    });
    const store = setup();
    save();
    await waitFor(() => expect(store.getState().workout.activeWorkout).toBeNull());
    expect(store.getState().schedule.overrides['2026-10-22']?.status).toBe('completed');
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('a plain workout touches no plan and navigates to /profile', async () => {
    const store = setup();
    save();
    await waitFor(() => expect(store.getState().workout.activeWorkout).toBeNull());
    expect(planStatus(store)).toBe('planned');
    expect(store.getState().schedule.overrides).toEqual({});
    expect(WorkoutStorageService.saveCompletedWorkout).toHaveBeenCalledWith('user-1', workout);
    expect(mockNavigate).toHaveBeenCalledWith('/profile', { state: { showWorkoutComplete: true } });
  });

  it('Keep editing leaves the workout active and the plan planned', () => {
    setStoredPlanContext({
      templateId: 'planned-workout',
      dateKey: '2026-10-22',
      plannedWorkoutId: 'p1',
    });
    const store = setup();
    fireEvent.click(screen.getByRole('button', { name: /keep editing/i }));
    expect(store.getState().workout.showCompletionModal).toBe(false);
    expect(store.getState().workout.activeWorkout).not.toBeNull();
    expect(planStatus(store)).toBe('planned');
    expect(localStorage.getItem(ACTIVE_PLAN_CONTEXT_KEY)).not.toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('a signed-out user still ends the workout and records tracked sessions', async () => {
    mockUser = null;
    const store = setup();
    save();
    await waitFor(() => expect(store.getState().workout.activeWorkout).toBeNull());
    expect(WorkoutStorageService.saveCompletedWorkout).not.toHaveBeenCalled();
    expect(MuscleLogService.recordWorkout).toHaveBeenCalledWith('anon', workout);
    expect(store.getState().workout.showCompletionModal).toBe(false);
  });
});
