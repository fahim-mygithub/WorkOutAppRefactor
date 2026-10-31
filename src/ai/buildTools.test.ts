// The build / plan / profile tools: each plans to a confirm card, applies on
// Apply (store actions and/or saves) and takes it all back on Undo.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import plannedWorkouts from '../store/slices/plannedWorkoutsSlice';
import customExercise from '../store/slices/customExerciseSlice';
import user, { setProfile } from '../store/slices/userSlice';
import { CustomExerciseService, type CustomExercise } from '../services/customExerciseService';
import type { AppDispatch, RootState } from '../store';
import type { Exercise } from '../types/exercise';
import { planToolCall, sameEffects, sameIntent, type PlanContext, type ToolPlan } from './applyTool';
import { applyPlan, type EffectServices, type SavedWorkoutDraft, type PastWorkoutDraft } from './effects';
import type { AiToolCall } from './types';

const library = [
  { id: 'x-bench', name: 'Barbell Bench Press', equipment: 'Barbell', muscleGroups: ['Chest'] },
  { id: 'x-row', name: 'Barbell Bent Over Row', equipment: 'Barbell', muscleGroups: ['Back'] },
  { id: 'x-curl', name: 'Machine Leg Curl', equipment: 'Machine', muscleGroups: ['Hamstrings'] },
] as Exercise[];

const savedPush = {
  id: 'w1',
  name: 'Push',
  workoutText: '3x8 Barbell Bench Press @135lbs',
  parsedWorkout: {
    exercises: [{ name: 'Barbell Bench Press', sets: [1, 2, 3].map(() => ({ reps: 8, weight: 135, unit: 'lbs' as const })) }],
    supersets: [[{ name: 'Dip', sets: [{ reps: 10 }] }, { name: 'Push Up', sets: [{ reps: 15 }] }]],
  },
};

const initialPreferences = user(undefined, { type: '@@init' }).preferences;

const ctx: PlanContext = {
  activeWorkout: null,
  trackedLifts: [],
  library,
  units: 'lbs',
  todayKey: '2026-10-30',
  savedWorkouts: [savedPush],
  displayName: 'Alex',
  preferences: initialPreferences,
};

function makeStore() {
  const store = configureStore({
    reducer: { plannedWorkouts, customExercise, user },
    middleware: (g) => g({ serializableCheck: false }),
  });
  store.dispatch(setProfile({ uid: 'u1', email: 'a@b.c', displayName: 'Alex', createdAt: '', lastActiveAt: '' }));
  return store;
}

function fakeServices() {
  const saved = new Map<string, SavedWorkoutDraft>([[savedPush.id, savedPush]]);
  const past = new Map<string, PastWorkoutDraft>();
  let n = 0;
  let p = 0;
  const services = {
    saveWorkout: vi.fn(async (_uid: string, w: SavedWorkoutDraft) => {
      const id = `new${++n}`;
      saved.set(id, w);
      return id;
    }),
    updateWorkout: vi.fn(async (_uid: string, id: string, w: SavedWorkoutDraft) => {
      saved.set(id, w);
    }),
    deleteWorkout: vi.fn(async (_uid: string, id: string) => {
      saved.delete(id);
    }),
    saveProfile: vi.fn(async () => {}),
    savePastWorkout: vi.fn(async (_uid: string, w: PastWorkoutDraft) => {
      const id = `past${++p}`;
      past.set(id, w);
      return { workoutId: id, exerciseIds: [`ex${p}`] };
    }),
    deletePastWorkout: vi.fn(async (_uid: string, id: string, _exerciseIds?: string[]) => {
      past.delete(id);
    }),
    updatePastWorkout: vi.fn(async (_uid: string, id: string, w: Partial<PastWorkoutDraft>) => {
      const cur = past.get(id);
      if (cur) past.set(id, { ...cur, ...w });
    }),
  } satisfies EffectServices;
  return { saved, past, services };
}

function depsFor(store: ReturnType<typeof makeStore>, services: EffectServices) {
  return {
    userId: 'u1' as string | null,
    dispatch: store.dispatch as unknown as AppDispatch,
    getState: store.getState as unknown as () => RootState,
    services,
  };
}

