import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import plannedWorkoutsReducer, { planAdded } from '../../store/slices/plannedWorkoutsSlice';
import scheduleReducer, { templateActivated } from '../../store/slices/scheduleSlice';
import workoutReducer from '../../store/slices/workoutSlice';
import trackedLiftsReducer from '../../store/slices/trackedLiftsSlice';
import userReducer from '../../store/slices/userSlice';
import exerciseReducer from '../../store/slices/exerciseSlice';
import aiReducer from '../../store/slices/aiSlice';
import { TodayWorkout } from './TodayWorkout';
import { toDateKey, addDaysKey } from '../../lib/dateKey';
import type { WorkoutSummary } from '../../types/exerciseHistory';
import type { WorkoutExercise } from '../../types/exercise';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../hooks/useExercises', () => ({
  useExercises: () => ({ exercises: [], isLoading: false, error: null }),
}));

function makeExercise(id: string, name: string): WorkoutExercise {
  return {
    id,
    exercise: {
      id: `ex-${id}`,
      name,
      muscleGroup: 'Chest',
      muscleGroups: ['Chest'],
      equipment: 'Barbell',
      videoLinks: [],
      instructions: [],
      difficulty: 'Intermediate',
      force: null,
      grips: null,
      mechanic: null,
      searchKeywords: [],
      createdAt: '',
      updatedAt: '',
    },
    sets: [
      { id: `${id}-s1`, reps: 8, weight: 185, unit: 'lbs', completed: false },
      { id: `${id}-s2`, reps: 8, weight: 185, unit: 'lbs', completed: false },
    ],
    restTime: 120,
  };
}

function createTestStore() {
  return configureStore({
    reducer: {
      plannedWorkouts: plannedWorkoutsReducer,
      schedule: scheduleReducer,
      workout: workoutReducer,
      trackedLifts: trackedLiftsReducer,
      user: userReducer,
      exercise: exerciseReducer,
      ai: aiReducer,
    },
  });
}

