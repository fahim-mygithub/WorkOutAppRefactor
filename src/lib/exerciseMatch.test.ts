import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { matchExercise, exerciseTokens } from '@/lib/exerciseMatch';
import type { Exercise } from '@/types/exercise';

// The real shipped library, so rankings are tested against actual names.
const library: Exercise[] = JSON.parse(
  readFileSync(resolve(__dirname, '../../public/exercises.json'), 'utf-8'),
);
const match = (name: string) => matchExercise(name, library)?.name ?? null;

describe('exerciseTokens', () => {
  it('lowercases, expands abbreviations and singularises', () => {
    expect(exerciseTokens('DB Curls')).toEqual(['dumbbell', 'curl']);
    expect(exerciseTokens('Push-ups')).toEqual(['push', 'up']);
  });
});

describe('matchExercise (real library)', () => {
  it('"bench press" is the barbell bench press, not the Larsen press', () => {
    expect(match('bench press')).toBe('Barbell Bench Press');
    expect(match('Bench Press')).toBe('Barbell Bench Press');
    expect(match('Barbell Bench Press')).toBe('Barbell Bench Press');
  });

  it('keeps an explicit variation', () => {
    expect(match('larsen bench press')).toBe('Barbell Larsen Bench Press');
    expect(match('incline bench press')).toBe('Barbell Incline Bench Press');
    expect(match('db incline bench press')).toBe('Dumbbell Incline Bench Press');
  });

  it('plural "Squats" is a squat, not jump squats', () => {
    expect(match('Squats')).not.toMatch(/jump/i);
    expect(match('Squats')).toMatch(/squat/i);
  });

  it('prefers the standard entry for common shorthand', () => {
    expect(match('front squat')).toBe('Barbell Front Squat Olympic');
    expect(match('barbell row')).toBe('Barbell Bent Over Row');
    expect(match('lat pulldown')).toBe('Machine Pulldown');
    expect(match('dips')).toBe('Parallel Bar Dips');
    expect(match('db curl')).toBe('Dumbbell Curl');
    expect(match('ohp')).toBe('Barbell Overhead Press');
  });

  it('finds the library name inside extra words', () => {
    expect(match('heavy barbell bench press')).toBe('Barbell Bench Press');
  });

  it('returns null rather than guessing wildly', () => {
    expect(match('zzz nonsense lift')).toBeNull();
    expect(match('')).toBeNull();
  });
});