const confirm = (plan: ToolPlan) => {
  if (plan.kind !== 'confirm') throw new Error(plan.kind === 'rejected' ? plan.reason : plan.kind);
  return plan;
};
const call = (name: AiToolCall['name'], input: Record<string, unknown>, id = 'c1'): AiToolCall => ({ id, name, input });

afterEach(() => vi.restoreAllMocks());

describe('createWorkout', () => {
  const push = { name: 'Push', exercises: [{ name: 'bench press', sets: 3, reps: 8, weight: 136, unit: 'lbs' }] };
  const pull = { name: 'Pull', exercises: [{ name: 'Bent Over Row', sets: 4, reps: 8, repsMax: 12 }] };

  it('plans a confirm card and saves nothing until Apply', () => {
    const { services } = fakeServices();
    const plan = confirm(planToolCall(call('createWorkout', { workouts: [push] }), ctx));
    expect(plan.summary).toBe('Save workout "Push" (1 exercise)');
    expect(plan.detail).toContain('Barbell Bench Press 3×8 @ 135 lb');
    expect(services.saveWorkout).not.toHaveBeenCalled();
  });

  it('saves through the saved-workout path on Apply, and Undo deletes it', async () => {
    const store = makeStore();
    const { saved, services } = fakeServices();
    const plan = confirm(planToolCall(call('createWorkout', { workouts: [push] }), ctx));
    const undo = await applyPlan(plan, depsFor(store, services));
    expect(services.saveWorkout).toHaveBeenCalledTimes(1);
    expect(saved.get('new1')).toEqual({
      name: 'Push',
      workoutText: '3x8 Barbell Bench Press @135lbs',
      parsedWorkout: {
        exercises: [{ name: 'Barbell Bench Press', sets: [1, 2, 3].map(() => ({ reps: 8, weight: 135, unit: 'lbs' })) }],
        supersets: [],
      },
    });
    await undo!();
    expect(services.deleteWorkout).toHaveBeenCalledWith('u1', 'new1');
    expect(saved.has('new1')).toBe(false);
  });

  it('saves many at once; Undo deletes them all', async () => {
    const store = makeStore();
    const { saved, services } = fakeServices();
    const plan = confirm(planToolCall(call('createWorkout', { workouts: [push, pull] }), ctx));
    expect(plan.summary).toBe('Save 2 workouts: Push, Pull');
    const undo = await applyPlan(plan, depsFor(store, services));
    expect(saved.get('new2')?.workoutText).toBe('4x8-12 Barbell Bent Over Row');
    expect(saved.get('new2')?.parsedWorkout.exercises[0].sets[0]).toEqual({ reps: { min: 8, max: 12 } });
    await undo!();
    expect([...saved.keys()]).toEqual(['w1']);
  });

  it('rolls back the saves already made when a later one fails', async () => {
    const store = makeStore();
    const { saved, services } = fakeServices();
    services.saveWorkout
      .mockImplementationOnce(async (_u, w) => {
        saved.set('new1', w);
        return 'new1';
      })
      .mockRejectedValueOnce(new Error('offline'));
    const plan = confirm(planToolCall(call('createWorkout', { workouts: [push, pull] }), ctx));
    await expect(applyPlan(plan, depsFor(store, services))).rejects.toThrow('offline');
    expect([...saved.keys()]).toEqual(['w1']);
  });

  it('rejects empty or malformed workouts', () => {
    expect(planToolCall(call('createWorkout', { workouts: [] }), ctx).kind).toBe('rejected');
    expect(planToolCall(call('createWorkout', { workouts: [{ name: 'X', exercises: [] }] }), ctx).kind).toBe('rejected');
    expect(
      planToolCall(call('createWorkout', { workouts: [{ name: 'X', exercises: [{ name: 'Squat', sets: 0, reps: 5 }] }] }), ctx).kind,
    ).toBe('rejected');
    expect(planToolCall(call('createWorkout', { workouts: [{ exercises: push.exercises }] }), ctx).kind).toBe('rejected');
  });
});

