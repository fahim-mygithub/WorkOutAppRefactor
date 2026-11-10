// planToolCall for the app-control tools: openTab, startWorkout, loadIntoBuild.
import { describe, it, expect } from 'vitest';
import { planToolCall, sameIntent, tabOfPath, type PlanContext, type SavedWorkoutRef, type ToolPlan } from './applyTool';
import reducer, { startWorkout } from '../store/slices/workoutSlice';
import { buildPresetSet } from '../store/slices/aiSlice';
import type { PlannedWorkout } from '../store/slices/plannedWorkoutsSlice';
import type { ActiveWorkout, Exercise, WorkoutExercise } from '../types/exercise';
import type { TrackedLift } from '../types/trackedLifts';
import { prescribe } from '../lib/trackedLiftProgression';

const bench = { id: 'x-bench', name: 'Barbell Bench Press', equipment: 'Barbell', muscleGroups: ['Chest'], createdAt: '', updatedAt: '' } as unknown as Exercise;
const row = { id: 'x-row', name: 'Barbell Row', equipment: 'Barbell', muscleGroups: ['Back'], createdAt: '', updatedAt: '' } as unknown as Exercise;

const push: SavedWorkoutRef = {
  id: 'w-push',
  name: 'Push',
  workoutText: '3x8 Barbell Bench Press @135\n3x10 Barbell Row @95',
  parsedWorkout: {
    exercises: [
      { name: 'Barbell Bench Press', sets: [0, 1, 2].map(() => ({ reps: 8, weight: 135, unit: 'lbs' as const })) },
      { name: 'Barbell Row', sets: [0, 1, 2].map(() => ({ reps: 10, weight: 95, unit: 'lbs' as const })) },
    ],
    supersets: [],
  },
};

const planned: PlannedWorkout = {
  id: 'plan-1',
  dateKey: '2026-11-10',
  name: 'Pull day',
  status: 'planned',
  createdAt: '',
  exercises: [{
    id: 'pe1', exercise: row, restTime: 90,
    sets: [0, 1].map((k) => ({ id: `ps${k}`, reps: 12, weight: 80, unit: 'lbs', completed: false })),
  } as WorkoutExercise],
};

const ctx: PlanContext = {
  activeWorkout: null,
  trackedLifts: [],
  library: [bench, row],
  units: 'lbs',
  todayKey: '2026-11-10',
  savedWorkouts: [push],
  plannedWorkouts: [planned],
  pathname: '/',
};

const active = { id: 'a', name: 'Legs', exercises: [] } as unknown as ActiveWorkout;

const auto = (plan: ToolPlan) => {
  if (plan.kind !== 'auto') throw new Error(plan.kind === 'rejected' ? plan.reason : plan.kind);
  return plan;
};
const confirm = (plan: ToolPlan) => {
  if (plan.kind !== 'confirm') throw new Error(plan.kind === 'rejected' ? plan.reason : plan.kind);
  return plan;
};
const rejected = (plan: ToolPlan) => {
  if (plan.kind !== 'rejected') throw new Error(`expected a rejection, got ${plan.kind}`);
  return plan.reason;
};
/** The workout a start plan puts in the player, through the real reducer. */
const started = (plan: ToolPlan) => {
  const state = confirm(plan).apply.reduce(reducer, reducer(undefined, { type: '@@init' }));
  return state.activeWorkout!;
};

describe('openTab', () => {
  it('navigates to each tab at once, without an Undo', () => {
    const paths = { today: '/', workout: '/workout', build: '/build', library: '/exercises', profile: '/profile' };
    for (const [tab, path] of Object.entries(paths)) {
      const plan = auto(planToolCall({ id: 'o1', name: 'openTab', input: { tab } }, { ...ctx, activeWorkout: active, pathname: '/somewhere' }));
      expect(plan).toMatchObject({ navigate: path, apply: [], undo: [] });
    }
  });

  it('refuses the workout tab when no workout is in progress, with a reason', () => {
    expect(rejected(planToolCall({ id: 'o2', name: 'openTab', input: { tab: 'workout' } }, ctx))).toMatch(/No workout is in progress/);
  });

  it('stays put on the tab the lifter is already on (Build keeps its draft)', () => {
    const plan = auto(planToolCall({ id: 'o3', name: 'openTab', input: { tab: 'build' } }, { ...ctx, pathname: '/build/custom' }));
    expect(plan.navigate).toBeUndefined();
    expect(plan.summary).toBe('Already on Build');
  });

  it('rejects an unknown tab', () => {
    expect(rejected(planToolCall({ id: 'o4', name: 'openTab', input: { tab: 'settings' } }, ctx))).toMatch(/does not exist/);
  });

  it('maps routes to tabs', () => {
    expect(['/', '/workout', '/workout/shared/x', '/build', '/build/custom', '/exercises', '/profile', '/login'].map(tabOfPath))
      .toEqual(['today', 'workout', 'workout', 'build', 'build', 'library', 'profile', 'other']);
  });
});

