import { describe, it, expect } from 'vitest';
import { reuseWorkoutExercises, preparePlannedWorkoutForExecution } from './planWorkout';
import type { ExerciseHistory } from '../types/exerciseHistory';
import type { TrackedLift } from '../types/trackedLifts';
import type { PlannedWorkout } from '../store/slices/plannedWorkoutsSlice';

describe('planWorkout helper', () => {
  const sampleHistories: ExerciseHistory[] = [
    {
      id: 'h-1',
      userId: 'u1',
      workoutId: 'w1',
      exerciseId: 'bench-press',
      exerciseName: 'Bench Press',
      workoutDate: new Date('2026-10-10'),
      configuration: '3x10',
      muscleGroups: ['Chest'],
      equipment: 'Barbell',
      sets: [
        {
          setNumber: 1,
          targetReps: 10,
          actualReps: 10,
          weight: 185,
          unit: 'lbs',
          completed: true,
        },
        {
          setNumber: 2,
          targetReps: 10,
          actualReps: 8,
          weight: 185,
          unit: 'lbs',
          completed: true,
        },
        {
          setNumber: 3,
          targetReps: 10,
          actualReps: 0,
          weight: 185,
          unit: 'lbs',
          completed: false, // Incomplete set!
        },
      ],
      totalVolume: 3330,
    },
    {
      id: 'h-2',
      userId: 'u1',
      workoutId: 'w1',
      exerciseId: 'curl',
      exerciseName: 'Bicep Curl',
      workoutDate: new Date('2026-10-10'),
      configuration: '1x12',
      muscleGroups: ['Arms'],
      equipment: 'Dumbbell',
      sets: [
        {
          setNumber: 1,
          targetReps: 12,
          actualReps: 12,
          weight: 30,
          unit: 'lbs',
          completed: true,
        },
      ],
      totalVolume: 360,
    },
  ];

  it('reuseWorkoutExercises copies completed sets only with logged actual reps and weights', () => {
    const exercises = reuseWorkoutExercises(sampleHistories, []);
    expect(exercises.length).toBe(2);

    const bench = exercises[0];
    // Incomplete 3rd set was skipped:
    expect(bench.sets.length).toBe(2);
    expect(bench.sets[0].reps).toBe(10);
    expect(bench.sets[0].weight).toBe(185);
    expect(bench.sets[0].completed).toBe(false);

    expect(bench.sets[1].reps).toBe(8); // Logged actual reps
    expect(bench.sets[1].weight).toBe(185);
    expect(bench.sets[1].completed).toBe(false);

    const curl = exercises[1];
    expect(curl.sets.length).toBe(1);
    expect(curl.sets[0].reps).toBe(12);
    expect(curl.sets[0].weight).toBe(30);
  });

  it('preparePlannedWorkoutForExecution prescribes fresh progression load for tracked progression lifts', () => {
    const trackedBench: TrackedLift = {
      id: 'lift-bench',
      name: 'Bench Press',
      category: 'Push',
      load: { kind: 'weight', value: 200, unit: 'lb' },
      target: { kind: 'reps', min: 8, max: 12 },
      progression: true,
      cycle: { volume: 0, strength: 0 },
    };

    const initialExercises = reuseWorkoutExercises(sampleHistories, [], [trackedBench]);

    const planned: PlannedWorkout = {
      id: 'p-1',
      dateKey: '2026-10-24',
      name: 'Push Day',
      exercises: initialExercises,
      status: 'planned',
      createdAt: '2026-10-22',
    };

    const readyExercises = preparePlannedWorkoutForExecution(planned, [trackedBench], 'volume');

    // Bench press should be prescribed via progression (4 sets of 8-12 at working load)
    const bench = readyExercises[0];
    expect(bench.tracked?.liftId).toBe('lift-bench');
    expect(bench.sets.length).toBe(4); // Volume prescribes 4 sets

    // Bicep curl is not a progression lift, so it preserves the 1 copied set of 30 lbs x 12 reps
    const curl = readyExercises[1];
    expect(curl.sets.length).toBe(1);
    expect(curl.sets[0].weight).toBe(30);
    expect(curl.sets[0].reps).toBe(12);
  });
});
