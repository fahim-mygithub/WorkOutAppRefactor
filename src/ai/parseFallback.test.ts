import { describe, it, expect } from 'vitest';
import { parseWithFallback } from '@/ai/parseFallback';

// The fallback wraps the REAL deterministic parser. These tests assert that
// freeform text -> structured sets works with NO backend at all.

describe('parseWithFallback (offline deterministic parse)', () => {
  it('parses a simple "3x10 Exercise" line into 3 sets of 10 reps', () => {
    const res = parseWithFallback({ text: '3x10 Squats' });

    expect(res.source).toBe('fallback');
    expect(res.workout.exercises).toHaveLength(1);
    const ex = res.workout.exercises[0];
    expect(ex.name).toBe('Squats');
    expect(ex.sets).toHaveLength(3);
    expect(ex.sets[0].reps).toBe(10);
  });

  it('parses weight and unit (@185lbs)', () => {
    const res = parseWithFallback({ text: '3x8 Bench Press @185lbs' });
    const ex = res.workout.exercises[0];
    expect(ex.sets[0].weight).toBe(185);
    expect(ex.sets[0].unit).toBe('lbs');
  });

  it('parses a rep range (8-12) into a {min,max} reps shape', () => {
    const res = parseWithFallback({ text: '4x8-12 Dumbbell Curls' });
    const ex = res.workout.exercises[0];
    expect(ex.sets[0].reps).toEqual({ min: 8, max: 12 });
  });

  it('parses a superset line into the supersets array', () => {
    const res = parseWithFallback({
      text: '3x8 Dumbbell Curls ss 3x12 Tricep Extensions',
    });
    expect(res.workout.supersets).toHaveLength(1);
    expect(res.workout.supersets[0]).toHaveLength(2);
    expect(res.workout.supersets[0][0].name).toBe('Dumbbell Curls');
    expect(res.workout.supersets[0][1].name).toBe('Tricep Extensions');
  });

  it('parses a multi-line workout', () => {
    const res = parseWithFallback({
      text: ['3x10 Squats @185lbs', '3x8 Bench Press @155lbs', '4x15 Push Ups'].join('\n'),
    });
    expect(res.workout.exercises).toHaveLength(3);
  });

  it('never throws on empty input — returns an empty workout with warnings', () => {
    const res = parseWithFallback({ text: '' });
    expect(res.source).toBe('fallback');
    expect(res.workout.exercises).toHaveLength(0);
    expect(res.workout.supersets).toHaveLength(0);
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it('does not retain state across calls (fresh parser per call)', () => {
    parseWithFallback({ text: 'totally unparseable %%%' });
    const res = parseWithFallback({ text: '3x10 Squats' });
    // The second call must not inherit warnings/errors from the first.
    expect(res.workout.exercises).toHaveLength(1);
  });
});
