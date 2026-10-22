import { describe, it, expect } from 'vitest';
import reducer, { activeWorkoutRestored } from './workoutSlice';
import type { ActiveWorkout, RestTimer } from '../../types/exercise';

const sampleWorkout: ActiveWorkout = {
  id: 'workout-restored-1',
  name: 'Leg Day',
  exercises: [
    {
      id: 'we-1',
      exercise: {
        id: 'squat',
        name: 'Barbell Squat',
        muscleGroup: 'Legs',
        muscleGroups: ['Quadriceps', 'Glutes'],
        equipment: 'Barbell',
        videoLinks: [],
        instructions: [],
        difficulty: 'Advanced',
        force: 'Push',
        grips: null,
        mechanic: 'Compound',
        searchKeywords: [],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      sets: [
        { id: 'set-1', reps: 5, weight: 315, completed: true },
        { id: 'set-2', reps: 5, weight: 315, completed: false },
      ],
    },
  ],
  currentExerciseIndex: 0,
  currentSetIndex: 1,
  startTime: '2026-10-22T10:00:00.000Z',
  duration: 18,
  isActive: true,
};

const sampleRestTimer: RestTimer = {
  isActive: true,
  timeRemaining: 75,
  duration: 120,
  targetEndTime: 1729600000000,
};

describe('workoutSlice - activeWorkoutRestored', () => {
  it('restores activeWorkout and restTimer into state', () => {
    const initialState = reducer(undefined, { type: '@@INIT' });
    expect(initialState.activeWorkout).toBeNull();
    expect(initialState.restTimer.isActive).toBe(false);

    const nextState = reducer(
      initialState,
      activeWorkoutRestored({
        activeWorkout: sampleWorkout,
        restTimer: sampleRestTimer,
      }),
    );

    expect(nextState.activeWorkout).toEqual(sampleWorkout);
    expect(nextState.restTimer).toEqual(sampleRestTimer);
  });

  it('restores activeWorkout without mutating existing restTimer if restTimer is omitted', () => {
    const initialState = reducer(undefined, { type: '@@INIT' });
    const defaultTimer = initialState.restTimer;

    const nextState = reducer(
      initialState,
      activeWorkoutRestored({
        activeWorkout: sampleWorkout,
      }),
    );

    expect(nextState.activeWorkout).toEqual(sampleWorkout);
    expect(nextState.restTimer).toEqual(defaultTimer);
  });
});

describe('workoutSlice - restoredFromSnapshot flag', () => {
  it('is set by activeWorkoutRestored and cleared by resumeAcknowledged, endWorkout and startWorkout', async () => {
    const { activeWorkoutRestored: restored, resumeAcknowledged, endWorkout, startWorkout } = await import('./workoutSlice');
    let state = reducer(undefined, { type: '@@INIT' });
    expect(state.restoredFromSnapshot).toBe(false);
    state = reducer(state, restored({ activeWorkout: sampleWorkout }));
    expect(state.restoredFromSnapshot).toBe(true);
    expect(reducer(state, resumeAcknowledged()).restoredFromSnapshot).toBe(false);
    expect(reducer(state, endWorkout()).restoredFromSnapshot).toBe(false);
    expect(
      reducer(state, startWorkout({ name: 'x', exercises: sampleWorkout.exercises })).restoredFromSnapshot,
    ).toBe(false);
  });
});