describe('updateWorkout', () => {
  it('changes a saved workout on Apply (supersets stay), and Undo restores it', async () => {
    const store = makeStore();
    const { saved, services } = fakeServices();
    const plan = confirm(
      planToolCall(
        call('updateWorkout', {
          workoutId: 'w1',
          name: 'Push A',
          exercises: [{ name: 'Barbell Bench Press', sets: 4, reps: 6, weight: 145 }],
          reason: 'heavier',
        }),
        ctx,
      ),
    );
    expect(plan.summary).toBe('Update "Push": rename to "Push A", 1 exercise');
    expect(plan.detail).toContain('heavier');
    const undo = await applyPlan(plan, depsFor(store, services));
    const next = saved.get('w1')!;
    expect(next.name).toBe('Push A');
    expect(next.parsedWorkout.exercises[0].sets).toHaveLength(4);
    expect(next.parsedWorkout.supersets).toEqual(savedPush.parsedWorkout.supersets);
    expect(next.workoutText).toBe('4x6 Barbell Bench Press @145lbs\n1x10 Dip ss 1x15 Push Up');
    await undo!();
    expect(saved.get('w1')).toEqual({
      name: savedPush.name,
      workoutText: savedPush.workoutText,
      parsedWorkout: savedPush.parsedWorkout,
    });
  });

  it('rejects an unknown id or no change', () => {
    expect(planToolCall(call('updateWorkout', { workoutId: 'nope', name: 'X' }), ctx)).toMatchObject({
      kind: 'rejected',
      reason: 'That saved workout does not exist.',
    });
    expect(planToolCall(call('updateWorkout', { workoutId: 'w1' }), ctx).kind).toBe('rejected');
  });
});

describe('planWorkout', () => {
  const legs = {
    dateKey: '2026-11-02',
    name: 'Legs',
    exercises: [
      { name: 'leg curl', sets: 3, reps: 12 },
      { name: 'Sled Push', sets: 4, reps: 20 },
    ],
  };

  it('adds a plan through planAdded on Apply, and Undo removes it', async () => {
    const store = makeStore();
    const { services } = fakeServices();
    const plan = confirm(planToolCall(call('planWorkout', legs), ctx));
    expect(plan.summary).toBe('Plan "Legs" for Mon, Nov 2');
    expect(store.getState().plannedWorkouts.plans).toHaveLength(0);
    const undo = await applyPlan(plan, depsFor(store, services));
    const plans = store.getState().plannedWorkouts.plans;
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ dateKey: '2026-11-02', name: 'Legs', status: 'planned' });
    expect(plans[0].exercises[0].exercise.name).toBe('Machine Leg Curl');
    expect(plans[0].exercises[0].sets).toHaveLength(3);
    expect(plans[0].exercises[1].exercise).toMatchObject({ name: 'Sled Push', muscleGroup: 'Unknown' });
    await undo!();
    expect(store.getState().plannedWorkouts.plans).toHaveLength(0);
  });

  it('plans the same thing twice (so a late Apply is not blocked)', () => {
    const a = confirm(planToolCall(call('planWorkout', legs), ctx));
    const b = confirm(planToolCall(call('planWorkout', legs), ctx));
    expect(sameIntent(a.apply, b.apply)).toBe(true);
  });

  it('rejects an impossible or past date', () => {
    expect(planToolCall(call('planWorkout', { ...legs, dateKey: '2026-02-30' }), ctx).kind).toBe('rejected');
    expect(planToolCall(call('planWorkout', { ...legs, dateKey: '2026-10-29' }), ctx)).toMatchObject({
      kind: 'rejected',
      reason: 'That date has passed.',
    });
  });
});

