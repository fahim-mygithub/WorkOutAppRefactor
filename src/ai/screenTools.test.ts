// The Build edit tools (setBuildName, editBuildExercise, addBuildExercise,
// removeBuildExercise): each plans to an auto edit of the Build draft with an
// Undo that restores the prior text, and refuses what does not fit.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import ai, { buildEditConsumed, screenCleared, screenPublished } from '../store/slices/aiSlice';
import type { Exercise } from '../types/exercise';
import { planToolCall, type PlanContext, type ToolPlan } from './applyTool';
import type { AiToolCall } from './types';

const library = [
  { id: 'x-bench', name: 'Barbell Bench Press', equipment: 'Barbell', muscleGroups: ['Chest'] },
  { id: 'x-row', name: 'Barbell Bent Over Row', equipment: 'Barbell', muscleGroups: ['Back'] },
  { id: 'x-pull', name: 'Pull Ups', equipment: 'Bodyweight', muscleGroups: ['Back'] },
  { id: 'x-curl', name: 'Dumbbell Curl', equipment: 'Dumbbells', muscleGroups: ['Biceps'] },
] as Exercise[];

const TEXT = ['3x8 Barbell Bench Press @135lbs', '4x10-12 Pull Ups', '3x12 Cable Fly ss 3x12 Face Pull'].join('\n');

function setup(text = TEXT, name = 'Push') {
  const store = configureStore({ reducer: { ai } });
  store.dispatch(screenPublished({ tab: 'build', title: 'Build workout', summary: 'x', draft: { name, text } }));
  const ctx = (): PlanContext => ({
    activeWorkout: null, trackedLifts: [], library, units: 'lbs', buildDraft: store.getState().ai.buildDraft,
  });
  const plan = (callName: AiToolCall['name'], input: Record<string, unknown>, id = 'c1') =>
    planToolCall({ id, name: callName, input }, ctx());
  const auto = (p: ToolPlan) => {
    if (p.kind !== 'auto') throw new Error(p.kind === 'rejected' ? p.reason : p.kind);
    return p;
  };
  /** The draft after the page has consumed the pending edit, as the page would. */
  const settle = () => {
    const edit = store.getState().ai.buildEdit;
    if (edit) store.dispatch(buildEditConsumed(edit.id));
    return store.getState().ai.buildDraft;
  };
  return { store, ctx, plan, auto, settle };
}

const reason = (p: ToolPlan) => (p.kind === 'rejected' ? p.reason : `not rejected: ${p.kind}`);

beforeEach(() => {
  // The parser logs every parse.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('editBuildExercise', () => {
  it('plans an auto edit of one line and leaves the rest of the draft', () => {
    const { store, plan, auto, settle } = setup();
    const p = auto(plan('editBuildExercise', { exerciseName: 'Bench Press', sets: 5, weight: 145 }));
    expect(p.summary).toBe('Changed Barbell Bench Press on Build to 5x8 Barbell Bench Press @145lbs');
    p.apply.forEach((a) => store.dispatch(a));
    expect(settle()?.text).toBe(TEXT.replace('3x8 Barbell Bench Press @135lbs', '5x8 Barbell Bench Press @145lbs'));
  });

  it('Undo restores the prior text', () => {
    const { store, plan, auto, settle } = setup();
    const p = auto(plan('editBuildExercise', { exerciseName: 'Pull Ups', reps: 6, repsMax: 8 }));
    p.apply.forEach((a) => store.dispatch(a));
    expect(settle()?.text).toContain('4x6-8 Pull Ups');
    p.undo.forEach((a) => store.dispatch(a));
    expect(settle()?.text).toBe(TEXT);
  });

  it('rejects an exercise that is not in the draft', () => {
    const { plan } = setup();
    expect(reason(plan('editBuildExercise', { exerciseName: 'Deadlift', sets: 3 }))).toBe('"Deadlift" is not in the Build draft.');
  });

  it('rejects numbers out of range, a load the engine refuses, and a no-op', () => {
    const { plan } = setup();
    expect(reason(plan('editBuildExercise', { exerciseName: 'Pull Ups', sets: 11 }))).toBe('Sets must be 1–10.');
    expect(reason(plan('editBuildExercise', { exerciseName: 'Pull Ups', reps: 101 }))).toBe('Reps must be 1–100.');
    expect(reason(plan('editBuildExercise', { exerciseName: 'Pull Ups', reps: 8, repsMax: 8 }))).toBe('The top of a rep range must be above reps.');
    expect(reason(plan('editBuildExercise', { exerciseName: 'Pull Ups', weight: -5 }))).toBe('Load must be zero or more.');
    expect(reason(plan('editBuildExercise', { exerciseName: 'Pull Ups', unit: 'stone' }))).toBe('Unit must be lbs or kg.');
    expect(reason(plan('editBuildExercise', { exerciseName: 'Barbell Bench Press', sets: 3 }))).toBe('Barbell Bench Press is already like that.');
    expect(reason(plan('editBuildExercise', { sets: 3 }))).toBe('No exercise was named.');
  });

  it('refuses an exercise inside a superset line, saying where to change it', () => {
    const { plan } = setup();
    expect(reason(plan('editBuildExercise', { exerciseName: 'Cable Fly', sets: 4 }))).toBe(
      '"Cable Fly" is in a superset line; change it in the Visual tab.',
    );
  });

  it('refuses when the Build screen is not open', () => {
    const { store, plan } = setup();
    store.dispatch(screenCleared('build'));
    expect(store.getState().ai.buildDraft).toBeUndefined();
    expect(reason(plan('editBuildExercise', { exerciseName: 'Pull Ups', sets: 3 }))).toBe(
      'The Build screen is not open, so there is no draft to edit. Open Build first.',
    );
  });

  it('a second edit in the same turn plans against the first one result', () => {
    const { store, plan, auto, settle } = setup();
    auto(plan('editBuildExercise', { exerciseName: 'Pull Ups', sets: 5 }, 'a')).apply.forEach((a) => store.dispatch(a));
    // The page has not consumed the first edit yet.
    auto(plan('editBuildExercise', { exerciseName: 'Barbell Bench Press', sets: 4 }, 'b')).apply.forEach((a) => store.dispatch(a));
    const text = settle()?.text ?? '';
    expect(text).toContain('5x10-12 Pull Ups');
    expect(text).toContain('4x8 Barbell Bench Press @135lbs');
  });
});