describe('startWorkout', () => {
  it('starts a saved workout with its saved prescription, then opens the player', () => {
    const plan = confirm(planToolCall({ id: 's1', name: 'startWorkout', input: { workoutId: 'w-push' } }, ctx));
    expect(plan.summary).toBe('Start "Push" (2 exercises)');
    expect(plan.afterApply).toMatchObject({ navigate: '/workout', closeChat: true, markPerformed: 'w-push' });
    expect(plan.afterApply?.planContext).toBeUndefined();
    const w = started(plan);
    expect(w.name).toBe('Push');
    expect(w.exercises.map((e) => e.exercise.name)).toEqual(['Barbell Bench Press', 'Barbell Row']);
    expect(w.exercises[0].sets.map((s) => [s.reps, s.weight])).toEqual([[8, 135], [8, 135], [8, 135]]);
  });

  it('plans the same actions at Apply as on the card', () => {
    const call = { id: 's2', name: 'startWorkout', input: { workoutId: 'w-push', overrides: [{ index: 1, sets: 4 }] } };
    const a = confirm(planToolCall(call, ctx));
    const b = confirm(planToolCall(call, ctx));
    expect(sameIntent(a.apply, b.apply)).toBe(true);
    expect(JSON.stringify(a.apply)).toBe(JSON.stringify(b.apply));
  });

  it('applies the sets, reps and weight the lifter named, by name or position', () => {
    const plan = confirm(planToolCall({
      id: 's3', name: 'startWorkout',
      input: {
        workoutId: 'w-push',
        overrides: [
          { exerciseName: 'bench press', weight: 187 }, // snapped to a loadable 185
          { index: 1, sets: 4, reps: 6 },
        ],
      },
    }, ctx));
    const w = started(plan);
    expect(w.exercises[0].sets.map((s) => s.weight)).toEqual([185, 185, 185]);
    expect(w.exercises[1].sets.map((s) => [s.reps, s.weight])).toEqual([[6, 95], [6, 95], [6, 95], [6, 95]]);
    expect(new Set(w.exercises[1].sets.map((s) => s.id)).size).toBe(4);
    expect(plan.detail).toContain('Changed: Barbell Bench Press 185 lb, Barbell Row 4 sets × 6 reps');
  });

  it('lets the prescription logic set a tracked lift, unless the lifter named a weight', () => {
    const lift: TrackedLift = {
      id: 'l-bench', name: 'Barbell Bench Press', category: 'Push', progression: true,
      load: { kind: 'weight', value: 265, unit: 'lb' }, target: { kind: 'repMax', reps: 1 },
    };
    const withLift = { ...ctx, trackedLifts: [lift], defaultGoal: 'volume' as const };
    const engine = prescribe(lift, 'volume').sets.map((s) => s.weight);
    const own = started(planToolCall({ id: 's4', name: 'startWorkout', input: { workoutId: 'w-push' } }, withLift));
    expect(own.exercises[0].tracked).toEqual({ liftId: 'l-bench', goal: 'volume' });
    expect(own.exercises[0].sets.map((s) => s.weight)).toEqual(engine);
    expect(engine).not.toContain(135);

    const named = started(planToolCall({
      id: 's5', name: 'startWorkout', input: { workoutId: 'w-push', overrides: [{ exerciseName: 'Barbell Bench Press', weight: 200 }] },
    }, withLift));
    expect(named.exercises[0].sets.every((s) => s.weight === 200)).toBe(true);
    expect(named.exercises[0].tracked?.liftId).toBe('l-bench');
  });

  it("starts a planned workout, or today's plan, with its plan context", () => {
    for (const input of [{ planId: 'plan-1' }, { today: true }]) {
      const plan = confirm(planToolCall({ id: 's6', name: 'startWorkout', input }, ctx));
      expect(plan.summary).toBe('Start "Pull day" (1 exercise)');
      expect(plan.afterApply).toMatchObject({
        navigate: '/workout',
        planContext: { templateId: 'planned-workout', dateKey: '2026-11-10', plannedWorkoutId: 'plan-1' },
      });
      expect(started(plan).exercises[0].sets.map((s) => [s.reps, s.weight])).toEqual([[12, 80], [12, 80]]);
    }
  });

  it('refuses while a workout is in progress and says to end or finish it', () => {
    expect(rejected(planToolCall({ id: 's7', name: 'startWorkout', input: { workoutId: 'w-push' } }, { ...ctx, activeWorkout: active })))
      .toBe('"Legs" is still in progress. End or finish it first.');
  });

  it('rejects unknown ids and unclear requests instead of guessing', () => {
    const plan = (input: Record<string, unknown>, c: PlanContext = ctx) => planToolCall({ id: 's8', name: 'startWorkout', input }, c);
    expect(rejected(plan({ workoutId: 'w-nope' }))).toBe('That saved workout does not exist.');
    expect(rejected(plan({ planId: 'plan-nope' }))).toBe('That planned workout does not exist.');
    expect(rejected(plan({ today: true }, { ...ctx, plannedWorkouts: [] }))).toBe('Nothing is planned for today.');
    expect(rejected(plan({ planId: 'plan-1' }, { ...ctx, plannedWorkouts: [{ ...planned, status: 'done' }] }))).toMatch(/already done/);
    expect(rejected(plan({}))).toMatch(/Say which workout/);
    expect(rejected(plan({ workoutId: 'w-push', planId: 'plan-1' }))).toMatch(/Say which workout/);
    expect(rejected(plan({ workoutId: 'w-push', overrides: [{ exerciseName: 'Squat', weight: 225 }] }))).toBe('"Squat" is not in that workout.');
    expect(rejected(plan({ workoutId: 'w-push', overrides: [{ exerciseName: 'Barbell', weight: 100 }] }))).toMatch(/more than one/);
    expect(rejected(plan({ workoutId: 'w-push', overrides: [{ index: 5, sets: 3 }] }))).toMatch(/not in the workout/);
    expect(rejected(plan({ workoutId: 'w-push', overrides: [{ index: 0 }] }))).toMatch(/Nothing to change/);
    expect(rejected(plan({ workoutId: 'w-push', overrides: [{ index: 0, weight: -10 }] }))).toMatch(/above zero/);
    expect(rejected(plan({ workoutId: 'w-push', overrides: [{ index: 0, sets: 12 }] }))).toMatch(/sets must be 1–10/);
  });
});

