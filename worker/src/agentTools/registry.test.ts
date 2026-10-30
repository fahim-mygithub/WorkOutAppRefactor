import { beforeEach, describe, expect, it } from 'vitest';
import { FakeFirestore } from '../data/testing/fakeFirestore';
import { UserData } from '../data/userData';
import { agentTools, runAgentTool } from './registry';

const UID = 'ownerUid123';
const OTHER = 'someoneElse456';
const NOW = new Date('2026-10-30T12:00:00.000Z');

let fs: FakeFirestore;
let ctx: { data: UserData };
let ids: number;

beforeEach(() => {
  fs = new FakeFirestore();
  ids = 0;
  ctx = { data: new UserData(fs.client(), UID, () => NOW, () => `plan-${++ids}`) };
  fs.put(['users', UID], {
    email: 'owner@example.com',
    displayName: 'Owner',
    preferences: { weightUnit: 'lbs', defaultRestTime: 90, theme: 'dark' },
    stats: { totalWorkouts: 4 },
    createdAt: NOW,
  });
  fs.put(['users', OTHER], { email: 'other@example.com', displayName: 'Other' });
  fs.put(['users', OTHER, 'savedWorkouts', 'theirWorkout'], { name: 'Not yours', updatedAt: NOW });
});

const run = (name: string, input: unknown) => runAgentTool(name, input, ctx);
const ok = async (name: string, input: unknown) => {
  const r = await run(name, input);
  if (!r.ok) throw new Error(r.error);
  return r.result as Record<string, unknown>;
};

const BENCH = { name: 'Bench Press', sets: 3, reps: 8, weight: 135 };

describe('agent tool registry', () => {
  it('has the ten tools with model-facing descriptions', () => {
    expect(agentTools.map((t) => t.name)).toEqual([
      'get_profile', 'update_profile', 'list_workouts', 'get_workout', 'create_workout',
      'update_workout', 'list_plans', 'plan_workout', 'list_history', 'add_exercise',
    ]);
    for (const t of agentTools) expect(t.description.length).toBeGreaterThan(40);
  });
});

describe('uid scoping', () => {
  it('rejects any input that names a user', async () => {
    for (const [tool, input] of [
      ['get_profile', { uid: OTHER }],
      ['list_workouts', { userId: OTHER }],
      ['create_workout', { uid: OTHER, workouts: [{ name: 'x', exercises: [BENCH] }] }],
      ['create_workout', { workouts: [{ name: 'x', exercises: [BENCH], userId: OTHER }] }],
      ['plan_workout', { dateKey: '2026-11-01', name: 'x', exercises: [BENCH], uid: OTHER }],
    ] as const) {
      const r = await run(tool, input);
      expect(r.ok, `${tool} ${JSON.stringify(input)}`).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/Unrecognized key/);
    }
  });

  it('rejects document ids that could escape the user\'s folder', async () => {
    for (const workoutId of ['../someoneElse456/savedWorkouts/theirWorkout', 'a/b', '..', '']) {
      const r = await run('get_workout', { workoutId });
      expect(r.ok).toBe(false);
    }
  });

  it('cannot read another user\'s workout by id', async () => {
    const r = await run('get_workout', { workoutId: 'theirWorkout' });
    expect(r).toEqual({ ok: false, error: 'No saved workout with id theirWorkout.' });
  });

  it('only ever touches users/{uid} paths', async () => {
    await ok('get_profile', {});
    await ok('update_profile', { displayName: 'Me' });
    const created = await ok('create_workout', { workouts: [{ name: 'A', exercises: [BENCH] }] });
    const id = (created.created as { id: string }[])[0].id;
    await ok('list_workouts', {});
    await ok('get_workout', { workoutId: id });
    await ok('update_workout', { workoutId: id, name: 'A2' });
    await ok('plan_workout', { dateKey: '2026-11-01', workoutId: id });
    await ok('list_plans', {});
    await ok('list_history', { kind: 'workouts' });
    await ok('list_history', { kind: 'exercises' });
    await ok('add_exercise', { name: 'Iso Row', muscleGroups: ['Back'], equipment: 'Machine' });
    expect(fs.requests.length).toBeGreaterThan(10);
    for (const r of fs.requests) expect(r.path.slice(0, 2)).toEqual(['users', UID]);
    expect(fs.read(['users', OTHER])).toEqual({ email: 'other@example.com', displayName: 'Other' });
  });

  it('refuses a UserData for a malformed uid', () => {
    expect(() => new UserData(fs.client(), '../x')).toThrow(/Invalid user id/);
  });
});

