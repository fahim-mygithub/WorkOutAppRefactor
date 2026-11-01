import { describe, it, expect } from 'vitest';
import reducer, {
  startWorkout,
  completeSet,
  uncompleteSet,
  jumpToSet,
  nextExercise,
  addSet,
  removeOpenSets,
  addExerciseToWorkout,
  removeExerciseFromWorkout,
  updateExerciseNotesAndTitle,
  type WorkoutState,
} from './workoutSlice';
import type { WorkoutExercise } from '../../types/exercise';

function makeState(): WorkoutState {
  const ex1: WorkoutExercise = {
    id: 'e1',
    exercise: { id: 'x1', name: 'Barbell Bench Press', muscleGroups: ['Chest'], equipment: 'Barbell' } as any,
    sets: [
      { id: 's1', reps: 5, weight: 200, unit: 'lbs', completed: true },
      { id: 's2', reps: 5, weight: 200, unit: 'lbs', completed: false },
      { id: 's3', reps: 5, weight: 200, unit: 'lbs', completed: false },
    ],
    restTime: 120,
  };
  const ex2: WorkoutExercise = {
    id: 'e2',
    exercise: { id: 'x2', name: 'Incline Dumbbell Press', muscleGroups: ['Chest'], equipment: 'Dumbbells' } as any,
    sets: [
      { id: 's4', reps: 10, weight: 60, unit: 'lbs', completed: false },
      { id: 's5', reps: 10, weight: 60, unit: 'lbs', completed: false },
    ],
    restTime: 90,
  };
  return reducer(undefined, startWorkout({ name: 'Push', exercises: [ex1, ex2] }));
}

