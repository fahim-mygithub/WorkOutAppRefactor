import { describe, it, expect } from 'vitest';
import { planToolCall, type PlanContext } from './applyTool';
import type { ActiveWorkout } from '../types/exercise';

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

const setsOf = (payload: unknown) => (payload as { sets: { weight?: number; reps: number; completed: boolean; rir?: number }[] }).sets;

describe('planToolCall', () => {
  it('adjustSet applies at once, snapped, with undo', () => {
    const plan = planToolCall({ id: 't1', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 2, weight: 207, reason: 'missed' } }, ctx);
    expect(plan.kind).toBe('auto');
    if (plan.kind !== 'auto') return;
    const sets = (plan.apply[0].payload as { sets: { weight: number; completed: boolean }[] }).sets;
    expect(sets.map((s) => s.weight)).toEqual([225, 225, 205, 205]);
    expect(plan.undo[0].payload).toMatchObject({ exerciseId: 'e1', sets: workout.exercises[0].sets });
  });

  it('adjustSet out of range is rejected', () => {
    const plan = planToolCall({ id: 't2', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 2, weight: 120, reason: 'x' } }, ctx);
    expect(plan.kind).toBe('rejected');
  });

  it('never rewrites completed sets', () => {
    const plan = planToolCall({ id: 't3', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 0, weight: 215, reason: 'x' } }, ctx);
    if (plan.kind !== 'auto') throw new Error(plan.kind);
    const sets = (plan.apply[0].payload as { sets: { weight: number }[] }).sets;
    expect(sets.map((s) => s.weight)).toEqual([225, 225, 215, 215]);
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

  // --- review additions -------------------------------------------------------

  it('adjustSet with neither weight nor reps is rejected', () => {
    const plan = planToolCall({ id: 'a1', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 2, reason: 'x' } }, ctx);
    expect(plan).toEqual({ kind: 'rejected', id: 'a1', reason: 'Nothing to change.' });
  });

  it('adjustSet with no open set at or after fromSetIndex is rejected', () => {
    expect(planToolCall({ id: 'a2', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 9, reps: 2, reason: 'x' } }, ctx).kind).toBe('rejected');
  });

  it('adjustSet reps-only clears the rep range and summarises', () => {
    const plan = planToolCall({ id: 'a3', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 2, reps: 2, reason: 'x' } }, ctx);
    if (plan.kind !== 'auto') throw new Error(plan.kind);
    expect(setsOf(plan.apply[0].payload).map((s) => s.reps)).toEqual([3, 2, 2, 2]);
    expect(plan.summary).toBe('Barbell Bench Press: remaining sets at 2 reps');
  });

  it("summaries say 'lb' for a workout in 'lbs', and 'kg' for kg", () => {
    const lb = planToolCall({ id: 'u1', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 2, weight: 215, reps: 3, reason: 'x' } }, ctx);
    if (lb.kind !== 'auto') throw new Error(lb.kind);
    expect(lb.summary).toBe('Barbell Bench Press: remaining sets at 215 lb × 3 reps');

    const kgWorkout = {
      ...workout,
      exercises: [{ ...workout.exercises[0], tracked: undefined, sets: workout.exercises[0].sets.map((s) => ({ ...s, weight: 100, unit: 'kg' as const })) }],
    } as ActiveWorkout;
    const kg = planToolCall({ id: 'u2', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 2, weight: 97, reason: 'x' } }, { ...ctx, activeWorkout: kgWorkout });
    if (kg.kind !== 'auto') throw new Error(kg.kind);
    // 97 kg snaps to the 2.5 kg default step.
    expect(setsOf(kg.apply[0].payload).map((s) => s.weight)).toEqual([100, 100, 97.5, 97.5]);
    expect(kg.summary).toMatch(/97\.5 kg/);
  });

  it('uses the tracked lift step when its unit matches the workout', () => {
    const stepped = { ...ctx, trackedLifts: [{ ...ctx.trackedLifts[0], step: 2.5 }] };
    const plan = planToolCall({ id: 'st', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 2, weight: 218, reason: 'x' } }, stepped);
    if (plan.kind !== 'auto') throw new Error(plan.kind);
    expect(setsOf(plan.apply[0].payload)[2].weight).toBe(217.5);
  });

  it('logSet completes the current set with undo', () => {
    const plan = planToolCall({ id: 'l1', name: 'logSet', input: { exerciseId: 'e1', reps: 2, weight: 225, rir: 0 } }, ctx);
    if (plan.kind !== 'auto') throw new Error(plan.kind);
    const sets = setsOf(plan.apply[0].payload);
    expect(sets[2]).toMatchObject({ reps: 2, weight: 225, rir: 0, completed: true });
    expect(sets[3].completed).toBe(false);
    expect(plan.undo[0].payload).toMatchObject({ sets: workout.exercises[0].sets });
  });

  it('logSet rejects a set index that does not exist', () => {
    expect(planToolCall({ id: 'l2', name: 'logSet', input: { exerciseId: 'e1', setIndex: 7, reps: 2 } }, ctx).kind).toBe('rejected');
  });

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
    const plan = planToolCall({ id: 'b3', name: 'updateBenchmark', input: {
      liftId: 'l-bench', loadKind: 'weight', weight: 115, targetKind: 'repMax', reps: 1, reason: 'x',
    } }, kgLift);
    if (plan.kind !== 'confirm') throw new Error(plan.kind);
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

  it('addTrackedLift confirms with a liftAdded action', () => {
    const plan = planToolCall({ id: 'n4', name: 'addTrackedLift', input: {
      name: 'Squat', category: 'Legs', loadKind: 'weight', weight: 315, unit: 'lb', targetKind: 'repMax', reps: 1, progression: true,
    } }, ctx);
    if (plan.kind !== 'confirm') throw new Error(plan.kind);
    expect(plan.summary).toBe('Track Squat (Legs): 315 lb, 1-rep max');
    expect(plan.apply[0].payload).toMatchObject({ name: 'Squat', category: 'Legs', load: { kind: 'weight', value: 315, unit: 'lb' }, progression: true });
  });

  it('swapExercise ongoing also renames the tracked lift; weight is on the step', () => {
    const plan = planToolCall({ id: 's1', name: 'swapExercise', input: {
      exerciseId: 'e1', replacementExerciseName: 'Dumbbell Bench Press', scope: 'ongoing', weight: 81, reason: 'shoulder',
    } }, ctx);
    if (plan.kind !== 'confirm') throw new Error(plan.kind);
    expect(plan.apply).toHaveLength(3);
    expect(setsOf(plan.apply[1].payload).map((s) => s.weight)).toEqual([225, 225, 80, 80]);
    expect(plan.apply[2].payload).toEqual({ id: 'l-bench', name: 'Dumbbell Bench Press' });
    expect(plan.summary).toMatch(/from now on/);
  });

  it('removeTrackedLift confirms; unknown lift is rejected', () => {
    expect(planToolCall({ id: 'r1', name: 'removeTrackedLift', input: { liftId: 'l-bench', reason: 'x' } }, ctx))
      .toMatchObject({ kind: 'confirm', summary: 'Stop tracking Bench Press' });
    expect(planToolCall({ id: 'r2', name: 'removeTrackedLift', input: { liftId: 'nope', reason: 'x' } }, ctx).kind).toBe('rejected');
  });

  it('rejects workout tools when no workout is active', () => {
    expect(planToolCall({ id: 'z', name: 'logSet', input: { exerciseId: 'e1', reps: 3 } }, { ...ctx, activeWorkout: null }).kind).toBe('rejected');
  });
});