describe('create_workout', () => {
  it('saves many workouts in one call, each in the app\'s savedWorkouts shape', async () => {
    const r = await ok('create_workout', {
      workouts: [
        { name: 'Push', exercises: [BENCH] },
        { name: 'Pull', exercises: [{ name: 'Row', sets: 4, reps: 10 }], tags: ['Claude'] },
        { name: 'Legs', exercises: [{ name: 'Squat', sets: 5, reps: 5, weight: 100, unit: 'kg' }] },
      ],
    });
    const created = r.created as { id: string; name: string }[];
    expect(created.map((c) => c.name)).toEqual(['Push', 'Pull', 'Legs']);
    const raw = fs.raw(['users', UID, 'savedWorkouts', created[0].id])!;
    expect(raw.createdAt).toEqual({ timestampValue: NOW.toISOString() });
    expect(raw.lastPerformedAt).toEqual({ nullValue: null });
    const pull = fs.read(['users', UID, 'savedWorkouts', created[1].id])!;
    expect(pull).toMatchObject({ userId: UID, name: 'Pull', workoutText: '4x10 Row', tags: ['Claude'], isPublic: false });

    const list = await ok('list_workouts', { pageSize: 2 });
    expect((list.items as unknown[]).length).toBe(2);
    expect(list.nextPageToken).toBe('2');
    const next = await ok('list_workouts', { pageSize: 2, pageToken: '2' });
    expect((next.items as unknown[]).length).toBe(1);
    expect(next.nextPageToken).toBeUndefined();
  });

  it('rejects an empty workout and more than ten', async () => {
    expect((await run('create_workout', { workouts: [{ name: 'x', exercises: [] }] })).ok).toBe(false);
    const eleven = Array.from({ length: 11 }, (_, i) => ({ name: `w${i}`, exercises: [BENCH] }));
    expect((await run('create_workout', { workouts: eleven })).ok).toBe(false);
  });
});

describe('update_workout', () => {
  it('changes only what was sent and bumps updatedAt', async () => {
    const created = await ok('create_workout', { workouts: [{ name: 'Push', exercises: [BENCH], tags: ['t'] }] });
    const id = (created.created as { id: string }[])[0].id;
    const updated = await ok('update_workout', {
      workoutId: id,
      exercises: [{ ...BENCH, weight: 145 }, { name: 'Dips', sets: 3, reps: 12 }],
    });
    expect(updated).toMatchObject({ name: 'Push', tags: ['t'], workoutText: '3x8 Bench Press @145lbs\n3x12 Dips' });
    const stored = fs.read(['users', UID, 'savedWorkouts', id])!;
    expect(stored.userId).toBe(UID);
    expect(stored.createdAt).toBe(NOW.toISOString());
  });

  it('fails on a workout that does not exist', async () => {
    expect(await run('update_workout', { workoutId: 'nope', name: 'x' })).toEqual({
      ok: false,
      error: 'No saved workout with id nope.',
    });
  });
});

describe('plan_workout', () => {
  const PLANS = ['users', UID, 'schedule', 'plannedWorkouts'];
  const existing = { id: 'phone-plan', dateKey: '2026-10-31', name: 'Phone', exercises: [], status: 'done', createdAt: 'x' };

  it('creates the plans document when there is none', async () => {
    const r = await ok('plan_workout', { dateKey: '2026-11-01', name: 'Run', exercises: [{ name: 'Row', sets: 1, reps: 5 }] });
    expect(r.plan).toMatchObject({ id: 'plan-1', status: 'planned', dateKey: '2026-11-01' });
    expect(fs.read(PLANS)).toMatchObject({ schemaVersion: 1, updatedAt: NOW.toISOString() });
  });

  it('merges into existing plans by id without touching the others', async () => {
    fs.put(PLANS, { plans: [existing], schemaVersion: 1, updatedAt: 'x' });
    const created = await ok('create_workout', { workouts: [{ name: 'Push', exercises: [BENCH] }] });
    const workoutId = (created.created as { id: string }[])[0].id;
    await ok('plan_workout', { dateKey: '2026-11-02', workoutId });
    await ok('plan_workout', { dateKey: '2026-11-03', name: 'Pull', exercises: [{ name: 'Row', sets: 3, reps: 10 }] });
    const plans = (fs.read(PLANS)!.plans as { id: string; name: string; dateKey: string }[]);
    expect(plans[0]).toEqual(existing);
    expect(plans.map((p) => [p.id, p.name, p.dateKey])).toEqual([
      ['phone-plan', 'Phone', '2026-10-31'],
      ['plan-1', 'Push', '2026-11-02'],
      ['plan-2', 'Pull', '2026-11-03'],
    ]);

    await ok('plan_workout', { planId: 'plan-1', dateKey: '2026-11-05', workoutId });
    const after = (fs.read(PLANS)!.plans as { id: string; dateKey: string }[]);
    expect(after.map((p) => [p.id, p.dateKey])).toEqual([
      ['phone-plan', '2026-10-31'],
      ['plan-1', '2026-11-05'],
      ['plan-2', '2026-11-03'],
    ]);
  });

  it('re-reads and merges when the phone writes the plans doc in between', async () => {
    fs.put(PLANS, { plans: [existing], schemaVersion: 1, updatedAt: 'x' });
    let raced = false;
    fs.beforePatch = (path) => {
      if (raced || path.join('/') !== PLANS.join('/')) return;
      raced = true;
      const phone = { ...existing, id: 'phone-plan-2', dateKey: '2026-11-04' };
      fs.put(PLANS, { plans: [existing, phone], schemaVersion: 1, updatedAt: 'y' });
    };
    await ok('plan_workout', { dateKey: '2026-11-01', name: 'Run', exercises: [{ name: 'Row', sets: 1, reps: 5 }] });
    const ids = (fs.read(PLANS)!.plans as { id: string }[]).map((p) => p.id);
    expect(ids).toEqual(['phone-plan', 'phone-plan-2', 'plan-1']);
  });

  it('needs a workout or exercises, a real date, and an existing planId', async () => {
    expect((await run('plan_workout', { dateKey: '2026-11-01', name: 'x' })).ok).toBe(false);
    expect((await run('plan_workout', { dateKey: '2026-02-30', name: 'x', exercises: [BENCH] })).ok).toBe(false);
    expect(await run('plan_workout', { dateKey: '2026-11-01', name: 'x', exercises: [BENCH], planId: 'nope' })).toEqual({
      ok: false,
      error: 'No plan with id nope.',
    });
  });

  it('lists plans in date order within a range', async () => {
    fs.put(PLANS, {
      plans: [
        { ...existing, id: 'b', dateKey: '2026-11-05' },
        { ...existing, id: 'a', dateKey: '2026-11-01' },
        { ...existing, id: 'c', dateKey: '2026-12-01' },
      ],
    });
    const r = await ok('list_plans', { from: '2026-11-01', to: '2026-11-30' });
    expect((r.plans as { id: string }[]).map((p) => p.id)).toEqual(['a', 'b']);
  });
});

