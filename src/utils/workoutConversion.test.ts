import { describe, it, expect } from 'vitest';
import {
  convertSavedWorkoutToExercises,
  convertWorkoutHistoryToExercises,
  prepareWorkoutForConfigurator,
  sanitizeWorkoutExercisesForRedux,
} from './workoutConversion';
import { planToBuildPreset } from '../lib/planWorkout';
import { toDateKey, addDaysKey } from '../lib/dateKey';
import type { Exercise, WorkoutExercise } from '../types/exercise';
import type { SavedWorkout } from '../services/workoutStorageService';
import type { PlannedWorkout } from '../store/slices/plannedWorkoutsSlice';

const bench: Exercise = {
  id: 'ex-bench',
  name: 'Barbell Bench Press',
  muscleGroup: 'Chest',
  muscleGroups: ['Chest'],
  equipment: 'Barbell',
  videoLinks: [],
  instructions: [],
  difficulty: 'Intermediate',
  force: null,
  grips: null,
  mechanic: null,
  searchKeywords: ['bench'],
  createdAt: '',
  updatedAt: '',
};

const curl: Exercise = {
  ...bench,
  id: 'ex-curl',
  name: 'Dumbbell Curl',
  muscleGroup: 'Biceps',
  muscleGroups: ['Biceps'],
  equipment: 'Dumbbells',
};

const tricep: Exercise = {
  ...bench,
  id: 'ex-tri',
  name: 'Overhead Tricep Extension',
  muscleGroup: 'Triceps',
  muscleGroups: ['Triceps'],
  equipment: 'Dumbbells',
};