describe('addBuildExercise / removeBuildExercise', () => {
  it('adds a library exercise under its library name, 3x10 unless told', () => {
    const { store, plan, auto, settle } = setup();
    const p = auto(plan('addBuildExercise', { exerciseName: 'Bent Over Row', sets: 4, reps: 8, weight: 95 }));
    expect(p.summary).toBe('Added 4x8 Barbell Bent Over Row @95lbs to Build');
    p.apply.forEach((a) => store.dispatch(a));
    expect(settle()?.text).toBe(`${TEXT}\n4x8 Barbell Bent Over Row @95lbs`);
  });

  it('an add is taken back by Undo', () => {
    const { store, plan, auto, settle } = setup();
    const p = auto(plan('addBuildExercise', { exerciseName: 'Dumbbell Curl' }));
    p.apply.forEach((a) => store.dispatch(a));
    p.undo.forEach((a) => store.dispatch(a));
    expect(settle()?.text).toBe(TEXT);
  });

  it('rejects an exercise that is not in the library, and one already in the draft', () => {
    const { plan } = setup();
    expect(reason(plan('addBuildExercise', { exerciseName: 'Zercher Quagmire' }))).toBe('"Zercher Quagmire" is not in the exercise library.');
    expect(reason(plan('addBuildExercise', { exerciseName: 'Pull Ups' }))).toBe('Pull Ups is already in the Build draft; change it instead.');
  });

  it('rejects a load that cannot be real', () => {
    const { plan } = setup();
    expect(reason(plan('addBuildExercise', { exerciseName: 'Bent Over Row', weight: 99_999 }))).toBe('That load is not realistic.');
    expect(reason(plan('editBuildExercise', { exerciseName: 'Pull Ups', weight: 2_001 }))).toBe('That load is not realistic.');
  });

  it('removes one exercise line; Undo puts it back', () => {
    const { store, plan, auto, settle } = setup();
    const p = auto(plan('removeBuildExercise', { exerciseName: 'pull ups' }));
    expect(p.summary).toBe('Removed Pull Ups from Build');
    p.apply.forEach((a) => store.dispatch(a));
    expect(settle()?.text).toBe(['3x8 Barbell Bench Press @135lbs', '3x12 Cable Fly ss 3x12 Face Pull'].join('\n'));
    p.undo.forEach((a) => store.dispatch(a));
    expect(settle()?.text).toBe(TEXT);
  });

  it('rejects removing what is not there', () => {
    const { plan } = setup();
    expect(reason(plan('removeBuildExercise', { exerciseName: 'Deadlift' }))).toBe('"Deadlift" is not in the Build draft.');
  });
});

describe('setBuildName', () => {
  it('renames the workout and Undo restores the old name', () => {
    const { store, plan, auto, settle } = setup();
    const p = auto(plan('setBuildName', { name: 'Pull day' }));
    expect(p.summary).toBe('Named the workout "Pull day"');
    p.apply.forEach((a) => store.dispatch(a));
    expect(settle()?.name).toBe('Pull day');
    p.undo.forEach((a) => store.dispatch(a));
    expect(settle()?.name).toBe('Push');
  });

  it('rejects an empty name, the same name, and a name past 80 characters', () => {
    const { plan } = setup();
    expect(reason(plan('setBuildName', { name: '  ' }))).toBe('That name is not valid.');
    expect(reason(plan('setBuildName', { name: 'x'.repeat(81) }))).toBe('That name is not valid.');
    expect(reason(plan('setBuildName', { name: 'Push' }))).toBe('The workout is already named "Push".');
  });

  it('an edit pending for the page wins over the page older publish', () => {
    const { store, plan, auto } = setup();
    auto(plan('setBuildName', { name: 'Pull day' })).apply.forEach((a) => store.dispatch(a));
    // The page publishes its state before it has consumed the edit.
    store.dispatch(screenPublished({ tab: 'build', title: 'Build workout', summary: 'x', draft: { name: 'Push', text: TEXT } }));
    expect(store.getState().ai.buildDraft?.name).toBe('Pull day');
  });
});
