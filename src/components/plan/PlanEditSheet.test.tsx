import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import plannedWorkoutsReducer, {
  planAdded,
  type PlannedWorkout,
} from '../../store/slices/plannedWorkoutsSlice';
import exerciseReducer, { setExercises } from '../../store/slices/exerciseSlice';
import userReducer from '../../store/slices/userSlice';
import aiReducer from '../../store/slices/aiSlice';
import { PlanEditSheet } from './PlanEditSheet';
import { toDateKey } from '../../lib/dateKey';
import type { Exercise } from '../../types/exercise';

const libraryExercises: Exercise[] = [
  {
    id: 'bench-press',
    name: 'Bench Press',
    muscleGroup: 'Chest',
    muscleGroups: ['Chest'],
    equipment: 'Barbell',
    videoLinks: [],
    instructions: [],
    difficulty: 'Intermediate',
    force: 'Push',
    grips: null,
    mechanic: 'Compound',
    searchKeywords: ['bench'],
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'lat-pulldown',
    name: 'Lat Pulldown',
    muscleGroup: 'Back',
    muscleGroups: ['Back'],
    equipment: 'Cable',
    videoLinks: [],
    instructions: [],
    difficulty: 'Beginner',
    force: 'Pull',
    grips: null,
    mechanic: 'Compound',
    searchKeywords: ['pulldown', 'back'],
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'tricep-pushdown',
    name: 'Tricep Pushdown',
    muscleGroup: 'Triceps',
    muscleGroups: ['Triceps'],
    equipment: 'Cable',
    videoLinks: [],
    instructions: [],
    difficulty: 'Beginner',
    force: 'Push',
    grips: null,
    mechanic: 'Isolation',
    searchKeywords: ['tricep'],
    createdAt: '',
    updatedAt: '',
  },
];

function setup(overrides?: Partial<PlannedWorkout>) {
  const today = toDateKey(new Date());
  const store = configureStore({
    reducer: {
      plannedWorkouts: plannedWorkoutsReducer,
      exercise: exerciseReducer,
      user: userReducer,
      ai: aiReducer,
    },
  });

  store.dispatch(setExercises(libraryExercises));

  const plan: PlannedWorkout = {
    id: 'plan-edit-1',
    dateKey: today,
    name: 'Upper Push',
    status: 'planned',
    createdAt: new Date().toISOString(),
    exercises: [
      {
        id: 'pe-1',
        exercise: libraryExercises[0],
        sets: [
          { id: 's-1', reps: 8, weight: 185, unit: 'lbs', completed: false },
          { id: 's-2', reps: 8, weight: 185, unit: 'lbs', completed: false },
          { id: 's-3', reps: 8, weight: 185, unit: 'lbs', completed: false },
        ],
        restTime: 120,
      },
      {
        id: 'pe-2',
        exercise: libraryExercises[2],
        sets: [
          { id: 's-4', reps: 12, weight: 50, unit: 'lbs', completed: false },
          { id: 's-5', reps: 12, weight: 50, unit: 'lbs', completed: false },
        ],
        restTime: 90,
      },
    ],
    ...overrides,
  };

  store.dispatch(planAdded(plan));
  const onOpenChange = vi.fn();

  const utils = render(
    <Provider store={store}>
      <PlanEditSheet plan={plan} open={true} onOpenChange={onOpenChange} />
    </Provider>,
  );

  return { ...utils, store, plan, onOpenChange };
}

describe('PlanEditSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists exercises with sets, reps, and weight and allows renaming and saving', () => {
    const { store, onOpenChange } = setup();

    const nameInput = screen.getByLabelText(/workout name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Upper Push');
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('Tricep Pushdown')).toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: 'Heavy Upper Push' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const updated = store.getState().plannedWorkouts.plans.find((p) => p.id === 'plan-edit-1');
    expect(updated?.name).toBe('Heavy Upper Push');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('edits an exercise sets, reps, and weight and persists on Save', () => {
    const { store } = setup();

    const setsInput = screen.getByLabelText(/sets for bench press/i) as HTMLInputElement;
    const repsInput = screen.getByLabelText(/reps for bench press/i) as HTMLInputElement;
    const weightInput = screen.getByLabelText(/weight for bench press/i) as HTMLInputElement;

    expect(setsInput.value).toBe('3');
    expect(repsInput.value).toBe('8');
    expect(weightInput.value).toBe('185');

    fireEvent.change(setsInput, { target: { value: '5' } });
    fireEvent.change(repsInput, { target: { value: '5' } });
    fireEvent.change(weightInput, { target: { value: '205' } });

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const updated = store.getState().plannedWorkouts.plans.find((p) => p.id === 'plan-edit-1');
    const bench = updated?.exercises[0];
    expect(bench?.sets).toHaveLength(5);
    expect(bench?.sets.every((s) => s.reps === 5 && s.weight === 205)).toBe(true);
  });

  it('removes an exercise and saves', () => {
    const { store } = setup();

    fireEvent.click(screen.getByRole('button', { name: /remove tricep pushdown/i }));
    expect(screen.queryByText('Tricep Pushdown')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const updated = store.getState().plannedWorkouts.plans.find((p) => p.id === 'plan-edit-1');
    expect(updated?.exercises.map((e) => e.exercise.name)).toEqual(['Bench Press']);
  });

  it('adds an exercise from the library via ExerciseQuickAdd and saves', () => {
    const { store } = setup();

    const searchInput = screen.getByLabelText(/add exercise/i);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'Lat Pulldown' } });

    const option = screen.getByRole('button', { name: /lat pulldown/i });
    fireEvent.click(option);

    expect(screen.getByText('Lat Pulldown')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const updated = store.getState().plannedWorkouts.plans.find((p) => p.id === 'plan-edit-1');
    expect(updated?.exercises.map((e) => e.exercise.name)).toEqual([
      'Bench Press',
      'Tricep Pushdown',
      'Lat Pulldown',
    ]);
  });

  it('discards all changes when Cancel is clicked', () => {
    const { store, onOpenChange } = setup();

    const nameInput = screen.getByLabelText(/workout name/i);
    fireEvent.change(nameInput, { target: { value: 'Discarded Name' } });
    fireEvent.click(screen.getByRole('button', { name: /remove bench press/i }));

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    const unchanged = store.getState().plannedWorkouts.plans.find((p) => p.id === 'plan-edit-1');
    expect(unchanged?.name).toBe('Upper Push');
    expect(unchanged?.exercises).toHaveLength(2);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables Save when workout name is empty or whitespace', () => {
    setup();

    const nameInput = screen.getByLabelText(/workout name/i);
    fireEvent.change(nameInput, { target: { value: '   ' } });

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });
});
