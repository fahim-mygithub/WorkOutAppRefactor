import { describe, it, expect } from 'vitest';
import {
  formatLoad,
  formatTarget,
  seedTrackedLifts,
  groupByCategory,
  trackedLiftsToWorkout,
  workoutNameForLifts,
} from '@/lib/trackedLifts';

describe('formatLoad', () => {
  it('formats a plate/dumbbell weight with its unit', () => {
    expect(formatLoad({ kind: 'weight', value: 265, unit: 'lb' })).toBe('265 lb');
    expect(formatLoad({ kind: 'weight', value: 22.5, unit: 'kg' })).toBe('22.5 kg');
  });

  it('drops float noise from fractional weights', () => {
    expect(formatLoad({ kind: 'weight', value: 0.1 + 0.2, unit: 'kg' })).toBe('0.3 kg');
  });

  it('formats bodyweight, with optional added load', () => {
    expect(formatLoad({ kind: 'bodyweight' })).toBe('Bodyweight');
    expect(formatLoad({ kind: 'bodyweight', plus: { value: 25, unit: 'lb' } })).toBe(
      'Bodyweight + 25 lb',
    );
  });

  it('formats a free-text progression level as written', () => {
    expect(formatLoad({ kind: 'level', label: '  Med ball 6 kg ' })).toBe('Med ball 6 kg');
    expect(formatLoad({ kind: 'level', label: 'Band: red' })).toBe('Band: red');
  });

  it('falls back to a dash for an empty level', () => {
    expect(formatLoad({ kind: 'level', label: '   ' })).toBe('—');
  });
});

describe('formatTarget', () => {
  it('formats a single rep count, singular and plural', () => {
    expect(formatTarget({ kind: 'reps', min: 3 })).toBe('3 reps');
    expect(formatTarget({ kind: 'reps', min: 1 })).toBe('1 rep');
  });

  it('formats a rep range with an en dash', () => {
    expect(formatTarget({ kind: 'reps', min: 8, max: 12 })).toBe('8–12 reps');
  });

  it('collapses a degenerate range to a single count', () => {
    expect(formatTarget({ kind: 'reps', min: 5, max: 5 })).toBe('5 reps');
    expect(formatTarget({ kind: 'reps', min: 6, max: 4 })).toBe('6 reps');
  });

  it('formats an N-rep max', () => {
    expect(formatTarget({ kind: 'repMax', reps: 1 })).toBe('1-rep max');
    expect(formatTarget({ kind: 'repMax', reps: 5 })).toBe('5-rep max');
  });

  it('formats time under tension, with an optional tempo', () => {
    expect(formatTarget({ kind: 'time', seconds: 40 })).toBe('40 s under tension');
    expect(formatTarget({ kind: 'time', seconds: 40, tempo: '3-1-3' })).toBe(
      '40 s under tension, tempo 3-1-3',
    );
  });

  it('formats long holds as m:ss', () => {
    expect(formatTarget({ kind: 'time', seconds: 90 })).toBe('1:30 under tension');
  });

  it('ignores a blank tempo', () => {
    expect(formatTarget({ kind: 'time', seconds: 30, tempo: ' ' })).toBe('30 s under tension');
  });

  it('returns an empty string when there is no target', () => {
    expect(formatTarget({ kind: 'none' })).toBe('');
  });
});

describe('seedTrackedLifts', () => {
  it('starts with Push / Pull / Legs in order', () => {
    expect(seedTrackedLifts().categories).toEqual(['Push', 'Pull', 'Legs']);
  });

  it('seeds the three starter lifts', () => {
    const { lifts } = seedTrackedLifts();
    const summary = lifts.map((l) => [l.category, l.name, formatLoad(l.load), formatTarget(l.target)]);
    expect(summary).toEqual([
      ['Push', 'Bench Press', '265 lb', '1-rep max'],
      ['Pull', 'Seal Row', '160 lb', ''],
      ['Legs', 'Front Squat', '250 lb', '3 reps'],
    ]);
  });

  it('gives every lift a unique id', () => {
    const ids = seedTrackedLifts().lifts.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('groupByCategory', () => {
  it('groups lifts under their category in category order, keeping empty categories', () => {
    const state = seedTrackedLifts();
    const groups = groupByCategory({ ...state, categories: ['Legs', 'Push', 'Pull', 'Core'] });
    expect(groups.map((g) => [g.category, g.lifts.map((l) => l.name)])).toEqual([
      ['Legs', ['Front Squat']],
      ['Push', ['Bench Press']],
      ['Pull', ['Seal Row']],
      ['Core', []],
    ]);
  });

  it('appends lifts whose category is not in the list, rather than hiding them', () => {
    const state = seedTrackedLifts();
    const groups = groupByCategory({ ...state, categories: ['Push'] });
    expect(groups.map((g) => g.category)).toEqual(['Push', 'Pull', 'Legs']);
  });
});

describe('trackedLiftsToWorkout', () => {
  const [bench, row, squat] = seedTrackedLifts().lifts;

  it('turns the starter lifts into weighted builder exercises', () => {
    const { exercises, supersets } = trackedLiftsToWorkout([bench, row, squat]);
    expect(supersets).toEqual([]);
    // 1-rep max: one set of one
    expect(exercises[0]).toEqual({ name: 'Bench Press', sets: [{ reps: 1, weight: 265, unit: 'lbs' }] });
    // no target: working sets at the default reps
    expect(exercises[1].sets).toHaveLength(3);
    expect(exercises[1].sets[0]).toEqual({ reps: 10, weight: 160, unit: 'lbs' });
    // rep count
    expect(exercises[2].sets).toEqual(Array(3).fill({ reps: 3, weight: 250, unit: 'lbs' }));
  });

  it('keeps rep ranges, added bodyweight load, named steps and time targets', () => {
    const { exercises } = trackedLiftsToWorkout([
      { id: 'a', name: 'Pull-up', category: 'Pull', load: { kind: 'bodyweight', plus: { value: 20, unit: 'kg' } }, target: { kind: 'reps', min: 6, max: 8 } },
      { id: 'b', name: 'Chest pass', category: 'Push', load: { kind: 'level', label: 'Med ball 6 kg' }, target: { kind: 'time', seconds: 40, tempo: '3-1-3' } },
    ]);
    expect(exercises[0].sets[0]).toEqual({ reps: { min: 6, max: 8 }, weight: 20, unit: 'kg' });
    expect(exercises[1].sets[0]).toEqual({ reps: 1, time: 40 });
    expect(exercises[1].notes).toBe('Med ball 6 kg; 40 s under tension, tempo 3-1-3');
  });

  it('gives each set its own object so edits stay per set', () => {
    const { sets } = trackedLiftsToWorkout([squat]).exercises[0];
    expect(sets[0]).not.toBe(sets[1]);
  });
});

describe('workoutNameForLifts', () => {
  it('joins the distinct categories in order', () => {
    const [bench, row, squat] = seedTrackedLifts().lifts;
    expect(workoutNameForLifts([bench, squat, { ...bench, id: 'x' }])).toBe('Push + Legs');
    expect(workoutNameForLifts([row])).toBe('Pull');
  });
});
