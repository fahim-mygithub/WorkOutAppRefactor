// The Build edit tools (setBuildName, editBuildExercise, addBuildExercise,
// removeBuildExercise): each plans to an auto edit of the Build draft with an
// Undo that restores the prior text, and refuses what does not fit.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import ai, { buildEditConsumed, planEditConsumed, screenCleared, screenPublished } from '../store/slices/aiSlice';
import { toDateKey } from '../lib/dateKey';
import type { Exercise } from '../types/exercise';
import { planToolCall, type PlanContext, type ToolPlan } from './applyTool';
import { planEditorScreen, toPlanDraftExercises } from './planDraft';
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

function setupPlan(name = 'Upper Push') {
  const today = toDateKey(new Date());
  const store = configureStore({ reducer: { ai } });
  const initialExercises = toPlanDraftExercises(
    [
      {
        id: 'pe-bench',
        exercise: library[0],
        sets: [
          { id: 's1', reps: 8, weight: 135, unit: 'lbs', completed: false },
          { id: 's2', reps: 8, weight: 135, unit: 'lbs', completed: false },
          { id: 's3', reps: 8, weight: 135, unit: 'lbs', completed: false },
        ],
        restTime: 120,
      },
      {
        id: 'pe-pull',
        exercise: library[2],
        sets: [
          { id: 's4', reps: 10, unit: 'lbs', completed: false },
          { id: 's5', reps: 10, unit: 'lbs', completed: false },
          { id: 's6', reps: 10, unit: 'lbs', completed: false },
          { id: 's7', reps: 10, unit: 'lbs', completed: false },
        ],
        restTime: 90,
      },
    ],
    'lbs',
  );
  store.dispatch(screenPublished(planEditorScreen({ planId: 'plan-1', date: today, name, exercises: initialExercises })));
  const ctx = (): PlanContext => ({
    activeWorkout: null,
    trackedLifts: [],
    library,
    units: 'lbs',
    planDraft: store.getState().ai.planDraft,
  });
  const plan = (callName: AiToolCall['name'], input: Record<string, unknown>, id = 'c1') =>
    planToolCall({ id, name: callName, input }, ctx());
  const auto = (p: ToolPlan) => {
    if (p.kind !== 'auto') throw new Error(p.kind === 'rejected' ? p.reason : p.kind);
    return p;
  };
  const settle = () => {
    const edit = store.getState().ai.planEdit;
    if (edit) store.dispatch(planEditConsumed(edit.id));
    return store.getState().ai.planDraft;
  };
  return { store, ctx, plan, auto, settle, initialExercises };
}

describe('editPlanExercise', () => {
  it('plans an auto edit of one exercise and leaves the rest of the plan draft alone', () => {
    const { store, plan, auto, settle } = setupPlan();
    const p = auto(plan('editPlanExercise', { exerciseName: 'Bench Press', sets: 5, reps: 5, weight: 155, unit: 'lbs' }));
    expect(p.summary).toContain('Barbell Bench Press');
    p.apply.forEach((a) => store.dispatch(a));
    const draft = settle()!;
    expect(draft.exercises[0]).toMatchObject({ setsCount: '5', reps: '5', weight: '155', unit: 'lbs' });
    expect(draft.exercises[1]).toMatchObject({ setsCount: '4', reps: '10', weight: '', unit: 'lbs' });
  });

  it('Undo restores the prior exercise draft values', () => {
    const { store, plan, auto, settle, initialExercises } = setupPlan();
    const p = auto(plan('editPlanExercise', { exerciseName: 'Pull Ups', sets: 3, reps: 12, weight: 25, unit: 'kg' }));
    p.apply.forEach((a) => store.dispatch(a));
    expect(settle()?.exercises[1]).toMatchObject({ setsCount: '3', reps: '12', weight: '25', unit: 'kg' });
    p.undo.forEach((a) => store.dispatch(a));
    expect(settle()?.exercises).toEqual(initialExercises);
  });

  it('clears weight when weight is 0', () => {
    const { store, plan, auto, settle } = setupPlan();
    const p = auto(plan('editPlanExercise', { exerciseName: 'Barbell Bench Press', weight: 0 }));
    p.apply.forEach((a) => store.dispatch(a));
    expect(settle()?.exercises[0].weight).toBe('');
  });

  it('rejects an unknown exercise, out-of-range values, and a no-op', () => {
    const { plan } = setupPlan();
    expect(reason(plan('editPlanExercise', { exerciseName: 'Deadlift', sets: 3 }))).toContain('"Deadlift"');
    expect(reason(plan('editPlanExercise', { exerciseName: 'Pull Ups', sets: 11 }))).toBe('Sets must be 1–10.');
    expect(reason(plan('editPlanExercise', { exerciseName: 'Pull Ups', reps: 101 }))).toBe('Reps must be 1–100.');
    expect(reason(plan('editPlanExercise', { exerciseName: 'Pull Ups', weight: -5 }))).toBe('Load must be zero or more.');
    expect(reason(plan('editPlanExercise', { exerciseName: 'Pull Ups', weight: 2_001 }))).toBe('That load is not realistic.');
    expect(reason(plan('editPlanExercise', { exerciseName: 'Pull Ups', unit: 'stone' }))).toBe('Unit must be lbs or kg.');
    expect(reason(plan('editPlanExercise', { exerciseName: 'Barbell Bench Press', sets: 3 }))).toBe('Barbell Bench Press is already like that.');
    expect(reason(plan('editPlanExercise', { sets: 3 }))).toBe('No exercise was named.');
    expect(reason(plan('editPlanExercise', { exerciseName: 'Pull Ups' }))).toBe('Nothing to change.');
  });

  it('refuses when the plan editor sheet is not open, saying open the plan first', () => {
    const { store, plan } = setupPlan();
    store.dispatch(screenCleared('plan-edit'));
    expect(store.getState().ai.planDraft).toBeUndefined();
    expect(reason(plan('editPlanExercise', { exerciseName: 'Pull Ups', sets: 3 }))).toContain('open the plan first');
    expect(reason(plan('setPlanName', { name: 'Pull' }))).toContain('open the plan first');
    expect(reason(plan('addPlanExercise', { exerciseName: 'Dumbbell Curl' }))).toContain('open the plan first');
    expect(reason(plan('removePlanExercise', { exerciseName: 'Pull Ups' }))).toContain('open the plan first');
  });

  it('chains multiple plan edits in the same turn before the sheet consumes them', () => {
    const { store, plan, auto, settle } = setupPlan();
    auto(plan('editPlanExercise', { exerciseName: 'Pull Ups', sets: 5 }, 'a')).apply.forEach((a) => store.dispatch(a));
    auto(plan('editPlanExercise', { exerciseName: 'Bench Press', weight: 145 }, 'b')).apply.forEach((a) => store.dispatch(a));
    const draft = settle()!;
    expect(draft.exercises[0].weight).toBe('145');
    expect(draft.exercises[1].setsCount).toBe('5');
  });
});

