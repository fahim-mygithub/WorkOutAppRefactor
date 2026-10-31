/**
 * Fixtures are taken from the app: the key sets each service writes, and
 * outputs produced by running the app's own WorkoutParser and
 * generateFallbackExerciseId on the same inputs (src/parser/workoutParser.ts,
 * src/utils/workoutConversion.ts).
 */
import { describe, expect, it } from 'vitest';
import {
  buildCustomExerciseDoc,
  buildExerciseHistoryDoc,
  buildPlan,
  buildPlansDoc,
  buildProfileUpdate,
  buildSavedWorkoutDoc,
  buildWorkoutHistoryDoc,
  buildWorkoutUpdate,
  computeExerciseStats,
  deserializeParsedWorkout,
  fallbackExerciseId,
  formatWorkoutText,
  mergePlan,
  readProfile,
  readSavedWorkout,
  toParsedWorkout,
  toWorkoutExercises,
  updateExerciseStatsDoc,
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

/** Keys of ExerciseHistoryService.saveWorkoutSummary. */
const WORKOUT_HISTORY_KEYS = [
  'userId', 'name', 'workoutId', 'startTime', 'endTime', 'duration', 'totalExercises', 'totalSets', 'totalReps',
  'totalVolume', 'exercisesSummary',
];

/** Keys of ExerciseHistoryService.saveExercisePerformance. */
const EXERCISE_HISTORY_KEYS = [
  'userId', 'exerciseId', 'exerciseName', 'workoutDate', 'createdAt', 'sets', 'configuration', 'muscleGroups',
  'equipment', 'totalVolume', 'personalRecords', 'workoutId', 'workoutName',
];

/** Keys of ExerciseHistoryService.updateExerciseStats. */
const EXERCISE_STATS_KEYS = [
  'exerciseId', 'exerciseName', 'totalSessions', 'totalSets', 'totalReps', 'totalVolume', 'lastPerformed',
  'firstPerformed', 'maxWeight', 'maxReps', 'avgWeight', 'avgReps', 'frequency', 'personalRecords',
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

describe('workout history documents (ExerciseHistoryService)', () => {
  it('has exactly the fields saveWorkoutSummary writes', () => {
    const doc = buildWorkoutHistoryDoc(
      'uid1',
      'wh1',
      {
        date: '2026-10-25',
        name: 'Push Day',
        durationMinutes: 45,
        exercises: [
          { name: 'Bench Press', sets: [{ reps: 8, weight: 185 }, { reps: 8, weight: 185 }] },
          { name: 'Incline Dumbbell Press', sets: [{ reps: 10, weight: 60 }] },
        ],
      },
      NOW,
    );
    expect(Object.keys(doc).sort()).toEqual([...WORKOUT_HISTORY_KEYS].sort());
    expect(doc).toMatchObject({
      userId: 'uid1',
      name: 'Push Day',
      workoutId: 'wh1',
      duration: 45,
      totalExercises: 2,
      totalSets: 3,
      totalReps: 26,
      totalVolume: 2 * (8 * 185) + 10 * 60,
    });
    expect(doc.startTime).toBeInstanceOf(Date);
    expect(doc.endTime).toBeInstanceOf(Date);
    const summary = (doc.exercisesSummary as Record<string, unknown>[])[0];
    expect(Object.keys(summary).sort()).toEqual(['exerciseId', 'exerciseName', 'reps', 'sets', 'volume'].sort());
  });

  it('has exactly the fields saveExercisePerformance writes', () => {
    const doc = buildExerciseHistoryDoc(
      'uid1',
      'wh1',
      'Push Day',
      new Date('2026-10-25T12:00:00.000Z'),
      {
        name: 'Bench Press',
        sets: [
          { reps: 8, weight: 185 },
          { reps: 8, weight: 185 },
        ],
      },
      { maxWeight: true },
      NOW,
    );
    expect(Object.keys(doc).sort()).toEqual([...EXERCISE_HISTORY_KEYS].sort());
    expect(doc).toMatchObject({
      userId: 'uid1',
      exerciseId: fallbackExerciseId('Bench Press'),
      exerciseName: 'Bench Press',
      configuration: '2x8',
      muscleGroups: ['Unknown'],
      equipment: 'Unknown',
      totalVolume: 2960,
      personalRecords: { maxWeight: true },
      workoutId: 'wh1',
      workoutName: 'Push Day',
    });
    expect(doc.workoutDate).toBeInstanceOf(Date);
    expect(doc.createdAt).toBeInstanceOf(Date);
    const sets = doc.sets as Record<string, unknown>[];
    expect(sets).toHaveLength(2);
    expect(sets[0]).toMatchObject({
      setNumber: 1,
      targetReps: 8,
      actualReps: 8,
      weight: 185,
      unit: 'lbs',
      completed: true,
    });
  });

  it('computes and updates exercise_stats matching updateExerciseStats', () => {
    const sets = [
      { setNumber: 1, targetReps: 8, actualReps: 8, weight: 185, unit: 'lbs' as const, completed: true },
      { setNumber: 2, targetReps: 8, actualReps: 8, weight: 195, unit: 'lbs' as const, completed: true },
    ];
    const initial = updateExerciseStatsDoc(
      fallbackExerciseId('Bench Press'),
      'Bench Press',
      null,
      sets,
      8 * 185 + 8 * 195,
      { maxWeight: true, maxReps: true, maxVolume: true },
      NOW,
    );
    expect(Object.keys(initial).sort()).toEqual([...EXERCISE_STATS_KEYS].sort());
    expect(initial).toMatchObject({
      exerciseName: 'Bench Press',
      totalSessions: 1,
      totalSets: 2,
      totalReps: 16,
      totalVolume: 3040,
      maxWeight: 195,
      maxReps: 8,
      avgWeight: Math.round(3040 / 16),
      avgReps: 8,
    });

    const secondDate = new Date('2026-10-31T12:00:00.000Z');
    const updated = updateExerciseStatsDoc(
      fallbackExerciseId('Bench Press'),
      'Bench Press',
      initial,
      [{ setNumber: 1, targetReps: 10, actualReps: 10, weight: 175, unit: 'lbs' as const, completed: true }],
      1750,
      { maxReps: true },
      secondDate,
    );
    expect(updated).toMatchObject({
      totalSessions: 2,
      totalSets: 3,
      totalReps: 26,
      totalVolume: 4790,
      maxWeight: 195,
      maxReps: 10,
    });

    const recomputed = computeExerciseStats(fallbackExerciseId('Bench Press'), 'Bench Press', [
      { workoutDate: NOW, sets: [{ actualReps: 8, weight: 185 }, { actualReps: 8, weight: 195 }], totalVolume: 3040 },
      { workoutDate: secondDate, sets: [{ actualReps: 10, weight: 175 }], totalVolume: 1750 },
    ]);
    expect(recomputed).toMatchObject({
      totalSessions: 2,
      totalSets: 3,
      totalReps: 26,
      totalVolume: 4790,
      maxWeight: 195,
      maxReps: 10,
    });
  });

  it('updateExerciseStatsDoc safely handles empty completedSets without -Infinity', () => {
    const emptyStats = updateExerciseStatsDoc(
      'bench-press',
      'Bench Press',
      null,
      [],
      0,
      {},
      NOW,
    );
    expect(emptyStats).toEqual({});

    const existingStats = { maxWeight: 200, maxReps: 10 };
    const unchangedStats = updateExerciseStatsDoc(
      'bench-press',
      'Bench Press',
      existingStats,
      [],
      0,
      {},
      NOW,
    );
    expect(unchangedStats).toBe(existingStats);
  });
});

describe('superset counting (Pull Day Seal Row Oct 1 fixture)', () => {
  it('counts 9 not 12 for a fixture like Pull Day Seal Row Oct 1', () => {
    const fixture = {
      name: 'Pull Day Seal Row Oct 1',
      parsedWorkout: {
        _dataFormat: 'serialized_v1',
        exercises: [
          { name: 'Machine Plate Loaded Seal Row', sets: [{ reps: 8, weight: 160 }] },
          { name: 'Lat Pulldown', sets: [{ reps: 10, weight: 140 }] },
          { name: 'Face Pull', sets: [{ reps: 15, weight: 50 }] },
          {
            name: 'Barbell Curl + Overhead Tricep Extension',
            isSuperset: true,
            sets: [{ reps: 10, weight: 65 }],
            supersetExercises: [
              { name: 'Barbell Curl', sets: [{ reps: 10, weight: 65 }] },
              { name: 'Overhead Tricep Extension', sets: [{ reps: 10, weight: 50 }] },
            ],
          },
          {
            name: 'Hammer Curl + Lateral Raise',
            isSuperset: true,
            sets: [{ reps: 12, weight: 30 }],
            supersetExercises: [
              { name: 'Hammer Curl', sets: [{ reps: 12, weight: 30 }] },
              { name: 'Lateral Raise', sets: [{ reps: 12, weight: 20 }] },
            ],
          },
          {
            name: 'Shrug + Wrist Curl',
            isSuperset: true,
            sets: [{ reps: 15, weight: 80 }],
            supersetExercises: [
              { name: 'Shrug', sets: [{ reps: 15, weight: 80 }] },
              { name: 'Wrist Curl', sets: [{ reps: 15, weight: 40 }] },
            ],
          },
        ],
        supersets_serialized: JSON.stringify([
          [
            { name: 'Barbell Curl', sets: [{ reps: 10, weight: 65 }] },
            { name: 'Overhead Tricep Extension', sets: [{ reps: 10, weight: 50 }] },
          ],
          [
            { name: 'Hammer Curl', sets: [{ reps: 12, weight: 30 }] },
            { name: 'Lateral Raise', sets: [{ reps: 12, weight: 20 }] },
          ],
          [
            { name: 'Shrug', sets: [{ reps: 15, weight: 80 }] },
            { name: 'Wrist Curl', sets: [{ reps: 15, weight: 40 }] },
          ],
        ]),
      },
      workoutText: '...',
    };

    const parsed = deserializeParsedWorkout(fixture.parsedWorkout);
    expect(parsed.exercises).toHaveLength(3);
    expect(parsed.exercises.map((e) => e.name)).toEqual([
      'Machine Plate Loaded Seal Row',
      'Lat Pulldown',
      'Face Pull',
    ]);
    expect(parsed.supersets).toHaveLength(3);
    const totalCount = parsed.exercises.length + parsed.supersets.flat().length;
    expect(totalCount).toBe(9);

    const view = readSavedWorkout('sw-1', fixture);
    expect(view.exercises).toHaveLength(3);
    expect(view.supersets).toHaveLength(3);
  });
});
