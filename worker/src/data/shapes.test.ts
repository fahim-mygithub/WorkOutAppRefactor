/**
 * Fixtures are taken from the app: the key sets each service writes, and
 * outputs produced by running the app's own WorkoutParser and
 * generateFallbackExerciseId on the same inputs (src/parser/workoutParser.ts,
 * src/utils/workoutConversion.ts).
 */
import { describe, expect, it } from 'vitest';
import {
  buildCustomExerciseDoc,
  buildPlan,
  buildPlansDoc,
  buildProfileUpdate,
  buildSavedWorkoutDoc,
  buildWorkoutUpdate,
  deserializeParsedWorkout,
  fallbackExerciseId,
  formatWorkoutText,
  mergePlan,
  readProfile,
  toParsedWorkout,
  toWorkoutExercises,
  type PlannedWorkout,
  type WorkoutInput,
} from './shapes';

const NOW = new Date('2026-10-30T12:00:00.000Z');

/** Keys of `dataToSave` in WorkoutStorageService.saveWorkout. */
const SAVED_WORKOUT_KEYS = [
  'userId', 'name', 'description', 'workoutText', 'parsedWorkout', 'customExercises', 'tags', 'category',
  'difficulty', 'isPublic', 'createdAt', 'updatedAt', 'performanceCount', 'estimatedDuration', 'lastPerformedAt',
];

/** Keys CustomExerciseService.saveCustomExercise writes. */
const CUSTOM_EXERCISE_KEYS = [
  'originalName', 'name', 'muscleGroup', 'equipment', 'difficulty', 'instructions', 'notes', 'videoLinks', 'userId',
  'isCustom', 'id', 'force', 'grips', 'mechanic', 'searchKeywords', 'createdAt', 'updatedAt', 'usageCount',
];

/** Keys of a PlannedWorkout after planAdded's prepare(). */
const PLAN_KEYS = ['id', 'dateKey', 'name', 'exercises', 'status', 'createdAt', 'updatedAt'];

/** Keys of createFallbackExercise(). */
const EXERCISE_KEYS = [
  'id', 'name', 'muscleGroup', 'muscleGroups', 'equipment', 'videoLinks', 'instructions', 'difficulty', 'force',
  'grips', 'mechanic', 'searchKeywords', 'createdAt', 'updatedAt',
];

const PUSH: WorkoutInput = {
  name: '  Push Day  ',
  exercises: [
    { name: 'Barbell Bench Press', sets: 3, reps: 8, repsMax: 12, weight: 135 },
    { name: 'Back Squat', sets: 4, reps: 5, weight: 100, unit: 'kg' },
    { name: 'Pull Up', sets: 3, reps: 10 },
  ],
  supersets: [[
    { name: 'Cable Fly', sets: 3, reps: 12, weight: 30, unit: 'lbs' },
    { name: 'Push Up', sets: 3, reps: 15 },
  ]],
};

/** WorkoutParser.parse(formatWorkoutText(PUSH)).workout, captured from the app. */
const APP_PARSE_OF_PUSH_TEXT = {
  exercises: [
    { name: 'Barbell Bench Press', sets: Array(3).fill({ reps: { min: 8, max: 12 }, weight: 135, unit: 'lbs' }) },
    { name: 'Back Squat', sets: Array(4).fill({ reps: 5, weight: 100, unit: 'kg' }) },
    { name: 'Pull Up', sets: Array(3).fill({ reps: 10 }) },
  ],
  supersets: [[
    { name: 'Cable Fly', sets: Array(3).fill({ reps: 12, weight: 30, unit: 'lbs' }) },
    { name: 'Push Up', sets: Array(3).fill({ reps: 15 }) },
  ]],
};

