import { describe, expect, it } from 'vitest';
import { resolveExercise, matchExerciseInList, getCachedLibrary, searchExerciseIndex } from './exerciseIndex';
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

describe('searchExerciseIndex', () => {
  it('ranks real matches first and drops exercises that do not contain all query words', () => {
    const res = searchExerciseIndex('leg press');
    expect(res.results.length).toBeGreaterThan(0);
    // Top result is Machine Leg Press
    expect(res.results[0].name).toBe('Machine Leg Press');
    expect(res.results[0].equipment).toBe('Machine');

    // Every returned result contains both 'leg' and 'press'
    for (const r of res.results) {
      const lower = r.name.toLowerCase();
      expect(lower).toContain('leg');
      expect(lower).toContain('press');
    }

    // Never pads to cap with unrelated items (exactly 9 in the real library)
    expect(res.total).toBe(9);
    expect(res.returned).toBe(9);
    expect(res.truncated).toBe(false);
  });

  it('ranks Machine Hack Squat first and does not pad with generic squats', () => {
    const res = searchExerciseIndex('hack squat');
    expect(res.results.length).toBe(3);
    expect(res.results[0].name).toBe('Machine Hack Squat');
    expect(res.results[0].equipment).toBe('Machine');

    for (const r of res.results) {
      const lower = r.name.toLowerCase();
      expect(lower).toContain('hack');
      expect(lower).toContain('squat');
    }
  });

  it('indicates total > returned when truncated and respects limit', () => {
    const res = searchExerciseIndex('squat');
    expect(res.total).toBeGreaterThan(10);
    expect(res.returned).toBe(10);
    expect(res.results).toHaveLength(10);
    expect(res.truncated).toBe(true);
    expect(res.total).toBeGreaterThan(res.returned);

    // Custom limit
    const res5 = searchExerciseIndex('squat', [], getCachedLibrary(), 5);
    expect(res5.results).toHaveLength(5);
    expect(res5.returned).toBe(5);
    expect(res5.total).toBe(res.total);
    expect(res5.truncated).toBe(true);
  });

  it('ranks custom exercises before library exercises on a tie', () => {
    const custom = [
      {
        id: 'custom-leg-press-1',
        name: 'Machine Leg Press',
        muscleGroups: ['Quads'],
        equipment: 'Machine',
      },
    ];

    const res = searchExerciseIndex('leg press', custom);
    expect(res.results[0].id).toBe('custom-leg-press-1');
    expect(res.results[0].custom).toBe(true);
    expect(res.results[0].isCustom).toBe(true);
  });

  it('ranks exact name > starts with > consecutive words > all words > keyword', () => {
    const custom = [
      { id: 'c1', name: 'Bench Press', equipment: 'Barbell' },
      { id: 'c2', name: 'Bench Press With Chains', equipment: 'Barbell' },
      { id: 'c3', name: 'Incline Bench Press', equipment: 'Barbell' },
      { id: 'c4', name: 'Press with Bench Support', equipment: 'Barbell' },
      { id: 'c5', name: 'Chest Drive', equipment: 'Barbell', searchKeywords: ['bench press'] },
    ];

    const res = searchExerciseIndex('bench press', custom, []);
    expect(res.results.map((r) => r.id)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
  });

  it('uses typo-tolerant fuzzy matching only when nothing matches', () => {
    // Normal query with exact matches does not do fuzzy matching
    const normal = searchExerciseIndex('bench press');
    for (const r of normal.results) {
      expect(r.name.toLowerCase()).toContain('bench');
    }

    // Typo query with 0 regular matches uses fuzzy matching
    const typo = searchExerciseIndex('bnech press');
    expect(typo.results.length).toBeGreaterThan(0);
    const top = typo.results[0];
    expect(top.name.toLowerCase()).toContain('bench');

    // Gibberish returns 0
    const gibberish = searchExerciseIndex('xyzqwerasdfzxcv');
    expect(gibberish.total).toBe(0);
    expect(gibberish.results).toHaveLength(0);
    expect(gibberish.truncated).toBe(false);
  });

  it('finds Machine Pec Fly for gym slang pec deck', () => {
    const res = searchExerciseIndex('pec deck');
    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0].name).toContain('Pec Fly');
    expect(res.results[0].name.startsWith('Machine')).toBe(true);
  });

  it('ranks own-word results before synonym-only results', () => {
    const res = searchExerciseIndex('leg curl');
    expect(res.results.length).toBeGreaterThan(0);

    let seenSynonymOnly = false;
    for (const r of res.results) {
      const lower = r.name.toLowerCase();
      const isOwnWordMatch = lower.includes('leg') && lower.includes('curl');
      if (!isOwnWordMatch) {
        seenSynonymOnly = true;
      } else {
        expect(seenSynonymOnly, `own-word match "${r.name}" should rank before synonym-only results`).toBe(false);
      }
    }
  });

  it('returns 0 results for unknown queries', () => {
    const res = searchExerciseIndex('completelyunknownfakesportmove12345');
    expect(res.total).toBe(0);
    expect(res.results).toEqual([]);
  });

  it('resolves various gym slang queries via synonyms', () => {
    // pec dec / chest fly machine / butterfly machine
    for (const q of ['pec dec', 'chest fly machine', 'butterfly machine']) {
      const res = searchExerciseIndex(q);
      expect(res.results.length).toBeGreaterThan(0);
      expect(res.results[0].name).toContain('Pec Fly');
      expect(res.results[0].name.startsWith('Machine')).toBe(true);
    }

    // shoulder press
    const spRes = searchExerciseIndex('shoulder press');
    expect(spRes.results.length).toBeGreaterThan(0);
    expect(spRes.results[0].name).toContain('Overhead Press');

    // skull crusher spellings: own-word matches rank before synonym-only
    const scRes = searchExerciseIndex('skull crusher');
    expect(scRes.results.length).toBeGreaterThan(0);
    expect(scRes.results[0].name).toBe('Kettlebell Skull Crusher');
    const scNames = scRes.results.map((r) => r.name);
    expect(scNames).toContain('Barbell Skullcrusher');
    expect(scNames).toContain('Landmine Lying Tricep Extension');

    // tbar row / pullup / chinup
    const tbarRes = searchExerciseIndex('tbar row');
    expect(tbarRes.results.length).toBeGreaterThan(0);
    expect(tbarRes.results[0].name).toContain('T Bar Row');

    const pullupRes = searchExerciseIndex('pullup');
    expect(pullupRes.results.length).toBeGreaterThan(0);
    expect(pullupRes.results.some((r) => r.name.includes('Pull Up') || r.name.includes('Pullup'))).toBe(true);

    const chinupRes = searchExerciseIndex('chinup');
    expect(chinupRes.results.length).toBeGreaterThan(0);
    expect(chinupRes.results[0].name).toContain('Chin Up');

    // smith
    const smithRes = searchExerciseIndex('smith');
    expect(smithRes.results.length).toBeGreaterThan(0);
    expect(smithRes.results[0].name.startsWith('Smith Machine')).toBe(true);
  });
});
