import { describe, expect, it } from 'vitest';
import { resolveExercise, matchExerciseInList, getCachedLibrary } from './exerciseIndex';
import { fallbackExerciseId } from './shapes';
import { matchExercise } from '../../../src/lib/exerciseMatch';

describe('exerciseIndex', () => {
  it('resolves library exercises by exact name, alias, and keywords', () => {
    const bench = resolveExercise('Bench Press');
    expect(bench.isFallback).toBe(false);
    expect(bench.matchedBy).toBe('library');
    expect(bench.id).toBe('exercise-1335');
    expect(bench.matchedName).toBe('Barbell Bench Press');
    expect(bench.equipment).toBe('Barbell');

    const squat = resolveExercise('Squat');
    expect(squat.isFallback).toBe(false);
    expect(squat.matchedBy).toBe('library');

    const deadlift = resolveExercise('Deadlift');
    expect(deadlift.isFallback).toBe(false);
    expect(deadlift.matchedBy).toBe('library');

    const tricepPushdown = resolveExercise('Tricep Pushdown');
    expect(tricepPushdown.isFallback).toBe(false);
  });

  it('agrees with the app matcher across library exercises and gym shorthand', () => {
    const library = getCachedLibrary();
    const testCases = [
      'bench press',
      'Bench Press',
      'Barbell Bench Press',
      'larsen bench press',
      'incline bench press',
      'db incline bench press',
      'Squats',
      'front squat',
      'barbell row',
      'lat pulldown',
      'dips',
      'db curl',
      'ohp',
      'heavy barbell bench press',
      'unmatched unknown workout move',
    ];

    for (const name of testCases) {
      const appMatch = matchExercise(name, library as any);
      const wrkMatch = matchExerciseInList(name, library);

      if (appMatch) {
        expect(wrkMatch).not.toBeNull();
        expect(wrkMatch!.id).toBe(appMatch.id);
        expect(wrkMatch!.name).toBe(appMatch.name);

        const resolved = resolveExercise(name);
        expect(resolved.id).toBe(appMatch.id);
        expect(resolved.matchedName).toBe(appMatch.name);
        expect(resolved.isFallback).toBe(false);
      } else {
        expect(wrkMatch).toBeNull();
        const resolved = resolveExercise(name);
        expect(resolved.id).toBe(fallbackExerciseId(name));
        expect(resolved.matchedName).toBe(name.trim());
        expect(resolved.isFallback).toBe(true);
      }
    }
  });

  it('resolves custom exercises with priority over library', () => {
    const custom = [
      {
        id: 'custom-1',
        name: 'Bench Press',
        muscleGroups: ['Chest', 'Shoulders'],
        equipment: 'Barbell',
      },
    ];
    const res = resolveExercise('Bench Press', custom);
    expect(res.isFallback).toBe(false);
    expect(res.matchedBy).toBe('custom');
    expect(res.id).toBe('custom-1');
  });

  it('falls back to fallback id when exercise is unknown', () => {
    const unknown = resolveExercise('Zorblaxian Space Wobble');
    expect(unknown.isFallback).toBe(true);
    expect(unknown.matchedBy).toBe('fallback');
    expect(unknown.id).toBe(fallbackExerciseId('Zorblaxian Space Wobble'));
    expect(unknown.muscleGroups).toEqual(['Unknown']);
    expect(unknown.equipment).toBe('Unknown');
  });
  it('matches the exact exercise ID contract written by useFinishWorkout / ExerciseHistoryService in a fresh session', () => {
    const library = getCachedLibrary();
    const sampleNames = [
      'Barbell Bench Press',
      'bench press',
      'Squat',
      'Deadlift',
      'Unregistered Super Move 99',
    ];

    // In the app (src/hooks/useFinishWorkout.ts -> src/services/workoutStorageService.ts):
    // useFinishWorkout saves each completed exercise with:
    //   ExerciseHistoryService.saveExercisePerformance(userId, { exerciseId: exercise.exercise.id, ... })
    // where exercise.exercise.id was derived by matchExercise(name, library)?.id || fallbackExerciseId(name)
    for (const name of sampleNames) {
      const appMatch = matchExercise(name, library as any);
      const expectedAppStoredId = appMatch ? appMatch.id : fallbackExerciseId(name);

      const workerResolved = resolveExercise(name);
      expect(workerResolved.id).toBe(expectedAppStoredId);
      expect(workerResolved.isFallback).toBe(expectedAppStoredId.startsWith('fallback-'));
    }
  });

  it('reuses previous app fallback ID from history when logging either canonical name or gym shorthand', () => {
    const library = getCachedLibrary();
    const appStoredBenchId = fallbackExerciseId('Barbell Bench Press'); // fallback-eo82lz
    const historyList = [
      {
        exerciseId: appStoredBenchId,
        exerciseName: 'Barbell Bench Press',
        workoutDate: new Date('2026-10-01'),
        muscleGroups: ['Barbell', 'Chest', 'Mid and Lower Chest'],
        equipment: 'Barbell',
      },
    ];

    // 1. Canonical name reuses history id
    const canonical = resolveExercise('Barbell Bench Press', undefined, library, historyList);
    expect(canonical.id).toBe(appStoredBenchId);
    expect(canonical.matchedBy).toBe('history');

    // 2. Gym shorthand 'bench press' also matches history and reuses appStoredBenchId instead of library id
    const shorthand = resolveExercise('bench press', undefined, library, historyList);
    expect(shorthand.id).toBe(appStoredBenchId);
    expect(shorthand.matchedBy).toBe('history');
  });
});