describe('workoutSlice live-ai reducers', () => {
  describe('addSet with exerciseId', () => {
    it('appends a set using exerciseId, copying previous set defaults', () => {
      const s0 = makeState();
      const s1 = reducer(s0, addSet({ exerciseId: 'e1' }));
      const ex = s1.activeWorkout!.exercises[0];
      expect(ex.sets).toHaveLength(4);
      expect(ex.sets[3].reps).toBe(5);
      expect(ex.sets[3].weight).toBe(200);
      expect(ex.sets[3].completed).toBe(false);
    });

    it('appends a set with explicit setData and id', () => {
      const s0 = makeState();
      const s1 = reducer(s0, addSet({ exerciseId: 'e1', setData: { id: 's-new', reps: 8, weight: 185, unit: 'lbs' } }));
      const ex = s1.activeWorkout!.exercises[0];
      expect(ex.sets[ex.sets.length - 1]).toMatchObject({ id: 's-new', reps: 8, weight: 185, unit: 'lbs', completed: false });
    });
  });

  describe('removeOpenSets', () => {
    it('drops N uncompleted sets from the end', () => {
      const s0 = makeState();
      const s1 = reducer(s0, removeOpenSets({ exerciseId: 'e1', count: 1 }));
      expect(s1.activeWorkout!.exercises[0].sets.map((s) => s.id)).toEqual(['s1', 's2']);
    });

    it('never drops a completed set', () => {
      const s0 = makeState();
      // e1 has s1 (completed), s2 (open), s3 (open). Asking to drop 5 only drops s3 and s2.
      const s1 = reducer(s0, removeOpenSets({ exerciseId: 'e1', count: 5 }));
      expect(s1.activeWorkout!.exercises[0].sets.map((s) => s.id)).toEqual(['s1']);
      expect(s1.activeWorkout!.exercises[0].sets[0].completed).toBe(true);
    });

    it('keeps at least one set even if all sets are uncompleted', () => {
      const s0 = makeState();
      // e2 has 2 open sets. Asking to drop 2 only drops 1, leaving at least 1 set.
      const s1 = reducer(s0, removeOpenSets({ exerciseId: 'e2', count: 2 }));
      expect(s1.activeWorkout!.exercises[1].sets).toHaveLength(1);
    });

    it('removes targeted sets by setIds when uncompleted', () => {
      const s0 = makeState();
      const s1 = reducer(s0, removeOpenSets({ exerciseId: 'e1', setIds: ['s3'] }));
      expect(s1.activeWorkout!.exercises[0].sets.map((s) => s.id)).toEqual(['s1', 's2']);
    });

    it('clamps currentSetIndex if it exceeds the remaining sets count', () => {
      let s = makeState();
      s = reducer(s, jumpToSet({ exerciseIndex: 0, setIndex: 2 }));
      s = reducer(s, removeOpenSets({ exerciseId: 'e1', count: 2 }));
      expect(s.activeWorkout!.currentSetIndex).toBe(0); // clamped to last set index (s1 = index 0)
    });
  });

  describe('addExerciseToWorkout', () => {
    const newEx: WorkoutExercise = {
      id: 'e-new',
      exercise: { id: 'x-cable', name: 'Cable Fly', muscleGroups: ['Chest'], equipment: 'Cables' } as any,
      sets: [{ id: 's-fly1', reps: 12, weight: 25, unit: 'lbs', completed: false }],
      restTime: 60,
    };

    it('appends exercise at the end when afterExerciseId is omitted', () => {
      const s0 = makeState();
      const s1 = reducer(s0, addExerciseToWorkout({ exercise: newEx }));
      expect(s1.activeWorkout!.exercises).toHaveLength(3);
      expect(s1.activeWorkout!.exercises[2].id).toBe('e-new');
    });

    it('inserts exercise after afterExerciseId when specified', () => {
      const s0 = makeState();
      const s1 = reducer(s0, addExerciseToWorkout({ exercise: newEx, afterExerciseId: 'e1' }));
      expect(s1.activeWorkout!.exercises).toHaveLength(3);
      expect(s1.activeWorkout!.exercises[1].id).toBe('e-new');
      expect(s1.activeWorkout!.exercises[2].id).toBe('e2');
    });
  });

  describe('removeExerciseFromWorkout', () => {
    it('removes an exercise with no completed sets', () => {
      const s0 = makeState();
      const s1 = reducer(s0, removeExerciseFromWorkout({ exerciseId: 'e2' }));
      expect(s1.activeWorkout!.exercises.map((e) => e.id)).toEqual(['e1']);
    });

    it('refuses to remove an exercise with completed sets', () => {
      const s0 = makeState();
      // e1 has s1 completed
      const s1 = reducer(s0, removeExerciseFromWorkout({ exerciseId: 'e1' }));
      expect(s1.activeWorkout!.exercises.map((e) => e.id)).toEqual(['e1', 'e2']);
    });

    it('refuses to remove the only exercise in a workout', () => {
      let s = makeState();
      s = reducer(s, removeExerciseFromWorkout({ exerciseId: 'e2' }));
      // uncomplete s1 on e1
      s = reducer(s, uncompleteSet({ exerciseIndex: 0, setIndex: 0 }));
      // now e1 has no completed sets, but it is the only exercise left
      const s2 = reducer(s, removeExerciseFromWorkout({ exerciseId: 'e1' }));
      expect(s2.activeWorkout!.exercises).toHaveLength(1);
    });

    it('adjusts currentExerciseIndex when the removed exercise is before or at the cursor', () => {
      let s = makeState();
      s = reducer(s, nextExercise()); // pointing to e2
      expect(s.activeWorkout!.currentExerciseIndex).toBe(1);
      const s1 = reducer(s, removeExerciseFromWorkout({ exerciseId: 'e2' }));
      expect(s1.activeWorkout!.currentExerciseIndex).toBe(0);
    });
  });

  describe('updateExerciseNotesAndTitle', () => {
    it('sets notes on an exercise and deletes notes when cleared with empty string', () => {
      const s0 = makeState();
      const s1 = reducer(s0, updateExerciseNotesAndTitle({ exerciseId: 'e1', notes: 'pause at bottom' }));
      expect(s1.activeWorkout!.exercises[0].notes).toBe('pause at bottom');

      const s2 = reducer(s1, updateExerciseNotesAndTitle({ exerciseId: 'e1', notes: '' }));
      expect(s2.activeWorkout!.exercises[0].notes).toBeUndefined();
    });
  });
});