describe('profile tools', () => {
  it('updates display and training fields only, keeping other preferences', async () => {
    const r = await ok('update_profile', { preferences: { weightUnit: 'kg' } });
    expect(r.preferences).toMatchObject({ weightUnit: 'kg', defaultRestTime: 90, theme: 'dark' });
    expect(fs.read(['users', UID])).toMatchObject({ email: 'owner@example.com', displayName: 'Owner', stats: { totalWorkouts: 4 } });
  });

  it('refuses email, stats, photo and auth fields', async () => {
    for (const input of [{ email: 'x@y' }, { stats: {} }, { photoURL: 'x' }, { preferences: { allowList: 'x' } }]) {
      expect((await run('update_profile', input)).ok).toBe(false);
    }
  });

  it('does not create a profile that the app never made', async () => {
    const data = new UserData(fs.client(), 'brandNewUid', () => NOW);
    expect(await runAgentTool('update_profile', { displayName: 'x' }, { data })).toEqual({
      ok: false,
      error: 'No profile yet: sign in to the app once first.',
    });
  });
});

describe('list_history', () => {
  it('pages finished workouts newest first, read only', async () => {
    for (let i = 1; i <= 3; i++) {
      fs.put(['users', UID, 'workout_history', `h${i}`], {
        name: `W${i}`,
        startTime: new Date(`2026-10-0${i}T10:00:00Z`),
        endTime: new Date(`2026-10-0${i}T11:00:00Z`),
        duration: 60,
        totalSets: 10,
        exercisesSummary: [{ exerciseName: 'Bench', sets: 3, reps: 24, volume: 3000 }],
      });
    }
    const writes = () =>
      fs.requests.filter((r) => r.method === 'PATCH' || (r.method === 'POST' && !(r.body as { structuredQuery?: unknown })?.structuredQuery)).length;
    const page1 = await ok('list_history', { pageSize: 2 });
    expect((page1.items as { name: string }[]).map((w) => w.name)).toEqual(['W3', 'W2']);
    expect((page1.items as { endTime: string }[])[0].endTime).toBe('2026-10-03T11:00:00.000Z');
    const page2 = await ok('list_history', { pageSize: 2, pageToken: page1.nextPageToken });
    expect((page2.items as { name: string }[]).map((w) => w.name)).toEqual(['W1']);
    expect(writes()).toBe(0);
  });
});

describe('add_exercise', () => {
  it('adds a custom exercise the app can list', async () => {
    const r = await ok('add_exercise', {
      name: 'Hammer Iso Row',
      muscleGroups: ['Back', 'Biceps'],
      equipment: 'Machine',
      setupCues: ['Seat 4'],
      defaultSets: 3,
      defaultReps: 10,
    });
    const stored = fs.read(['users', UID, 'customExercises', r.id as string])!;
    expect(stored).toMatchObject({
      name: 'Hammer Iso Row',
      muscleGroup: 'Back, Biceps',
      instructions: ['Seat 4'],
      notes: 'Default: 3 x 10',
      usageCount: 1,
      isCustom: true,
      userId: UID,
    });
  });
});