describe('workoutConversion emphasis and superset preservation', () => {
  it('sanitizeWorkoutExercisesForRedux preserves emphasis and syncs it with tracked.goal', () => {
    const items: WorkoutExercise[] = [
      {
        id: 'w1',
        exercise: bench,
        sets: [{ id: 's1', reps: 5, weight: 205, unit: 'lbs', completed: false }],
        tracked: { liftId: 'lift-bench', goal: 'strength' },
      },
      {
        id: 'w2',
        exercise: curl,
        sets: [{ id: 's2', reps: 12, weight: 30, unit: 'lbs', completed: false }],
        emphasis: 'volume',
      },
      {
        id: 'w3',
        exercise: bench,
        sets: [{ id: 's3', reps: 1, weight: 270, unit: 'lbs', completed: false }],
        tracked: { liftId: 'lift-bench', goal: 'checkpoint' },
        emphasis: 'strength',
      },
    ];

    const sanitized = sanitizeWorkoutExercisesForRedux(items);
    expect(sanitized[0].emphasis).toBe('strength');
    expect(sanitized[0].tracked).toEqual({ liftId: 'lift-bench', goal: 'strength' });
    expect(sanitized[1].emphasis).toBe('volume');
    expect(sanitized[1].tracked).toBeUndefined();
    // Checkpoint never carries emphasis
    expect(sanitized[2].tracked).toEqual({ liftId: 'lift-bench', goal: 'checkpoint' });
    expect(sanitized[2].emphasis).toBeUndefined();
  });

  it('prepareWorkoutForConfigurator expands supersets into individual rows with supersetGroup and per-partner emphasis', () => {
    const prepared = prepareWorkoutForConfigurator({
      exercises: [
        { name: 'Barbell Bench Press', sets: [{ reps: 5, weight: 185, unit: 'lbs' }], emphasis: 'strength' },
      ],
      supersets: [
        [
          { name: 'Dumbbell Curl', sets: [{ reps: 12, weight: 30, unit: 'lbs' }], emphasis: 'volume' },
          { name: 'Overhead Tricep Extension', sets: [{ reps: 8, weight: 50, unit: 'lbs' }], emphasis: 'strength' },
        ],
      ],
    });

    expect(prepared.exercises).toHaveLength(3);
    expect(prepared.exercises[0]).toMatchObject({
      name: 'Barbell Bench Press',
      emphasis: 'strength',
    });
    expect(prepared.exercises[0].supersetGroup).toBeUndefined();
    expect(prepared.exercises[1]).toMatchObject({
      name: 'Dumbbell Curl',
      emphasis: 'volume',
      supersetGroup: 1,
    });
    expect(prepared.exercises[2]).toMatchObject({
      name: 'Overhead Tricep Extension',
      emphasis: 'strength',
      supersetGroup: 1,
    });
  });

  it('convertSavedWorkoutToExercises and convertWorkoutHistoryToExercises preserve emphasis', () => {
    const now = new Date();
    const saved = {
      id: 'sw-1',
      userId: 'u1',
      name: 'Arms',
      workoutText: '',
      parsedWorkout: {
        exercises: [{ name: 'Barbell Bench Press', sets: [{ reps: 5, weight: 185, unit: 'lbs' as const }], emphasis: 'strength' as const }],
        supersets: [
          [
            { name: 'Dumbbell Curl', sets: [{ reps: 12, weight: 30, unit: 'lbs' as const }], emphasis: 'volume' as const },
            { name: 'Overhead Tricep Extension', sets: [{ reps: 8, weight: 50, unit: 'lbs' as const }], emphasis: 'strength' as const },
          ],
        ],
      },
      customExercises: [],
      tags: [],
      isPublic: false,
      createdAt: now,
      updatedAt: now,
      performanceCount: 0,
      difficulty: 'Intermediate',
    } satisfies SavedWorkout;

    const converted = convertSavedWorkoutToExercises(saved, [bench, curl, tricep]);
    expect(converted.map((e) => [e.exercise.name, e.emphasis, Boolean(e.isSuperset)])).toEqual([
      ['Barbell Bench Press', 'strength', false],
      ['Dumbbell Curl', 'volume', true],
      ['Overhead Tricep Extension', 'strength', true],
    ]);

    const fromHistory = convertWorkoutHistoryToExercises(
      [
        {
          id: 'eh-1',
          userId: 'u1',
          exerciseId: 'ex-curl',
          exerciseName: 'Dumbbell Curl',
          workoutDate: now,
          sets: [{ setNumber: 1, targetReps: 12, actualReps: 12, weight: 30, unit: 'lbs', completed: true }],
          configuration: '1x12',
          muscleGroups: ['Biceps'],
          equipment: 'Dumbbells',
          totalVolume: 360,
          emphasis: 'volume',
        },
      ],
      [curl],
    );
    expect(fromHistory.exercises[0].emphasis).toBe('volume');
  });

  it('planToBuildPreset preserves plan id, date, sets, unit, notes, superset pairing, and per-partner emphasis', () => {
    const dateKey = addDaysKey(toDateKey(new Date()), 2);
    const plan: PlannedWorkout = {
      id: 'plan-edit-1',
      dateKey,
      name: 'Upper Mix',
      status: 'planned',
      createdAt: new Date().toISOString(),
      exercises: [
        {
          id: 'pe-1',
          exercise: bench,
          sets: [
            { id: 's1', reps: 3, weight: 185, unit: 'lbs', completed: false },
            { id: 's2', reps: 3, weight: 195, unit: 'lbs', completed: false },
          ],
          restTime: 180,
          notes: 'Paused on chest',
          tracked: { liftId: 'lift-bench', goal: 'strength' },
          emphasis: 'strength',
        },
        {
          id: 'pe-2',
          exercise: curl,
          sets: [{ id: 's3', reps: 10, repMin: 10, repMax: 14, weight: 14, unit: 'kg', completed: false }],
          restTime: 90,
          isSuperset: true,
          supersetId: 'ss-arms',
          supersetIndex: 0,
          supersetExerciseIds: ['pe-2', 'pe-3'],
          notes: 'Superset (1/2) · Keep elbows pinned',
          emphasis: 'volume',
        },
        {
          id: 'pe-3',
          exercise: tricep,
          sets: [{ id: 's4', reps: 8, weight: 24, unit: 'kg', completed: false }],
          restTime: 90,
          isSuperset: true,
          supersetId: 'ss-arms',
          supersetIndex: 1,
          notes: 'Superset (2/2)',
          emphasis: 'strength',
        },
      ],
    };

    const preset = planToBuildPreset(plan);
    expect(preset.name).toBe('Upper Mix');
    expect(preset.planEdit).toMatchObject({ planId: 'plan-edit-1', dateKey });
    expect(preset.planEdit?.exercises).toHaveLength(3);
    expect(preset.planEdit?.exercises?.[0]).toMatchObject({
      name: 'Barbell Bench Press',
      notes: 'Paused on chest',
      restTime: 180,
      emphasis: 'strength',
      tracked: { liftId: 'lift-bench', goal: 'strength' },
    });
    expect(preset.planEdit?.exercises?.[0].sets.map((s) => s.weight)).toEqual([185, 195]);
    expect(preset.planEdit?.exercises?.[1]).toMatchObject({
      name: 'Dumbbell Curl',
      notes: 'Keep elbows pinned',
      emphasis: 'volume',
      supersetGroup: 1,
    });
    expect(preset.planEdit?.exercises?.[2]).toMatchObject({
      name: 'Overhead Tricep Extension',
      emphasis: 'strength',
      supersetGroup: 1,
    });
    expect(preset.planEdit?.exercises?.[2].notes).toBeUndefined();
    expect(preset.workout.workoutText).toContain('[strength]');
    expect(preset.workout.workoutText).toContain('[volume]');
    expect(preset.workout.workoutText).toContain(' ss ');
  });
});
