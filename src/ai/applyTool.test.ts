import { describe, it, expect } from 'vitest';
import type { UnknownAction } from '@reduxjs/toolkit';
import { planToolCall, type PlanContext, type ToolPlan } from './applyTool';
import reducer, { startWorkout, completeSet, type WorkoutState } from '../store/slices/workoutSlice';
import type { ActiveWorkout, WorkoutExercise } from '../types/exercise';

const workout = {
  id: 'w', name: 'Push', currentExerciseIndex: 0, currentSetIndex: 2,
  exercises: [{
    id: 'e1', restTime: 180,
    exercise: { id: 'x-bench', name: 'Barbell Bench Press' },
    tracked: { liftId: 'l-bench', goal: 'strength' },
    sets: [
      { id: 's1', reps: 3, weight: 225, unit: 'lbs', completed: true },
      { id: 's2', reps: 2, weight: 225, unit: 'lbs', completed: true },
      { id: 's3', reps: 3, weight: 225, unit: 'lbs', completed: false },
      { id: 's4', reps: 3, weight: 225, unit: 'lbs', completed: false },
    ],
  }],
} as unknown as ActiveWorkout;

const ctx: PlanContext = {
  activeWorkout: workout,
  trackedLifts: [{ id: 'l-bench', name: 'Bench Press', category: 'Push', load: { kind: 'weight', value: 265, unit: 'lb' }, target: { kind: 'repMax', reps: 1 } }],
  library: [{ id: 'x-db', name: 'Dumbbell Bench Press' }] as never,
};

// --- run plans through the real workout reducer ---------------------------------

const startState = (exercises: WorkoutExercise[] = workout.exercises): WorkoutState =>
  reducer(undefined, startWorkout({ name: 'Push', exercises }));
const run = (state: WorkoutState, actions: UnknownAction[]): WorkoutState => actions.reduce(reducer, state);
const setsIn = (state: WorkoutState) => state.activeWorkout!.exercises[0].sets;
const weights = (state: WorkoutState) => setsIn(state).map((s) => s.weight);
const ctxFor = (state: WorkoutState, base: PlanContext = ctx): PlanContext => ({ ...base, activeWorkout: state.activeWorkout });
const auto = (plan: ToolPlan) => {
  if (plan.kind !== 'auto') throw new Error(plan.kind === 'rejected' ? plan.reason : plan.kind);
  return plan;
};
const confirm = (plan: ToolPlan) => {
  if (plan.kind !== 'confirm') throw new Error(plan.kind === 'rejected' ? plan.reason : plan.kind);
  return plan;
};