describe('saved workout documents (WorkoutStorageService)', () => {
  it('has exactly the fields saveWorkout writes, with app defaults', () => {
    const doc = buildSavedWorkoutDoc('uid1', { ...PUSH, description: ' Heavy ' }, NOW);
    expect(Object.keys(doc).sort()).toEqual([...SAVED_WORKOUT_KEYS].sort());
    expect(doc).toMatchObject({
      userId: 'uid1',
      name: 'Push Day',
      description: 'Heavy',
      customExercises: [],
      tags: [],
      category: 'Strength',
      difficulty: 'Intermediate',
      isPublic: false,
      performanceCount: 0,
      lastPerformedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(doc.createdAt).toBeInstanceOf(Date);
  });

  it('serialises parsedWorkout as serialized_v1 with supersets as a JSON string', () => {
    const doc = buildSavedWorkoutDoc('uid1', PUSH, NOW);
    const pw = doc.parsedWorkout as Record<string, unknown>;
    expect(Object.keys(pw).sort()).toEqual(['_dataFormat', 'exercises', 'supersets_serialized']);
    expect(pw._dataFormat).toBe('serialized_v1');
    expect(typeof pw.supersets_serialized).toBe('string');
    expect(deserializeParsedWorkout(pw)).toEqual(APP_PARSE_OF_PUSH_TEXT);
  });

  it('writes workoutText that the app parser reads back as the same workout', () => {
    const text = formatWorkoutText(toParsedWorkout(PUSH));
    expect(text).toBe(
      '3x8-12 Barbell Bench Press @135lbs\n4x5 Back Squat @100kg\n3x10 Pull Up\n3x12 Cable Fly @30lbs ss 3x15 Push Up',
    );
    expect(toParsedWorkout(PUSH)).toEqual(APP_PARSE_OF_PUSH_TEXT);
  });

  it('estimates duration like generateWorkoutSummary (2 min/set + 1/exercise, min 15)', () => {
    expect(buildSavedWorkoutDoc('u', PUSH, NOW).estimatedDuration).toBe(16 * 2 + 5);
    expect(buildSavedWorkoutDoc('u', { name: 'x', exercises: [{ name: 'a', sets: 1, reps: 5 }] }, NOW).estimatedDuration).toBe(15);
  });

  it('reads the legacy (unserialised) parsedWorkout format too', () => {
    expect(deserializeParsedWorkout({ exercises: [], supersets: [[{ name: 'a', sets: [] }]] }).supersets).toHaveLength(1);
  });

  it('updates only the fields given, keeping text and parsed workout in step', () => {
    const current = toParsedWorkout(PUSH);
    const nameOnly = buildWorkoutUpdate({ name: ' New ' }, current, NOW);
    expect(nameOnly.mask).toEqual(['name', 'updatedAt']);
    const ex = buildWorkoutUpdate({ exercises: [{ name: 'Deadlift', sets: 1, reps: 5, weight: 315 }] }, current, NOW);
    expect(ex.mask.sort()).toEqual(['estimatedDuration', 'parsedWorkout', 'updatedAt', 'workoutText']);
    expect(ex.data.workoutText).toBe('1x5 Deadlift @315lbs\n3x12 Cable Fly @30lbs ss 3x15 Push Up');
  });
});

describe('planned workouts (plannedWorkoutsSlice / PlannedWorkoutsService)', () => {
  it('uses the app\'s fallback exercise ids', () => {
    // Values from the app's generateFallbackExerciseId.
    expect(fallbackExerciseId('Barbell Bench Press')).toBe('fallback-eo82lz');
    expect(fallbackExerciseId('Leg Press')).toBe('fallback-3z1mlt');
    expect(fallbackExerciseId('  Hammer Strength Row  ')).toBe('fallback-dadthx');
  });

  it('builds WorkoutExercises like convertSavedWorkoutToExercises', () => {
    const ex = toWorkoutExercises(toParsedWorkout(PUSH), NOW.toISOString(), 's');
    expect(ex).toHaveLength(5);
    expect(Object.keys(ex[0].exercise).sort()).toEqual([...EXERCISE_KEYS].sort());
    expect(ex[0]).toMatchObject({ restTime: 120, exercise: { id: 'fallback-eo82lz', name: 'Barbell Bench Press' } });
    expect(ex[0].sets[0]).toEqual({ id: 'set-s-0-0', reps: 8, repMin: 8, repMax: 12, weight: 135, unit: 'lbs', completed: false });
    expect(ex[3]).toMatchObject({ isSuperset: true, supersetIndex: 0, restTime: 90, notes: 'Superset 1 (1/2)' });
    expect(ex[3].supersetExerciseIds).toEqual([ex[3].id, ex[4].id]);
    expect(ex[4].supersetId).toBe(ex[3].supersetId);
  });

  it('builds a plan with exactly the prepared planAdded fields', () => {
    const plan = buildPlan({ id: 'p1', dateKey: '2026-11-02', name: 'Push', exercises: [] }, NOW.toISOString());
    expect(Object.keys(plan).sort()).toEqual([...PLAN_KEYS].sort());
    expect(plan).toMatchObject({ status: 'planned', createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() });
  });

  it('merges by id and never drops other plans', () => {
    const a = { id: 'a', name: 'A' } as PlannedWorkout;
    const b = { id: 'b', name: 'B' } as PlannedWorkout;
    expect(mergePlan([a, b], { id: 'c' } as PlannedWorkout).map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(mergePlan([a, b], { id: 'a', name: 'A2' } as PlannedWorkout)).toEqual([{ id: 'a', name: 'A2' }, b]);
  });

  it('wraps plans like saveRemote: { plans, schemaVersion: 1, updatedAt: ISO string }', () => {
    expect(buildPlansDoc([], NOW.toISOString())).toEqual({ plans: [], schemaVersion: 1, updatedAt: NOW.toISOString() });
  });
});

describe('custom exercises (CustomExerciseService.saveCustomExercise)', () => {
  it('has exactly the service\'s fields; cues become instructions, defaults go in notes', () => {
    const doc = buildCustomExerciseDoc(
      'uid1',
      {
        name: 'Iso Row',
        muscleGroups: ['Back', 'Biceps'],
        equipment: 'Machine',
        setupCues: ['Seat 4', 'Chest pad 2'],
        defaultSets: 3,
        defaultReps: 10,
        defaultWeight: 90,
      },
      NOW,
    );
    expect(Object.keys(doc).sort()).toEqual([...CUSTOM_EXERCISE_KEYS].sort());
    expect(doc).toMatchObject({
      originalName: 'Iso Row',
      muscleGroup: 'Back, Biceps',
      instructions: ['Seat 4', 'Chest pad 2'],
      notes: 'Default: 3 x 10 @ 90 lbs',
      isCustom: true,
      id: '',
      force: null,
      usageCount: 1,
      difficulty: 'Intermediate',
      searchKeywords: ['iso row', 'iso row', 'back, biceps', 'machine', 'iso', 'row'],
    });
  });
});

describe('profile (UserProfileService)', () => {
  it('reads with the app\'s preference defaults underneath', () => {
    expect(readProfile({ displayName: 'F', preferences: { weightUnit: 'kg' } }).preferences).toMatchObject({
      weightUnit: 'kg',
      defaultRestTime: 120,
      theme: 'system',
    });
    expect(readProfile(null).exists).toBe(false);
  });

  it('writes nested preference paths only, plus updatedAt', () => {
    const { data, mask } = buildProfileUpdate({ displayName: ' Fahim ', preferences: { weightUnit: 'kg' } }, NOW);
    expect(mask).toEqual(['displayName', 'preferences.weightUnit', 'updatedAt']);
    expect(data).toEqual({ displayName: 'Fahim', preferences: { weightUnit: 'kg' }, updatedAt: NOW });
  });
});