describe('updateProfile', () => {
  it('changes display and training fields on Apply, and Undo restores them', async () => {
    const store = makeStore();
    const { services } = fakeServices();
    const plan = confirm(planToolCall(call('updateProfile', { displayName: 'Sam', weightUnit: 'kg', defaultRestTime: 90 }), ctx));
    expect(plan.summary).toBe('Profile: name → Sam, weight unit → kg, default rest → 90 s');
    const undo = await applyPlan(plan, depsFor(store, services));
    let s = store.getState().user;
    expect(s.profile?.displayName).toBe('Sam');
    expect(s.preferences).toMatchObject({ weightUnit: 'kg', defaultRestTime: 90 });
    // The whole preferences object is written, so other preferences survive.
    expect(services.saveProfile).toHaveBeenLastCalledWith('u1', {
      displayName: 'Sam',
      preferences: expect.objectContaining({ weightUnit: 'kg', defaultRestTime: 90, theme: 'system' }),
    });
    await undo!();
    s = store.getState().user;
    expect(s.profile?.displayName).toBe('Alex');
    expect(s.preferences).toMatchObject({ weightUnit: 'lbs', defaultRestTime: 120 });
    expect(services.saveProfile).toHaveBeenLastCalledWith('u1', {
      displayName: 'Alex',
      preferences: expect.objectContaining({ weightUnit: 'lbs', defaultRestTime: 120 }),
    });
  });

  it('puts the store back when the save fails', async () => {
    const store = makeStore();
    const { services } = fakeServices();
    services.saveProfile.mockRejectedValueOnce(new Error('offline'));
    const plan = confirm(planToolCall(call('updateProfile', { weightUnit: 'kg' }), ctx));
    await expect(applyPlan(plan, depsFor(store, services))).rejects.toThrow('offline');
    expect(store.getState().user.preferences.weightUnit).toBe('lbs');
  });

  it('ignores account fields and rejects a change that changes nothing', () => {
    expect(planToolCall(call('updateProfile', { email: 'x@y.z', uid: 'u2' }), ctx).kind).toBe('rejected');
    expect(planToolCall(call('updateProfile', { weightUnit: 'lbs' }), ctx)).toMatchObject({
      kind: 'rejected',
      reason: 'Nothing to change.',
    });
    const plan = confirm(planToolCall(call('updateProfile', { weightUnit: 'kg', email: 'x@y.z' }), ctx));
    expect(JSON.stringify(plan.effects)).not.toContain('x@y.z');
  });
});

describe('addExercise', () => {
  const draft = {
    name: 'Hammer Strength Iso Row',
    muscleGroups: ['Back', 'Biceps'],
    equipment: 'Machine',
    setupCues: ['Chest on the pad.', 'Drive elbows back.'],
    defaultSets: { sets: 3, reps: 10 },
  };

  it('saves a custom exercise on Apply, and Undo deletes it', async () => {
    const store = makeStore();
    const { services } = fakeServices();
    const saveSpy = vi.spyOn(CustomExerciseService, 'saveCustomExercise').mockResolvedValue('c1');
    vi.spyOn(CustomExerciseService, 'getUserCustomExercises').mockResolvedValue([
      { id: 'c1', name: draft.name, muscleGroup: 'Back, Biceps', equipment: 'Machine' } as CustomExercise,
    ]);
    const delSpy = vi.spyOn(CustomExerciseService, 'deleteCustomExercise').mockResolvedValue();
    const plan = confirm(planToolCall(call('addExercise', draft), ctx));
    expect(plan.summary).toBe('Add Hammer Strength Iso Row to your exercises');
    expect(saveSpy).not.toHaveBeenCalled();
    const undo = await applyPlan(plan, depsFor(store, services));
    expect(saveSpy).toHaveBeenCalledWith('u1', {
      originalName: draft.name,
      name: draft.name,
      muscleGroup: 'Back, Biceps',
      equipment: 'Machine',
      difficulty: 'Intermediate',
      instructions: draft.setupCues,
      notes: 'Default: 3×10',
    });
    expect(store.getState().customExercise.exercises.map((e) => e.id)).toEqual(['c1']);
    await undo!();
    expect(delSpy).toHaveBeenCalledWith('u1', 'c1');
    expect(store.getState().customExercise.exercises).toEqual([]);
  });

  it('rejects a name already in the library, or a draft missing parts', () => {
    expect(planToolCall(call('addExercise', { ...draft, name: 'machine leg curl' }), ctx).kind).toBe('rejected');
    expect(planToolCall(call('addExercise', { ...draft, muscleGroups: [] }), ctx).kind).toBe('rejected');
    expect(planToolCall(call('addExercise', { ...draft, defaultSets: { sets: 0, reps: 10 } }), ctx).kind).toBe('rejected');
  });
});