describe('planToolCall', () => {
  it('adjustSet applies at once, snapped, with undo', () => {
    const s0 = startState();
    const plan = auto(planToolCall({ id: 't1', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 2, weight: 207, reason: 'missed' } }, ctxFor(s0)));
    const s1 = run(s0, plan.apply);
    expect(weights(s1)).toEqual([225, 225, 205, 205]);
    expect(setsIn(run(s1, plan.undo))).toEqual(setsIn(s0));
  });

  it('adjustSet out of range is rejected', () => {
    const plan = planToolCall({ id: 't2', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 2, weight: 120, reason: 'x' } }, ctx);
    expect(plan.kind).toBe('rejected');
  });

  it('never rewrites completed sets', () => {
    const s0 = startState();
    const plan = auto(planToolCall({ id: 't3', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 0, weight: 215, reason: 'x' } }, ctxFor(s0)));
    expect(weights(run(s0, plan.apply))).toEqual([225, 225, 215, 215]);
  });

  it('updateBenchmark needs confirmation', () => {
    const plan = planToolCall({ id: 't4', name: 'updateBenchmark', input: {
      liftId: 'l-bench', loadKind: 'weight', weight: 255, unit: 'lb', targetKind: 'repMax', reps: 1, reason: 'three misses',
    } }, ctx);
    expect(plan.kind).toBe('confirm');
    if (plan.kind === 'confirm') expect(plan.summary).toMatch(/Bench Press.*255 lb/);
  });

  it('swapExercise resolves the library name', () => {
    const plan = planToolCall({ id: 't5', name: 'swapExercise', input: {
      exerciseId: 'e1', replacementExerciseName: 'dumbbell bench press', scope: 'today', reason: 'shoulder',
    } }, ctx);
    expect(plan.kind).toBe('confirm');
  });

  it('rejects unknown ids and names', () => {
    expect(planToolCall({ id: 't6', name: 'adjustSet', input: { exerciseId: 'nope', fromSetIndex: 0, weight: 100, reason: 'x' } }, ctx).kind).toBe('rejected');
    expect(planToolCall({ id: 't7', name: 'swapExercise', input: { exerciseId: 'e1', replacementExerciseName: 'Moon Press', scope: 'today', reason: 'x' } }, ctx).kind).toBe('rejected');
  });

  // --- stale state: apply/undo touch only what they changed --------------------

  it('adjustSet undo after logging another set keeps the newly logged set', () => {
    const s0 = startState();
    const plan = auto(planToolCall({ id: 'st1', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 2, weight: 205, reason: 'x' } }, ctxFor(s0)));
    const s1 = run(s0, plan.apply);
    // The lifter logs set 3 at the adjusted load, then taps Undo.
    const s2 = reducer(s1, completeSet({ exerciseIndex: 0, setIndex: 2, setData: { reps: 3, weight: 205 } }));
    const s3 = run(s2, plan.undo);
    expect(setsIn(s3)[2]).toMatchObject({ id: 's3', reps: 3, weight: 205, completed: true });
    expect(setsIn(s3)[3]).toMatchObject({ id: 's4', weight: 225, completed: false });
  });

  it('logSet undo after logging another set keeps the newer set', () => {
    const s0 = startState();
    const plan = auto(planToolCall({ id: 'st2', name: 'logSet', input: { exerciseId: 'e1', reps: 3, weight: 225 } }, ctxFor(s0)));
    const s1 = run(s0, plan.apply);
    const s2 = reducer(s1, completeSet({ exerciseIndex: 0, setIndex: 3, setData: { reps: 3, weight: 225 } }));
    const s3 = run(s2, plan.undo);
    expect(setsIn(s3)[2]).toEqual(setsIn(s0)[2]);
    expect(setsIn(s3)[3]).toMatchObject({ id: 's4', completed: true });
  });

  it('a late swap Apply does not un-log a set completed after planning', () => {
    const s0 = startState();
    const plan = confirm(planToolCall({ id: 'st3', name: 'swapExercise', input: {
      exerciseId: 'e1', replacementExerciseName: 'Dumbbell Bench Press', scope: 'today', weight: 80, reason: 'x',
    } }, ctxFor(s0)));
    const s1 = reducer(s0, completeSet({ exerciseIndex: 0, setIndex: 2, setData: { reps: 3, weight: 225 } }));
    const s2 = run(s1, plan.apply);
    expect(setsIn(s2)[2]).toMatchObject({ id: 's3', weight: 225, completed: true });
    expect(setsIn(s2)[3]).toMatchObject({ id: 's4', weight: 80, completed: false });
    expect(s2.activeWorkout!.exercises[0].exercise.name).toBe('Dumbbell Bench Press');
  });

  // --- adjustSet -----------------------------------------------------------------

  it('adjustSet with neither weight nor reps is rejected', () => {
    const plan = planToolCall({ id: 'a1', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 2, reason: 'x' } }, ctx);
    expect(plan).toEqual({ kind: 'rejected', id: 'a1', reason: 'Nothing to change.' });
  });

  it('adjustSet with no open set at or after fromSetIndex is rejected', () => {
    expect(planToolCall({ id: 'a2', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 9, reps: 2, reason: 'x' } }, ctx).kind).toBe('rejected');
  });

  it('adjustSet reps-only clears the rep range, summarises, and undo restores it', () => {
    const ranged = workout.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, repMin: 3, repMax: 5 })) }));
    const s0 = startState(ranged);
    const plan = auto(planToolCall({ id: 'a3', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 2, reps: 2, reason: 'x' } }, ctxFor(s0)));
    const s1 = run(s0, plan.apply);
    expect(setsIn(s1).map((s) => s.reps)).toEqual([3, 2, 2, 2]);
    expect('repMin' in setsIn(s1)[2]).toBe(false);
    expect(plan.summary).toBe('Barbell Bench Press: remaining sets at 2 reps');
    expect(setsIn(run(s1, plan.undo))).toEqual(setsIn(s0));
  });

  it("summaries say 'lb' for a workout in 'lbs', and 'kg' for kg", () => {
    const lb = auto(planToolCall({ id: 'u1', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 2, weight: 215, reps: 3, reason: 'x' } }, ctx));
    expect(lb.summary).toBe('Barbell Bench Press: remaining sets at 215 lb × 3 reps');

    const kgExercises = [{ ...workout.exercises[0], tracked: undefined, sets: workout.exercises[0].sets.map((s) => ({ ...s, weight: 100, unit: 'kg' as const })) }];
    const s0 = startState(kgExercises);
    const kg = auto(planToolCall({ id: 'u2', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 2, weight: 97, reason: 'x' } }, ctxFor(s0)));
    // 97 kg snaps to the 2.5 kg default step.
    expect(weights(run(s0, kg.apply))).toEqual([100, 100, 97.5, 97.5]);
    expect(kg.summary).toMatch(/97\.5 kg/);
  });

  it('uses the tracked lift step when its unit matches the workout', () => {
    const stepped = { ...ctx, trackedLifts: [{ ...ctx.trackedLifts[0], step: 2.5 }] };
    const s0 = startState();
    const plan = auto(planToolCall({ id: 'st', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 2, weight: 218, reason: 'x' } }, ctxFor(s0, stepped)));
    expect(weights(run(s0, plan.apply))[2]).toBe(217.5);
  });

  // --- logSet ----------------------------------------------------------------------

  it('logSet completes the current set with undo', () => {
    const s0 = startState();
    const plan = auto(planToolCall({ id: 'l1', name: 'logSet', input: { exerciseId: 'e1', reps: 3, weight: 225, rir: 0 } }, ctxFor(s0)));
    const s1 = run(s0, plan.apply);
    expect(setsIn(s1)[2]).toMatchObject({ reps: 3, weight: 225, rir: 0, completed: true, failed: false });
    expect(setsIn(s1)[3].completed).toBe(false);
    expect(plan.summary).toBe('Logged set 3: 3 reps at 225 lb');
    expect(setsIn(run(s1, plan.undo))).toEqual(setsIn(s0));
  });

  it('logSet marks failed below the prescribed floor, like completeSet', () => {
    const ranged = workout.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, reps: 8, repMin: 8, repMax: 12 })) }));
    const s0 = startState(ranged);
    const missed = auto(planToolCall({ id: 'f1', name: 'logSet', input: { exerciseId: 'e1', reps: 6 } }, ctxFor(s0)));
    expect(setsIn(run(s0, missed.apply))[2]).toMatchObject({ reps: 6, completed: true, failed: true });
    const made = auto(planToolCall({ id: 'f2', name: 'logSet', input: { exerciseId: 'e1', reps: 8 } }, ctxFor(s0)));
    expect(setsIn(run(s0, made.apply))[2]).toMatchObject({ reps: 8, failed: false });
  });

  it('logSet on a completed set is a correction', () => {
    const plan = auto(planToolCall({ id: 'l3', name: 'logSet', input: { exerciseId: 'e1', setIndex: 1, reps: 3 } }, ctx));
    expect(plan.summary).toBe('Corrected set 2: 3 reps');
  });

  it('logSet rejects a set index that does not exist', () => {
    expect(planToolCall({ id: 'l2', name: 'logSet', input: { exerciseId: 'e1', setIndex: 7, reps: 2 } }, ctx).kind).toBe('rejected');
  });

  it('logSet rejects rir outside 0–5', () => {
    expect(planToolCall({ id: 'l4', name: 'logSet', input: { exerciseId: 'e1', reps: 3, rir: 6 } }, ctx).kind).toBe('rejected');
    expect(planToolCall({ id: 'l5', name: 'logSet', input: { exerciseId: 'e1', reps: 3, rir: -1 } }, ctx).kind).toBe('rejected');
  });

  // --- tracked lifts ------------------------------------------------------------------

  it('updateBenchmark with incomplete flat fields is rejected', () => {
    expect(planToolCall({ id: 'b1', name: 'updateBenchmark', input: {
      liftId: 'l-bench', loadKind: 'weight', unit: 'lb', targetKind: 'repMax', reps: 1, reason: 'x',
    } }, ctx).kind).toBe('rejected');
    expect(planToolCall({ id: 'b2', name: 'updateBenchmark', input: {
      liftId: 'l-bench', loadKind: 'weight', weight: 255, targetKind: 'reps', reason: 'x',
    } }, ctx).kind).toBe('rejected');
  });

  it('updateBenchmark keeps the lift unit when the AI omits it', () => {
    const kgLift = { ...ctx, trackedLifts: [{ ...ctx.trackedLifts[0], load: { kind: 'weight' as const, value: 120, unit: 'kg' as const } }] };
    const plan = confirm(planToolCall({ id: 'b3', name: 'updateBenchmark', input: {
      liftId: 'l-bench', loadKind: 'weight', weight: 115, targetKind: 'repMax', reps: 1, reason: 'x',
    } }, kgLift));
    expect(plan.apply[0].payload).toMatchObject({ id: 'l-bench', load: { kind: 'weight', value: 115, unit: 'kg' } });
  });

  it('addTrackedLift with incomplete flat fields is rejected', () => {
    expect(planToolCall({ id: 'n1', name: 'addTrackedLift', input: {
      name: 'Squat', category: 'Legs', loadKind: 'weight', targetKind: 'repMax', reps: 1,
    } }, ctx).kind).toBe('rejected');
    expect(planToolCall({ id: 'n2', name: 'addTrackedLift', input: {
      name: 'Band pull-apart', category: 'Pull', loadKind: 'level', targetKind: 'reps', reps: 15,
    } }, ctx).kind).toBe('rejected');
    expect(planToolCall({ id: 'n3', name: 'addTrackedLift', input: {
      name: 'Squat', loadKind: 'weight', weight: 315, targetKind: 'repMax', reps: 1,
    } }, ctx).kind).toBe('rejected');
  });

  it('addTrackedLift rejects sets outside 1–10 and a name already tracked', () => {
    const squat = { name: 'Squat', category: 'Legs', loadKind: 'weight', weight: 315, unit: 'lb', targetKind: 'repMax', reps: 1 };
    expect(planToolCall({ id: 'n5', name: 'addTrackedLift', input: { ...squat, sets: 11 } }, ctx).kind).toBe('rejected');
    expect(planToolCall({ id: 'n6', name: 'addTrackedLift', input: { ...squat, sets: 0 } }, ctx).kind).toBe('rejected');
    expect(planToolCall({ id: 'n7', name: 'addTrackedLift', input: { ...squat, name: ' bench press ' } }, ctx).kind).toBe('rejected');
  });

  it('addTrackedLift confirms with a liftAdded action', () => {
    const plan = confirm(planToolCall({ id: 'n4', name: 'addTrackedLift', input: {
      name: 'Squat', category: 'Legs', loadKind: 'weight', weight: 315, unit: 'lb', targetKind: 'repMax', reps: 1, sets: 4, progression: true,
    } }, ctx));
    expect(plan.summary).toBe('Track Squat (Legs): 315 lb, 1-rep max');
    expect(plan.apply[0].payload).toMatchObject({ name: 'Squat', category: 'Legs', load: { kind: 'weight', value: 315, unit: 'lb' }, sets: 4, progression: true });
  });

  // --- swapExercise ------------------------------------------------------------------

  it('swapExercise ongoing renames the tracked lift, reweights on the step, and says the benchmark stays', () => {
    const s0 = startState();
    const plan = confirm(planToolCall({ id: 's1', name: 'swapExercise', input: {
      exerciseId: 'e1', replacementExerciseName: 'Dumbbell Bench Press', scope: 'ongoing', weight: 81, reason: 'Shoulder hurts.',
    } }, ctxFor(s0)));
    expect(plan.apply).toHaveLength(3);
    expect(weights(run(s0, plan.apply))).toEqual([225, 225, 80, 80]);
    expect(plan.apply[2].payload).toEqual({ id: 'l-bench', name: 'Dumbbell Bench Press' });
    expect(plan.summary).toMatch(/from now on/);
    expect(plan.detail).toBe('Shoulder hurts. Benchmark stays 265 lb, 1-rep max — update it after your first session.');
  });

  it('swapExercise ongoing on an untracked exercise is only for today', () => {
    const untracked = { ...workout, exercises: [{ ...workout.exercises[0], tracked: undefined }] } as ActiveWorkout;
    const plan = confirm(planToolCall({ id: 's2', name: 'swapExercise', input: {
      exerciseId: 'e1', replacementExerciseName: 'Dumbbell Bench Press', scope: 'ongoing', reason: 'x',
    } }, { ...ctx, activeWorkout: untracked }));
    expect(plan.apply).toHaveLength(1);
    expect(plan.summary).toMatch(/ today$/);
    expect(plan.detail).toBe('x');
  });

  // --- misc ----------------------------------------------------------------------------

  it('removeTrackedLift confirms; unknown lift is rejected', () => {
    expect(planToolCall({ id: 'r1', name: 'removeTrackedLift', input: { liftId: 'l-bench', reason: 'x' } }, ctx))
      .toMatchObject({ kind: 'confirm', summary: 'Stop tracking Bench Press' });
    expect(planToolCall({ id: 'r2', name: 'removeTrackedLift', input: { liftId: 'nope', reason: 'x' } }, ctx).kind).toBe('rejected');
  });

  it('rejects workout tools when no workout is active', () => {
    expect(planToolCall({ id: 'z', name: 'logSet', input: { exerciseId: 'e1', reps: 3 } }, { ...ctx, activeWorkout: null }).kind).toBe('rejected');
  });
});
