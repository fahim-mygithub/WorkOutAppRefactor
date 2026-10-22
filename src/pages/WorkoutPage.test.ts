import { describe, it, expect, vi } from 'vitest';
import type { ActiveWorkout, Exercise } from '../types/exercise';
import { executeCompleteSet } from './WorkoutPage';
import {
  completeSet,
  startRestTimer,
  nextSupersetExercise,
  completeSuperset,
} from '../store/slices/workoutSlice';

const benchEx = {
  id: 'x-bench',
  name: 'Bench Press',
  muscleGroup: 'Chest',
  equipment: 'Barbell',
  instructions: [],
  difficulty: 'Intermediate',
} as unknown as Exercise;

const flyeEx = {
  id: 'x-flye',
  name: 'Dumbbell Flye',
  muscleGroup: 'Chest',
  equipment: 'Dumbbells',
  instructions: [],
  difficulty: 'Beginner',
} as unknown as Exercise;

function createWorkoutWithSuperset(): ActiveWorkout {
  return {
    id: 'w-superset',
    name: 'Superset Workout',
    startTime: new Date().toISOString(),
    currentExerciseIndex: 0,
    currentSetIndex: 0,
    isActive: true,
    duration: 0,
    exercises: [
      {
        id: 'we-1',
        exercise: benchEx,
        sets: [
          { id: 's1', reps: 10, weight: 100, completed: false },
          { id: 's2', reps: 10, weight: 100, completed: false },
        ],
        isSuperset: true,
        supersetId: 'ss-1',
        restTime: 90,
      },
      {
        id: 'we-2',
        exercise: flyeEx,
        sets: [
          { id: 's3', reps: 12, weight: 30, completed: false },
          { id: 's4', reps: 12, weight: 30, completed: false },
        ],
        isSuperset: true,
        supersetId: 'ss-1',
        restTime: 90,
      },
    ],
  } as unknown as ActiveWorkout;
}

function createWorkoutRegular(): ActiveWorkout {
  return {
    id: 'w-regular',
    name: 'Regular Workout',
    startTime: new Date().toISOString(),
    currentExerciseIndex: 0,
    currentSetIndex: 0,
    isActive: true,
    duration: 0,
    exercises: [
      {
        id: 'we-1',
        exercise: benchEx,
        sets: [
          { id: 's1', reps: 8, weight: 135, completed: false },
          { id: 's2', reps: 8, weight: 135, completed: false },
        ],
        restTime: 120,
      },
    ],
  } as unknown as ActiveWorkout;
}

describe('executeCompleteSet (lifted handler)', () => {
  it('dispatches completeSet with the exact exerciseIndex and setIndex provided', () => {
    const workout = createWorkoutWithSuperset();
    const dispatch = vi.fn();

    // Complete exercise 1, set 1 directly (bypassing currentExerciseIndex=0, currentSetIndex=0)
    executeCompleteSet({
      workout,
      exerciseIndex: 1,
      setIndex: 1,
      reps: 12,
      weight: 35,
      rir: 2,
      dispatch,
    });

    expect(dispatch).toHaveBeenCalledWith(
      completeSet({
        exerciseIndex: 1,
        setIndex: 1,
        setData: { reps: 12, weight: 35 },
        rir: 2,
      })
    );
  });

  describe('superset advance', () => {
    it('advances to next superset exercise when not the last exercise in the round', () => {
      const workout = createWorkoutWithSuperset();
      const dispatch = vi.fn();

      // Complete first exercise of superset on set 0
      executeCompleteSet({
        workout,
        exerciseIndex: 0,
        setIndex: 0,
        reps: 10,
        weight: 100,
        dispatch,
      });

      expect(dispatch).toHaveBeenCalledWith(nextSupersetExercise());
    });

    it('starts rest timer at the end of a round (last exercise in superset, not last set)', () => {
      const workout = createWorkoutWithSuperset();
      const dispatch = vi.fn();

      // Complete second (last) exercise of superset on set 0 (not last set)
      executeCompleteSet({
        workout,
        exerciseIndex: 1,
        setIndex: 0,
        reps: 12,
        weight: 30,
        dispatch,
      });

      expect(dispatch).toHaveBeenCalledWith(startRestTimer({ duration: 90 }));
      expect(dispatch).not.toHaveBeenCalledWith(completeSuperset());
    });

    it('starts rest timer and completes superset at final set of last exercise', () => {
      const workout = createWorkoutWithSuperset();
      const dispatch = vi.fn();

      // Complete second exercise of superset on set 1 (final set)
      executeCompleteSet({
        workout,
        exerciseIndex: 1,
        setIndex: 1,
        reps: 12,
        weight: 30,
        dispatch,
      });

      expect(dispatch).toHaveBeenCalledWith(startRestTimer({ duration: 90 }));
      expect(dispatch).toHaveBeenCalledWith(completeSuperset());
    });
  });

  describe('rest start', () => {
    it('starts rest timer with exercise restTime for regular exercises', () => {
      const workout = createWorkoutRegular();
      const dispatch = vi.fn();

      executeCompleteSet({
        workout,
        exerciseIndex: 0,
        setIndex: 0,
        reps: 8,
        weight: 135,
        dispatch,
      });

      expect(dispatch).toHaveBeenCalledWith(startRestTimer({ duration: 120 }));
    });

    it('skips rest timer and superset advancement when skipRestTimer is true', () => {
      const workout = createWorkoutWithSuperset();
      const dispatch = vi.fn();

      executeCompleteSet({
        workout,
        exerciseIndex: 0,
        setIndex: 0,
        reps: 10,
        weight: 100,
        dispatch,
        skipRestTimer: true,
      });

      expect(dispatch).toHaveBeenCalledWith(
        completeSet({
          exerciseIndex: 0,
          setIndex: 0,
          setData: { reps: 10, weight: 100 },
          rir: undefined,
        })
      );
      expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: expect.stringMatching(/startRestTimer|nextSupersetExercise/) }));
    });
  });
});