describe('loadIntoBuild', () => {
  it('puts a saved workout on Build for review, never saving it', () => {
    const plan = confirm(planToolCall({ id: 'b1', name: 'loadIntoBuild', input: { workoutId: 'w-push' } }, ctx));
    expect(plan.summary).toBe('Load "Push" into Build (2 exercises)');
    expect(plan.effects).toBeUndefined();
    expect(plan.afterApply).toEqual({ navigate: '/build/custom', closeChat: true });
    expect(plan.apply).toEqual([buildPresetSet({
      id: 'build-b1',
      name: 'Push',
      workout: { name: 'Push', workoutText: push.workoutText, parsedWorkout: push.parsedWorkout },
    })]);
    expect(plan.detail).not.toMatch(/replaces/);
  });

  it('puts an exercise list on Build, names resolved to the library', () => {
    const plan = confirm(planToolCall({
      id: 'b2', name: 'loadIntoBuild',
      input: { name: 'Quick push', exercises: [{ name: 'Bench Press', sets: 4, reps: 6, repsMax: 8, weight: 155, unit: 'lbs' }] },
    }, { ...ctx, library: [bench, row, { ...bench, id: 'x-bp2', name: 'Bench Press Machine' } as Exercise] }));
    const preset = (plan.apply[0] as ReturnType<typeof buildPresetSet>).payload;
    expect(preset.name).toBe('Quick push');
    expect(preset.workout.parsedWorkout.exercises).toEqual([{
      name: 'Barbell Bench Press',
      sets: [0, 1, 2, 3].map(() => ({ reps: { min: 6, max: 8 }, weight: 155, unit: 'lbs' })),
    }]);
    expect(preset.workout.workoutText).toContain('Barbell Bench Press');
  });

  it('says it replaces unsaved Build content', () => {
    const plan = confirm(planToolCall({ id: 'b3', name: 'loadIntoBuild', input: { workoutId: 'w-push' } }, { ...ctx, buildHasDraft: true }));
    expect(plan.detail).toMatch(/^This replaces what is on the Build screen now\./);
  });

  it('rejects unknown ids and malformed lists', () => {
    const plan = (input: Record<string, unknown>) => planToolCall({ id: 'b4', name: 'loadIntoBuild', input }, ctx);
    expect(rejected(plan({ workoutId: 'w-nope' }))).toBe('That saved workout does not exist.');
    expect(rejected(plan({}))).toMatch(/Say what to load/);
    expect(rejected(plan({ workoutId: 'w-push', exercises: [{ name: 'Bench', sets: 3, reps: 8 }] }))).toMatch(/Say what to load/);
    expect(rejected(plan({ exercises: [{ name: 'Bench', sets: 0, reps: 8 }] }))).toMatch(/sets must be 1–10/);
  });

  it('does not touch a workout in progress', () => {
    const plan = confirm(planToolCall({ id: 'b5', name: 'loadIntoBuild', input: { workoutId: 'w-push' } }, { ...ctx, activeWorkout: active }));
    expect(plan.apply.map((a) => a.type)).toEqual([buildPresetSet.type]);
    expect(plan.apply.some((a) => a.type === startWorkout.type)).toBe(false);
  });
});
