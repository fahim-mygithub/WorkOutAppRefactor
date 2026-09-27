import { describe, it, expect } from 'vitest';
import { groupIdsByTerm, muscleHeat, musclesForExercise, type MuscleLogEntry } from '@/lib/muscleHeat';

// Local-time dates so "days" follow the calendar the user sees.
const at = (day: number, hour = 18) => new Date(2026, 8, day, hour).toISOString();
const entry = (day: number, ...terms: string[]): MuscleLogEntry => ({ date: at(day), terms });
const on = (day: number, hour = 9) => new Date(2026, 8, day, hour);

describe('musclesForExercise', () => {
  it('maps catalog muscle lists (with equipment words) to map terms', () => {
    expect(musclesForExercise({ muscleGroup: 'Barbell, Biceps, Forearms, Lats' })).toEqual(['Biceps', 'Forearms', 'Lats']);
    expect(musclesForExercise({ muscleGroups: ['Barbell', 'Glutes', 'Lower back', 'Traps (mid-back)'] })).toEqual([
      'Traps',
      'Lower back',
      'Glutes',
    ]);
    expect(musclesForExercise({ muscleGroup: '' })).toEqual([]);
  });
});

describe('muscleHeat', () => {
  it('1 exercise = orange for the day and the next, grey after 2 days', () => {
    const log = [entry(21, 'Biceps')];
    expect(muscleHeat(log, on(21))).toEqual({ Biceps: 'warm' });
    expect(muscleHeat(log, on(22))).toEqual({ Biceps: 'warm' });
    expect(muscleHeat(log, on(23))).toEqual({});
  });

  it('2+ exercises = red, orange after one rest day, grey after 2 days', () => {
    const log = [entry(21, 'Biceps'), entry(21, 'Biceps', 'Forearms')];
    expect(muscleHeat(log, on(21))).toEqual({ Biceps: 'hot', Forearms: 'warm' });
    expect(muscleHeat(log, on(22))).toEqual({ Biceps: 'warm', Forearms: 'warm' });
    expect(muscleHeat(log, on(23))).toEqual({});
  });

  it('counts exercises across workouts on the same day', () => {
    const log = [{ ...entry(21, 'Chest'), date: at(21, 7) }, { ...entry(21, 'Chest'), date: at(21, 19) }];
    expect(muscleHeat(log, on(21, 22))).toEqual({ Chest: 'hot' });
  });

  it('the most recent day wins (a light day after a heavy one is orange)', () => {
    const log = [entry(20, 'Quads'), entry(20, 'Quads'), entry(21, 'Quads')];
    expect(muscleHeat(log, on(21))).toEqual({ Quads: 'warm' });
  });

  it('an exercise hitting a muscle twice in its list counts once', () => {
    expect(muscleHeat([entry(21, 'Chest', 'Chest')], on(21))).toEqual({ Chest: 'warm' });
  });
});

describe('groupIdsByTerm', () => {
  it('maps a term to every SVG group that shows it', () => {
    const ids = groupIdsByTerm();
    expect(ids.Shoulders.sort()).toEqual(['front-shoulders', 'rear-shoulders']);
    expect(ids.Biceps).toEqual(['biceps']);
  });
});