describe('addPlanExercise / removePlanExercise / setPlanName', () => {
  it('adds a library exercise by matching name (3x10 default) and Undo removes it', () => {
    const { store, plan, auto, settle, initialExercises } = setupPlan();
    const p = auto(plan('addPlanExercise', { exerciseName: 'Bent Over Row', sets: 4, reps: 8, weight: 95 }));
    expect(p.summary).toContain('Barbell Bent Over Row');
    p.apply.forEach((a) => store.dispatch(a));
    const draft = settle()!;
    expect(draft.exercises).toHaveLength(3);
    expect(draft.exercises[2]).toMatchObject({
      setsCount: '4',
      reps: '8',
      weight: '95',
      unit: 'lbs',
    });
    expect(draft.exercises[2].base.exercise.name).toBe('Barbell Bent Over Row');

    p.undo.forEach((a) => store.dispatch(a));
    expect(settle()?.exercises).toEqual(initialExercises);
  });

  it('rejects adding an unknown library exercise or one already in the plan', () => {
    const { plan } = setupPlan();
    expect(reason(plan('addPlanExercise', { exerciseName: 'Zercher Quagmire' }))).toBe('"Zercher Quagmire" is not in the exercise library.');
    expect(reason(plan('addPlanExercise', { exerciseName: 'Pull Ups' }))).toContain('already in');
  });

  it('removes one exercise and Undo restores it', () => {
    const { store, plan, auto, settle, initialExercises } = setupPlan();
    const p = auto(plan('removePlanExercise', { exerciseName: 'pull ups' }));
    expect(p.summary).toBe('Removed Pull Ups from plan');
    p.apply.forEach((a) => store.dispatch(a));
    expect(settle()?.exercises.map((e) => e.base.exercise.name)).toEqual(['Barbell Bench Press']);
    p.undo.forEach((a) => store.dispatch(a));
    expect(settle()?.exercises).toEqual(initialExercises);
  });

  it('rejects removing an exercise not in the plan', () => {
    const { plan } = setupPlan();
    expect(reason(plan('removePlanExercise', { exerciseName: 'Deadlift' }))).toContain('"Deadlift"');
  });

  it('renames the plan draft and Undo restores the old name', () => {
    const { store, plan, auto, settle } = setupPlan('Upper Push');
    const p = auto(plan('setPlanName', { name: 'Heavy Upper' }));
    expect(p.summary).toContain('Heavy Upper');
    p.apply.forEach((a) => store.dispatch(a));
    expect(settle()?.name).toBe('Heavy Upper');
    p.undo.forEach((a) => store.dispatch(a));
    expect(settle()?.name).toBe('Upper Push');
  });

  it('rejects empty, overlong, or unchanged plan names', () => {
    const { plan } = setupPlan('Upper Push');
    expect(reason(plan('setPlanName', { name: '   ' }))).toBe('That name is not valid.');
    expect(reason(plan('setPlanName', { name: 'x'.repeat(81) }))).toBe('That name is not valid.');
    expect(reason(plan('setPlanName', { name: 'Upper Push' }))).toBe('The workout is already named "Upper Push".');
  });
});
