import { describe, it, expect } from 'vitest';
import reducer, { startWorkout, setsPatched } from './workoutSlice';
import type { WorkoutExercise, WorkoutSet } from '../../types/exercise';

const start = (sets: WorkoutSet[]) =>
  reducer(undefined, startWorkout({
    name: 'Test',
    exercises: [{ id: 'ex1', exercise: { id: 'e1', name: 'Bench' } as WorkoutExercise['exercise'], sets }],
  }));

const setsOf = (state: ReturnType<typeof reducer>) => state.activeWorkout!.exercises[0].sets;

const base: WorkoutSet[] = [
  { id: 's1', reps: 3, weight: 225, unit: 'lbs', completed: true },
  { id: 's2', reps: 8, repMin: 8, repMax: 12, weight: 225, unit: 'lbs', completed: false },
];

describe('workoutSlice setsPatched', () => {
  it('merges changes into the set with that id', () => {
    const next = reducer(start(base), setsPatched({ exerciseId: 'ex1', patches: [{ setId: 's2', changes: { weight: 205 } }] }));
    expect(setsOf(next)[1]).toMatchObject({ id: 's2', weight: 205, reps: 8, repMin: 8 });
    expect(setsOf(next)[0].weight).toBe(225);
  });

  it('clears a field whose change is undefined', () => {
    const next = reducer(start(base), setsPatched({
      exerciseId: 'ex1', patches: [{ setId: 's2', changes: { reps: 5, repMin: undefined, repMax: undefined } }],
    }));
    const s2 = setsOf(next)[1];
    expect(s2.reps).toBe(5);
    expect('repMin' in s2).toBe(false);
    expect('repMax' in s2).toBe(false);
  });

  it('skips a patch whose onlyIf does not match the current set', () => {
    const next = reducer(start(base), setsPatched({
      exerciseId: 'ex1',
      patches: [
        { setId: 's1', changes: { weight: 205 }, onlyIf: { completed: false } },
        { setId: 's2', changes: { weight: 205 }, onlyIf: { completed: false } },
      ],
    }));
    expect(setsOf(next).map((s) => s.weight)).toEqual([225, 205]);
  });

  it('onlyIf with undefined matches an absent field', () => {
    const next = reducer(start(base), setsPatched({
      exerciseId: 'ex1', patches: [{ setId: 's1', changes: { rir: 2 }, onlyIf: { rir: undefined } }],
    }));
    expect(setsOf(next)[0].rir).toBe(2);
  });

  it('ignores unknown set ids and exercises', () => {
    const state = start(base);
    expect(reducer(state, setsPatched({ exerciseId: 'ex1', patches: [{ setId: 'nope', changes: { weight: 1 } }] }))).toEqual(state);
    expect(reducer(state, setsPatched({ exerciseId: 'nope', patches: [{ setId: 's1', changes: { weight: 1 } }] }))).toEqual(state);
  });
});