describe('TodayWorkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Free day when nothing is planned and no recent workout exists', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MemoryRouter>
          <TodayWorkout workoutHistory={[]} isLoading={false} />
        </MemoryRouter>
      </Provider>,
    );

    expect(screen.getByText('Nothing planned')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Free day' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /build a workout/i })).toBeInTheDocument();
  });

  it('renders the planned workout for today with name, exercise count, and Start', () => {
    const store = createTestStore();
    const today = toDateKey(new Date());

    store.dispatch(
      planAdded({
        id: 'plan-1',
        dateKey: today,
        name: 'Chest + Shoulders + Heavy Arms',
        exercises: [
          makeExercise('e1', 'Bench Press'),
          makeExercise('e2', 'Overhead Press'),
          makeExercise('e3', 'Lateral Raise'),
        ],
      }),
    );

    render(
      <Provider store={store}>
        <MemoryRouter>
          <TodayWorkout workoutHistory={[]} isLoading={false} />
        </MemoryRouter>
      </Provider>,
    );

    expect(screen.getByText('Planned for today')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Chest + Shoulders + Heavy Arms' })).toBeInTheDocument();
    expect(screen.getByText(/3 exercises/i)).toBeInTheDocument();

    const startBtn = screen.getByRole('button', { name: /start/i });
    fireEvent.click(startBtn);

    expect(store.getState().workout.activeWorkout?.name).toBe('Chest + Shoulders + Heavy Arms');
    expect(mockNavigate).toHaveBeenCalledWith('/workout');
  });

  it('shows "+N more planned today" when multiple plans exist for today', () => {
    const store = createTestStore();
    const today = toDateKey(new Date());

    store.dispatch(
      planAdded({
        id: 'plan-1',
        dateKey: today,
        name: 'Morning Push',
        exercises: [makeExercise('e1', 'Bench Press')],
      }),
    );
    store.dispatch(
      planAdded({
        id: 'plan-2',
        dateKey: today,
        name: 'Evening Conditioning',
        exercises: [makeExercise('e2', 'Rowing')],
      }),
    );
    store.dispatch(
      planAdded({
        id: 'plan-3',
        dateKey: today,
        name: 'Core Finisher',
        exercises: [],
      }),
    );

    render(
      <Provider store={store}>
        <MemoryRouter>
          <TodayWorkout workoutHistory={[]} isLoading={false} />
        </MemoryRouter>
      </Provider>,
    );

    expect(screen.getByRole('heading', { name: 'Morning Push' })).toBeInTheDocument();
    expect(screen.getByText(/1 exercise/i)).toBeInTheDocument();
    expect(screen.getByText(/\+2 more planned today/i)).toBeInTheDocument();
  });

  it('prefers calendar plan over old schedule-based plan and recent-workout rest day', () => {
    const store = createTestStore();
    const today = toDateKey(new Date());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);

    const nowIso = new Date().toISOString();
    // Activate old Charlie-Split schedule
    store.dispatch(
      templateActivated({
        program: {
          templateId: 'charlie-split',
          startedAtKey: today,
          startRotation: 0,
          startPushCycle: 0,
        },
        oneRepMax: {
          'bb-bench': {
            key: 'bb-bench',
            value: 225,
            unit: 'lbs',
            source: 'entered',
            enteredAt: nowIso,
            updatedAt: nowIso,
          },
        },
        pullup: null,
      }),
    );

    // Also add a calendar plan for today
    store.dispatch(
      planAdded({
        id: 'cal-today',
        dateKey: today,
        name: 'Custom Calendar Push',
        exercises: [makeExercise('e1', 'Incline Press'), makeExercise('e2', 'Dips')],
      }),
    );

    const recentHistory: WorkoutSummary[] = [
      {
        id: 'w-yesterday',
        userId: 'u1',
        name: 'Pull Day',
        startTime: yesterdayDate,
        endTime: yesterdayDate,
        duration: 50,
        totalExercises: 4,
        totalSets: 12,
        totalReps: 100,
        totalVolume: 8000,
        exercisesSummary: [],
      },
    ];

    render(
      <Provider store={store}>
        <MemoryRouter>
          <TodayWorkout workoutHistory={recentHistory} isLoading={false} />
        </MemoryRouter>
      </Provider>,
    );

    expect(screen.getByRole('heading', { name: 'Custom Calendar Push' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Rest day' })).not.toBeInTheDocument();
  });

  it('still shows logged workout when a workout was logged today even if a plan exists', () => {
    const store = createTestStore();
    const today = toDateKey(new Date());

    store.dispatch(
      planAdded({
        id: 'plan-today',
        dateKey: today,
        name: 'Planned Push',
        exercises: [makeExercise('e1', 'Bench Press')],
      }),
    );

    const now = new Date();
    const loggedToday: WorkoutSummary[] = [
      {
        id: 'w-today',
        userId: 'u1',
        name: 'Morning Bench Session',
        startTime: now,
        endTime: now,
        duration: 45,
        totalExercises: 5,
        totalSets: 15,
        totalReps: 120,
        totalVolume: 12000,
        exercisesSummary: [],
      },
    ];

    render(
      <Provider store={store}>
        <MemoryRouter>
          <TodayWorkout workoutHistory={loggedToday} isLoading={false} />
        </MemoryRouter>
      </Provider>,
    );

    expect(screen.getByRole('heading', { name: 'Morning Bench Session' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Planned Push' })).not.toBeInTheDocument();
  });

  it('ignores done, skipped, and non-today calendar plans', () => {
    const store = createTestStore();
    const today = toDateKey(new Date());
    const tomorrow = addDaysKey(today, 1);

    store.dispatch(
      planAdded({
        id: 'plan-done',
        dateKey: today,
        name: 'Already Done',
        status: 'done',
        exercises: [],
      }),
    );
    store.dispatch(
      planAdded({
        id: 'plan-skipped',
        dateKey: today,
        name: 'Skipped Plan',
        status: 'skipped',
        exercises: [],
      }),
    );
    store.dispatch(
      planAdded({
        id: 'plan-tomorrow',
        dateKey: tomorrow,
        name: 'Tomorrow Plan',
        exercises: [],
      }),
    );

    render(
      <Provider store={store}>
        <MemoryRouter>
          <TodayWorkout workoutHistory={[]} isLoading={false} />
        </MemoryRouter>
      </Provider>,
    );

    expect(screen.getByRole('heading', { name: 'Free day' })).toBeInTheDocument();
  });

  it('shows emphasis chips on Today hero and navigates to /build via Edit button or card tap', () => {
    const store = createTestStore();
    const today = toDateKey(new Date());

    store.dispatch(
      planAdded({
        id: 'plan-hero',
        dateKey: today,
        name: 'Heavy Push',
        exercises: [{ ...makeExercise('e1', 'Bench Press'), emphasis: 'strength' }],
      }),
    );

    render(
      <Provider store={store}>
        <MemoryRouter>
          <TodayWorkout workoutHistory={[]} isLoading={false} />
        </MemoryRouter>
      </Provider>,
    );

    expect(screen.getByText('Strength')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /edit heavy push/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/build');
    expect(store.getState().ai.buildPreset?.planEdit).toMatchObject({
      planId: 'plan-hero',
      dateKey: today,
    });

    mockNavigate.mockClear();
    fireEvent.click(screen.getByTestId('today-plan-card'));
    expect(mockNavigate).toHaveBeenCalledWith('/build');
  });
});
