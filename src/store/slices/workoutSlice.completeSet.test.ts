import { describe, it, expect } from 'vitest';
import reducer, { startWorkout, completeSet } from './workoutSlice';
import type { WorkoutExercise, WorkoutSet } from '../../types/exercise';

// Reducer-level coverage for completeSet: it must now persist `rir` (the optional
// effort tap) and write a real `failed` flag derived from the prescribed range
// floor (repMin, or the single configured reps) vs the LOGGED reps.

const makeExercise = (sets: WorkoutSet[]): WorkoutExercise => ({
  id: 'ex1',
  // The reducer never reads `.exercise`; a minimal stub keeps the test focused.
  exercise: { id: 'e1', name: 'Bench Press' } as WorkoutExercise['exercise'],
  sets,
});

const start = (sets: WorkoutSet[]) =>
  reducer(undefined, startWorkout({ name: 'Test', exercises: [makeExercise(sets)] }));

const firstSet = (state: ReturnType<typeof reducer>) =>
  state.activeWorkout!.exercises[0].sets[0];

describe('workoutSlice completeSet — failed flag + rir', () => {
  it('marks failed when logged reps fall below the prescribed range floor (repMin)', () => {
    const state = start([{ id: 's1', reps: 10, repMin: 10, repMax: 15, weight: 50, completed: false }]);
    const next = reducer(
      state,
      completeSet({ exerciseIndex: 0, setIndex: 0, setData: { reps: 8, weight: 50 } }),
    );
    const set = firstSet(next);
    expect(set.completed).toBe(true);
    expect(set.failed).toBe(true);
    expect(set.reps).toBe(8); // logged reps overwrite the prescription
  });

  it('does NOT mark failed when logged reps hit the range floor', () => {
    const state = start([{ id: 's1', reps: 10, repMin: 10, repMax: 15, weight: 50, completed: false }]);
    const next = reducer(
      state,
      completeSet({ exerciseIndex: 0, setIndex: 0, setData: { reps: 12, weight: 50 } }),
    );
    expect(firstSet(next).failed).toBe(false);
  });

  it('falls back to the single configured reps when no range is set', () => {
    const state = start([{ id: 's1', reps: 8, weight: 50, completed: false }]);
    const next = reducer(
      state,
      completeSet({ exerciseIndex: 0, setIndex: 0, setData: { reps: 6, weight: 50 } }),
    );
    expect(firstSet(next).failed).toBe(true); // 6 < 8
  });

  it('writes rir when the lifter logged it', () => {
    const state = start([{ id: 's1', reps: 10, repMin: 10, repMax: 15, weight: 50, completed: false }]);
    const next = reducer(
      state,
      completeSet({ exerciseIndex: 0, setIndex: 0, setData: { reps: 12, weight: 50 }, rir: 2 }),
    );
    expect(firstSet(next).rir).toBe(2);
  });

  it('leaves rir unset when skipped', () => {
    const state = start([{ id: 's1', reps: 10, repMin: 10, repMax: 15, weight: 50, completed: false }]);
    const next = reducer(
      state,
      completeSet({ exerciseIndex: 0, setIndex: 0, setData: { reps: 12, weight: 50 } }),
    );
    expect(firstSet(next).rir).toBeUndefined();
  });
});