describe('logPastWorkout', () => {
  const pastWorkout = {
    date: '2026-10-25',
    name: 'Heavy Chest',
    exercises: [
      {
        name: 'Barbell Bench Press',
        sets: [
          { reps: 5, weight: 225, unit: 'lbs' },
          { reps: 5, weight: 225, unit: 'lbs' },
        ],
      },
    ],
  };

  it('plans a confirm card with date, exercises, sets', () => {
    const { services } = fakeServices();
    const plan = confirm(planToolCall(call('logPastWorkout', pastWorkout), ctx));
    expect(plan.summary).toContain('Log past workout "Heavy Chest" on Sun, Oct 25 (1 exercise)');
    expect(plan.detail).toContain('Barbell Bench Press (5@225lbs, 5@225lbs)');
    expect(services.savePastWorkout).not.toHaveBeenCalled();
  });

  it('saves through savePastWorkout on Apply, and Undo deletes it', async () => {
    const store = makeStore();
    const { past, services } = fakeServices();
    const plan = confirm(planToolCall(call('logPastWorkout', pastWorkout), ctx));
    const undo = await applyPlan(plan, depsFor(store, services));
    expect(services.savePastWorkout).toHaveBeenCalledTimes(1);
    expect(past.has('past1')).toBe(true);
    expect(past.get('past1')?.name).toBe('Heavy Chest');
    expect(past.get('past1')?.exercises[0].sets).toHaveLength(2);

    await undo!();
    expect(services.deletePastWorkout).toHaveBeenCalledWith('u1', 'past1', ['ex1']);
    expect(past.has('past1')).toBe(false);
  });

  it('rejects invalid date or missing exercises', () => {
    expect(planToolCall(call('logPastWorkout', { ...pastWorkout, date: 'not-a-date' }), ctx).kind).toBe('rejected');
    expect(planToolCall(call('logPastWorkout', { ...pastWorkout, exercises: [] }), ctx).kind).toBe('rejected');
  });
});

describe('editPastWorkout', () => {
  it('plans a confirm card, Apply calls updatePastWorkout, Undo restores prior values', async () => {
    const store = makeStore();
    const { past, services } = fakeServices();
    past.set('w123', {
      date: '2026-10-20',
      name: 'Leg Day',
      exercises: [{ name: 'Squat', sets: [{ reps: 5, weight: 315 }] }],
    });

    const plan = confirm(
      planToolCall(
        call('editPastWorkout', {
          workoutId: 'w123',
          name: 'Leg Day Heavy',
          exercises: [{ name: 'Squat', sets: [{ reps: 5, weight: 335 }] }],
        }),
        ctx,
      ),
    );
    expect(plan.summary).toContain('Edit past workout: rename to "Leg Day Heavy", 1 exercises updated');
    const undo = await applyPlan(plan, depsFor(store, services));
    expect(services.updatePastWorkout).toHaveBeenCalledWith('u1', 'w123', expect.objectContaining({
      name: 'Leg Day Heavy',
    }));

    await undo!();
    expect(services.updatePastWorkout).toHaveBeenCalledTimes(2);
  });

  it('rejects an empty edit', () => {
    expect(planToolCall(call('editPastWorkout', { workoutId: 'w123' }), ctx).kind).toBe('rejected');
  });
});

describe('sameEffects', () => {
  const squat = (name: string) => ({ workouts: [{ name, exercises: [{ name: 'Squat', sets: 3, reps: 5 }] }] });
  it('compares the saves two plans would make', () => {
    const one = confirm(planToolCall(call('createWorkout', squat('A')), ctx));
    const same = confirm(planToolCall(call('createWorkout', squat('A')), ctx));
    const other = confirm(planToolCall(call('createWorkout', squat('B')), ctx));
    expect(sameEffects(one.effects, same.effects)).toBe(true);
    expect(sameEffects(one.effects, other.effects)).toBe(false);
    expect(sameEffects(undefined, undefined)).toBe(true);
  });
});

describe('applyPlan', () => {
  it('needs a signed-in user for saves', async () => {
    const store = makeStore();
    const { services } = fakeServices();
    const plan = confirm(
      planToolCall(call('createWorkout', { workouts: [{ name: 'A', exercises: [{ name: 'Squat', sets: 3, reps: 5 }] }] }), ctx),
    );
    await expect(applyPlan(plan, { ...depsFor(store, services), userId: null })).rejects.toThrow('Sign in to save.');
    expect(services.saveWorkout).not.toHaveBeenCalled();
  });

  it('gives no undo for the older confirm tools', async () => {
    const store = makeStore();
    const { services } = fakeServices();
    const plan: ToolPlan = { kind: 'confirm', id: 'x', summary: 's', apply: [] };
    await expect(applyPlan(plan, depsFor(store, services))).resolves.toBeUndefined();
  });
});
