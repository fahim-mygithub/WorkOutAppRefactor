import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addDraftExercise, draftTextForAi, DRAFT_TEXT_CAP, editDraftExercise, readDraft, removeDraftExercise } from './buildDraft';

const text = ['3x8 Barbell Bench Press @135lbs', '4x10-12 Pull Ups', '3x12 Dumbbell Curl @30lbs ss 3x12 Dumbbell Overhead Tricep Extension @25lbs'].join('\n');

beforeEach(() => {
  // The parser logs every parse.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('readDraft', () => {
  it('lists each exercise with sets, reps and load, in line order', () => {
    const { exercises, issues } = readDraft(text);
    expect(exercises).toEqual([
      { name: 'Barbell Bench Press', sets: 3, reps: '8', weight: 135, unit: 'lbs' },
      { name: 'Pull Ups', sets: 4, reps: '10-12' },
      { name: 'Dumbbell Curl', sets: 3, reps: '12', weight: 30, unit: 'lbs', superset: true },
      { name: 'Dumbbell Overhead Tricep Extension', sets: 3, reps: '12', weight: 25, unit: 'lbs', superset: true },
    ]);
    expect(issues).toEqual([]);
  });

  it('reports a line that is only a name, and reads nothing from empty text', () => {
    expect(readDraft('Face Pulls').issues).toEqual(['"Face Pulls" has no sets x reps; read as 10 reps']);
    expect(readDraft('  \n ')).toEqual({ exercises: [], issues: [] });
  });

  it('shows the assistant at most the first 2,000 characters of the text', () => {
    expect(draftTextForAi('a'.repeat(5_000))).toHaveLength(DRAFT_TEXT_CAP);
    expect(draftTextForAi('3x8 Squat')).toBe('3x8 Squat');
  });
});

describe('editDraftExercise', () => {
  it('rewrites only the named exercise line', () => {
    const r = editDraftExercise(text, 'Barbell Bench Press', { sets: 4, weight: 145 });
    expect(r).toEqual({
      ok: true, name: 'Barbell Bench Press', line: '4x8 Barbell Bench Press @145lbs',
      text: text.replace('3x8 Barbell Bench Press @135lbs', '4x8 Barbell Bench Press @145lbs'),
    });
  });

  it('sets a rep range, changes the unit, and can clear the load', () => {
    const range = editDraftExercise(text, 'Barbell Bench Press', { reps: 6, repsMax: 10, unit: 'kg' });
    expect(range.ok && range.text.split('\n')[0]).toBe('3x6-10 Barbell Bench Press @135kg');
    const cleared = editDraftExercise(text, 'Barbell Bench Press', { weight: 0 });
    expect(cleared.ok && cleared.text.split('\n')[0]).toBe('3x8 Barbell Bench Press');
  });

  it('adds a first load in the unit the lifter uses', () => {
    const r = editDraftExercise(text, 'Pull Ups', { weight: 25 }, { defaultUnit: 'kg' });
    expect(r.ok && r.text.split('\n')[1]).toBe('4x10-12 Pull Ups @25kg');
  });

  it('finds an exercise by its words or by a library match, but not an unknown or an ambiguous one', () => {
    expect(editDraftExercise(text, 'bench press', { sets: 5 }).ok).toBe(true);
    expect(editDraftExercise(text, 'Bench', { sets: 5 }).ok).toBe(true); // one word that only one line has
    const same = (a: string, b: string) => a === 'Pull Ups' && b === 'Pullup';
    expect(editDraftExercise(text, 'Pullup', { sets: 5 }, { same }).ok).toBe(true);
    expect(editDraftExercise(text, 'Deadlift', { sets: 5 })).toEqual({ ok: false, reason: '"Deadlift" is not in the Build draft.' });
    const two = '3x8 Dumbbell Curl\n3x8 Barbell Curl';
    expect(editDraftExercise(two, 'Curl', { sets: 4 })).toEqual({ ok: false, reason: '"Curl" matches more than one exercise in the Build draft.' });
  });

  it('refuses a superset member and a change that changes nothing', () => {
    expect(editDraftExercise(text, 'Dumbbell Curl', { sets: 4 })).toEqual({
      ok: false, reason: '"Dumbbell Curl" is in a superset line; change it in the Visual tab.',
    });
    expect(editDraftExercise(text, 'Barbell Bench Press', { sets: 3, reps: 8, weight: 135 })).toEqual({
      ok: false, reason: 'Barbell Bench Press is already like that.',
    });
  });
});

describe('addDraftExercise / removeDraftExercise', () => {
  it('appends a line with 3x10 by default, after a text that lacks a final newline', () => {
    expect(addDraftExercise('3x8 Squat', 'Barbell Bent Over Row', {})).toEqual({
      ok: true, name: 'Barbell Bent Over Row', line: '3x10 Barbell Bent Over Row', text: '3x8 Squat\n3x10 Barbell Bent Over Row',
    });
    expect(addDraftExercise('3x8 Squat\n\n', 'Row', { sets: 4, reps: 8, weight: 95, unit: 'kg' })).toEqual({
      ok: true, name: 'Row', line: '4x8 Row @95kg', text: '3x8 Squat\n4x8 Row @95kg',
    });
    expect(addDraftExercise('', 'Row', {})).toEqual({ ok: true, name: 'Row', line: '3x10 Row', text: '3x10 Row' });
  });

  it('refuses an exercise already in the draft', () => {
    expect(addDraftExercise(text, 'Pull Ups', {})).toEqual({ ok: false, reason: 'Pull Ups is already in the Build draft; change it instead.' });
  });

  it('removes one line and leaves the others alone', () => {
    expect(removeDraftExercise(text, 'Pull Ups')).toEqual({ ok: true, name: 'Pull Ups', line: '4x10-12 Pull Ups', text: text.split('\n').filter((l) => !l.includes('Pull Ups')).join('\n') });
    expect(removeDraftExercise(text, 'Deadlift').ok).toBe(false);
    expect(removeDraftExercise(text, 'Dumbbell Curl').ok).toBe(false);
  });
});
