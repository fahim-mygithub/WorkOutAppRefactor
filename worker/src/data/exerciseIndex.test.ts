import { describe, expect, it } from 'vitest';
import { resolveExercise } from './exerciseIndex';
import { fallbackExerciseId } from './shapes';

describe('exerciseIndex', () => {
  it('resolves library exercises by exact name, alias, and keywords', () => {
    const bench = resolveExercise('Bench Press');
    expect(bench.isFallback).toBe(false);
    expect(bench.matchedBy).toBe('library');
    expect(bench.id).toBe('exercise-1335');
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
});
