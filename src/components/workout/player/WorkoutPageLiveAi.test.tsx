import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import workoutReducer, { startWorkout } from '../../../store/slices/workoutSlice';
import aiReducer from '../../../store/slices/aiSlice';
import userReducer from '../../../store/slices/userSlice';
import trackedLiftsReducer from '../../../store/slices/trackedLiftsSlice';
import exerciseHistoryReducer from '../../../store/slices/exerciseHistorySlice';
import exerciseReducer from '../../../store/slices/exerciseSlice';
import customExerciseReducer from '../../../store/slices/customExerciseSlice';
import plannedWorkoutsReducer from '../../../store/slices/plannedWorkoutsSlice';
import scheduleReducer from '../../../store/slices/scheduleSlice';
import sharedWorkoutReducer from '../../../store/slices/sharedWorkoutSlice';
import WorkoutPage from '../../../pages/WorkoutPage';
import { AskAiHost } from '../../ai/AskAiHost';
import * as aiClient from '../../../ai/aiClient';
import type { WorkoutExercise } from '../../../types/exercise';

let mockUser: { uid: string; email: string; displayName: string } | null = {
  uid: 'user-123',
  email: 'test@example.com',
  displayName: 'Test User',
};

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    error: null,
    clearError: () => {},
  }),
}));

vi.mock('../WorkoutDurationTimer', () => ({
  WorkoutDurationTimer: () => <span>00:10:00</span>,
}));

vi.mock('../../../firebase/config', () => ({ auth: {}, db: {}, app: {} }));

function makeStore() {
  const store = configureStore({
    reducer: {
      workout: workoutReducer,
      ai: aiReducer,
      user: userReducer,
      trackedLifts: trackedLiftsReducer,
      exerciseHistory: exerciseHistoryReducer,
      exercise: exerciseReducer,
      customExercise: customExerciseReducer,
      plannedWorkouts: plannedWorkoutsReducer,
      schedule: scheduleReducer,
      sharedWorkout: sharedWorkoutReducer,
    },
  });

  const testExercise: WorkoutExercise = {
    id: 'we-test-1',
    exercise: {
      id: 'bench-press',
      name: 'Barbell Bench Press',
      muscleGroup: 'Chest',
      muscleGroups: ['Chest'],
      equipment: 'Barbell',
      videoLinks: [],
      instructions: [],
      difficulty: 'Intermediate',
      force: 'Push',
      grips: null,
      mechanic: 'Compound',
      searchKeywords: [],
      createdAt: '',
      updatedAt: '',
    },
    sets: [
      { id: 's-1', reps: 10, weight: 135, unit: 'lbs', completed: false },
      { id: 's-2', reps: 10, weight: 135, unit: 'lbs', completed: false },
    ],
    restTime: 120,
  };

  store.dispatch(startWorkout({ name: 'Chest Day', exercises: [testExercise] }));
  return store;
}

describe('WorkoutPage Live AI header button', () => {
  beforeEach(() => {
    mockUser = { uid: 'user-123', email: 'test@example.com', displayName: 'Test User' };
    vi.spyOn(aiClient, 'isBackendAvailable').mockReturnValue(true);
    vi.spyOn(aiClient, 'isSignedIn').mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders Ask AI button in header on /workout and opens the chat with focusExerciseId', async () => {
    const user = userEvent.setup();
    const store = makeStore();

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/workout']}>
          <Routes>
            <Route
              path="/workout"
              element={
                <>
                  <WorkoutPage />
                  <AskAiHost />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </Provider>,
    );

    // AI button exists in header
    const askAiBtn = screen.getByRole('button', { name: 'Ask AI' });
    expect(askAiBtn).toBeInTheDocument();

    // Floating button is hidden on /workout
    // (AskAiHost renders a button with name 'Ask AI' only if showButton is true)
    // Here only 1 'Ask AI' button exists (the one in the header!)
    const aiButtons = screen.getAllByRole('button', { name: 'Ask AI' });
    expect(aiButtons).toHaveLength(1);

    // Clicking Ask AI opens chat
    await user.click(askAiBtn);

    const state = store.getState().ai;
    expect(state.open).toBe(true);
    expect(state.focusExerciseId).toBe('we-test-1');
  });

  it('renders Ask AI button in List mode as well', async () => {
    const user = userEvent.setup();
    const store = makeStore();

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/workout']}>
          <Routes>
            <Route path="/workout" element={<WorkoutPage />} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    );

    // Switch to List mode
    const listBtn = screen.getByRole('button', { name: 'List' });
    await user.click(listBtn);

    // Ask AI button is still rendered
    const askAiBtn = screen.getByRole('button', { name: 'Ask AI' });
    expect(askAiBtn).toBeInTheDocument();

    await user.click(askAiBtn);
    expect(store.getState().ai.open).toBe(true);
  });

  it('hides the Ask AI button when aiUsable is false (signed out)', () => {
    mockUser = null;
    const store = makeStore();

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/workout']}>
          <Routes>
            <Route path="/workout" element={<WorkoutPage />} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    );

    expect(screen.queryByRole('button', { name: 'Ask AI' })).not.toBeInTheDocument();
  });
});
