import { beforeEach, describe, expect, it } from 'vitest';
import { FakeFirestore } from '../data/testing/fakeFirestore';
import { UserData } from '../data/userData';
import { fallbackExerciseId } from '../data/shapes';
import { resolveExercise } from '../data/exerciseIndex';
import { agentTools, runAgentTool } from './registry';
import { fakeR2 } from '../media/testing/fakeR2';
import { memoryKv } from '../mcp/testing/memoryKv';

const UID = 'ownerUid123';
const OTHER = 'someoneElse456';
const NOW = new Date('2026-10-30T12:00:00.000Z');

let fs: FakeFirestore;
let ctx: { data: UserData };
let ids: number;
let r2Bucket: ReturnType<typeof fakeR2>;
let kvNamespace: ReturnType<typeof memoryKv>;
let fetchMock: (url: string | URL | Request, init?: RequestInit) => Promise<Response>;

beforeEach(() => {
  fs = new FakeFirestore();
  r2Bucket = fakeR2();
  kvNamespace = memoryKv();
  fetchMock = async () => new Response('not found', { status: 404 });
  ids = 0;
  ctx = {
    data: new UserData(
      fs.client(),
      UID,
      () => NOW,
      () => `plan-${++ids}`,
      {
        r2: r2Bucket,
        kv: kvNamespace,
        origin: 'https://workout-ai.test',
        fetchImpl: (url, init) => fetchMock(url, init),
      },
    ),
  };
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
  it('has the seventeen tools with model-facing descriptions', () => {
    expect(agentTools.map((t) => t.name)).toEqual([
      'get_profile', 'update_profile', 'list_workouts', 'get_workout', 'create_workout',
      'update_workout', 'list_plans', 'plan_workout', 'list_history', 'get_history_entry',
      'log_workout', 'update_history_entry', 'add_exercise',
      'search_exercises', 'update_exercise', 'attach_media_from_url', 'create_media_upload_link',
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
      ['get_history_entry', { workoutId: 'wh1', uid: OTHER }],
      ['log_workout', { date: '2026-10-25', uid: OTHER, exercises: [{ name: 'Bench', sets: [{ reps: 8 }] }] }],
      ['update_history_entry', { workoutId: 'wh1', uid: OTHER }],
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
      const rHist = await run('get_history_entry', { workoutId });
      expect(rHist.ok).toBe(false);
      const rUp = await run('update_history_entry', { workoutId });
      expect(rUp.ok).toBe(false);
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

describe('log_workout', () => {
  it('writes workout_history and exercise_history docs identical to the app, and updates stats/PRs', async () => {
    const r = await ok('log_workout', {
      date: '2026-10-25',
      name: 'Push Day',
      durationMinutes: 45,
      exercises: [
        {
          name: 'Bench Press',
          sets: [
            { reps: 8, weight: 185 },
            { reps: 8, weight: 185 },
            { reps: 8, weight: 185 },
          ],
        },
        {
          name: 'Incline Dumbbell Press',
          sets: [
            { reps: 10, weight: 60 },
            { reps: 10, weight: 60 },
          ],
        },
      ],
    });
    expect(r.name).toBe('Push Day');
    expect(r.durationMinutes).toBe(45);
    expect(r.totalSets).toBe(5);
    expect(r.totalReps).toBe(44);
    expect(r.totalVolume).toBe(3 * (8 * 185) + 2 * (10 * 60));
    const exercises = r.exercises as Record<string, unknown>[];
    expect(exercises).toHaveLength(2);
    expect(exercises[0]).toMatchObject({
      exerciseName: 'Bench Press',
      configuration: '3x8',
      totalVolume: 4440,
    });
    expect((exercises[0].sets as unknown[])).toHaveLength(3);

    const storedSummary = fs.read(['users', UID, 'workout_history', r.id as string])!;
    expect(storedSummary).toMatchObject({
      userId: UID,
      name: 'Push Day',
      workoutId: r.id,
      duration: 45,
      totalExercises: 2,
      totalSets: 5,
      totalReps: 44,
      totalVolume: 5640,
    });

    expect('notes' in storedSummary).toBe(false);

    const benchMatch = resolveExercise('Bench Press')!;
    const benchHistDoc = fs.read(['users', UID, 'exercise_history', (exercises[0] as { id: string }).id])!;
    expect(benchHistDoc.exerciseId).toBe(benchMatch.id);
    expect(benchHistDoc.muscleGroups).toEqual(benchMatch.muscleGroups);
    expect(benchHistDoc.equipment).toBe(benchMatch.equipment);

    const benchStats = fs.read(['users', UID, 'exercise_stats', benchMatch.id])!;
    expect(benchStats).toMatchObject({
      exerciseName: benchMatch.matchedName,
      totalSessions: 1,
      totalSets: 3,
      totalReps: 24,
      totalVolume: 4440,
      maxWeight: 185,
      maxReps: 8,
      avgWeight: 185,
      avgReps: 8,
      personalRecords: {
        maxWeight: { weight: 185 },
        maxReps: { reps: 8 },
        maxVolume: { volume: 4440 },
      },
    });

    // Logging a second session sets new PRs
    await ok('log_workout', {
      date: '2026-10-28',
      name: 'Heavy Push',
      exercises: [
        {
          name: 'Bench Press',
          sets: [{ reps: 5, weight: 205 }],
        },
      ],
    });
    const benchStats2 = fs.read(['users', UID, 'exercise_stats', benchMatch.id])!;
    expect(benchStats2).toMatchObject({
      totalSessions: 2,
      totalSets: 4,
      totalReps: 29,
      maxWeight: 205,
      maxReps: 8,
      personalRecords: {
        maxWeight: { weight: 205 },
      },
    });
  });

  it('refuses future dates', async () => {
    const r = await run('log_workout', {
      date: '2026-10-31',
      name: 'Future Push',
      exercises: [{ name: 'Bench Press', sets: [{ reps: 5, weight: 205 }] }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/future/i);
  });

  it('refuses exercises whose sets are all completed: false', async () => {
    const r = await run('log_workout', {
      date: '2026-10-25',
      name: 'Uncompleted Sets',
      exercises: [{ name: 'Bench Press', sets: [{ reps: 8, weight: 185, completed: false }] }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/must have at least one completed set/i);
  });
});

describe('get_history_entry', () => {
  it('reads one workout with all exercise sets and details by id', async () => {
    const logged = await ok('log_workout', {
      date: '2026-10-25',
      name: 'Pull Day',
      exercises: [
        { name: 'Row', sets: [{ reps: 8, weight: 135 }] },
      ],
    });
    const entry = await ok('get_history_entry', { workoutId: logged.id as string });
    expect(entry).toMatchObject({
      id: logged.id,
      name: 'Pull Day',
      totalExercises: 1,
      totalSets: 1,
      totalReps: 8,
      totalVolume: 1080,
    });
    const exercises = entry.exercises as Record<string, unknown>[];
    expect(exercises).toHaveLength(1);
    expect(exercises[0].exerciseName).toBe('Row');
    expect((exercises[0].sets as unknown[])).toHaveLength(1);
  });

  it('returns not-found for nonexistent or other user workout', async () => {
    const r = await run('get_history_entry', { workoutId: 'nope' });
    expect(r).toEqual({ ok: false, error: 'No workout history entry with id nope.' });
  });
});

describe('update_history_entry', () => {
  it('updates workout date/name, adds/removes/edits sets and exercises, and recomputes totals and stats', async () => {
    const created = await ok('log_workout', {
      date: '2026-10-25',
      name: 'Original Workout',
      exercises: [
        {
          name: 'Bench Press',
          sets: [{ reps: 8, weight: 185 }, { reps: 8, weight: 185 }],
        },
        {
          name: 'Tricep Pushdown',
          sets: [{ reps: 12, weight: 50 }],
        },
      ],
    });
    const workoutId = created.id as string;
    const initialExercises = created.exercises as { id: string; name: string }[];
    const benchId = initialExercises[0].id;
    const tricepDocId = initialExercises[1].id;

    // Update bench weight to 195, add a set to bench, remove Tricep Pushdown, add Overhead Extension
    const updated = await ok('update_history_entry', {
      workoutId,
      name: 'Fixed Push',
      removeExerciseIds: [tricepDocId],
      exercises: [
        {
          id: benchId,
          name: 'Bench Press',
          sets: [
            { reps: 8, weight: 195 },
            { reps: 8, weight: 195 },
            { reps: 8, weight: 195 },
          ],
        },
        {
          name: 'Overhead Extension',
          sets: [{ reps: 10, weight: 45 }],
        },
      ],
    });

    expect(updated).toMatchObject({
      name: 'Fixed Push',
      totalExercises: 2,
      totalSets: 4,
      totalReps: 34,
      totalVolume: 3 * (8 * 195) + 10 * 45,
    });

    // Check summary doc in Firestore
    const summary = fs.read(['users', UID, 'workout_history', workoutId])!;
    expect(summary).toMatchObject({
      name: 'Fixed Push',
      totalExercises: 2,
      totalSets: 4,
      totalReps: 34,
      totalVolume: 5130,
    });

    // Bench stats recomputed
    const benchMatch = resolveExercise('Bench Press')!;
    const benchStats = fs.read(['users', UID, 'exercise_stats', benchMatch.id])!;
    expect(benchStats).toMatchObject({
      totalSessions: 1,
      totalSets: 3,
      totalReps: 24,
      totalVolume: 4680,
      maxWeight: 195,
      personalRecords: {
        maxWeight: { weight: 195 },
      },
    });

    // Tricep Pushdown was removed, so its exercise_stats should be cleaned up
    const tricepMatch = resolveExercise('Tricep Pushdown');
    const tricepId = tricepMatch ? tricepMatch.id : fallbackExerciseId('Tricep Pushdown');
    const tricepStats = fs.read(['users', UID, 'exercise_stats', tricepId]);
    expect(tricepStats).toBeUndefined();
  });

  it('refuses cross-uid exercise ids and future dates', async () => {
    fs.put(['users', OTHER, 'exercise_history', 'otherEx1'], {
      exerciseName: 'Bench Press',
      sets: [{ reps: 10, weight: 200 }],
    });
    const created = await ok('log_workout', {
      date: '2026-10-25',
      name: 'Legs',
      exercises: [{ name: 'Squat', sets: [{ reps: 5, weight: 225 }] }],
    });
    const workoutId = created.id as string;

    // Cross-uid id in exercises
    const rCross = await run('update_history_entry', {
      workoutId,
      exercises: [{ id: 'otherEx1', name: 'Bench Press', sets: [{ reps: 8, weight: 185 }] }],
    });
    expect(rCross.ok).toBe(false);
    if (!rCross.ok) expect(rCross.error).toMatch(/does not belong/i);

    // Future date
    const rFuture = await run('update_history_entry', {
      workoutId,
      date: '2026-10-31',
    });
    expect(rFuture.ok).toBe(false);
    if (!rFuture.ok) expect(rFuture.error).toMatch(/future/i);
  });

  it('refuses exercise ids belonging to a different workout of the same user', async () => {
    const workout1 = await ok('log_workout', {
      date: '2026-10-24',
      name: 'Workout 1',
      exercises: [{ name: 'Row', sets: [{ reps: 8, weight: 135 }] }],
    });
    const workout2 = await ok('log_workout', {
      date: '2026-10-25',
      name: 'Workout 2',
      exercises: [{ name: 'Squat', sets: [{ reps: 5, weight: 225 }] }],
    });
    const exId1 = (workout1.exercises as { id: string }[])[0].id;

    const r = await run('update_history_entry', {
      workoutId: workout2.id as string,
      exercises: [{ id: exId1, name: 'Row', sets: [{ reps: 8, weight: 135 }] }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/does not belong to this workout/i);
  });

  it('refuses exercises whose sets are all completed: false in update', async () => {
    const created = await ok('log_workout', {
      date: '2026-10-25',
      name: 'Workout',
      exercises: [{ name: 'Bench', sets: [{ reps: 8, weight: 185 }] }],
    });
    const exId = (created.exercises as { id: string }[])[0].id;
    const r = await run('update_history_entry', {
      workoutId: created.id as string,
      exercises: [{ id: exId, name: 'Bench', sets: [{ reps: 8, weight: 185, completed: false }] }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/must have at least one completed set/i);
  });

  it('computes personal records for exercises added during update', async () => {
    const created = await ok('log_workout', {
      date: '2026-10-25',
      name: 'Initial Workout',
      exercises: [{ name: 'Bench Press', sets: [{ reps: 8, weight: 185 }] }],
    });
    const updated = await ok('update_history_entry', {
      workoutId: created.id as string,
      exercises: [
        { id: (created.exercises as { id: string }[])[0].id, name: 'Bench Press', sets: [{ reps: 8, weight: 185 }] },
        { name: 'Overhead Press', sets: [{ reps: 5, weight: 135 }] },
      ],
    });
    const ohpEx = (updated.exercises as { exerciseName: string; personalRecords: Record<string, boolean> }[]).find(
      (e) => e.exerciseName === 'Overhead Press',
    );
    expect(ohpEx).toBeDefined();
    expect(ohpEx?.personalRecords).toMatchObject({
      maxWeight: true,
      maxReps: true,
      maxVolume: true,
    });
  });

  it('safe partial update preserves unlisted exercises in the workout unless removeExerciseIds is specified', async () => {
    const created = await ok('log_workout', {
      date: '2026-10-25',
      name: 'Full Body',
      exercises: [
        { name: 'Bench Press', sets: [{ reps: 8, weight: 185 }] },
        { name: 'Squat', sets: [{ reps: 5, weight: 225 }] },
      ],
    });
    const workoutId = created.id as string;
    const benchDocId = (created.exercises as { id: string }[])[0].id;

    // Update only Bench Press, without mentioning Squat or removeExerciseIds
    const updated = await ok('update_history_entry', {
      workoutId,
      exercises: [
        { id: benchDocId, name: 'Bench Press', sets: [{ reps: 10, weight: 185 }] },
      ],
    });

    // Both exercises must still be present
    expect(updated.totalExercises).toBe(2);
    const exNames = (updated.exercises as { exerciseName: string }[]).map((e) => e.exerciseName);
    expect(exNames).toContain('Bench Press');
    expect(exNames).toContain('Squat');
  });

  it('supports replaceAllExercises: true to explicitly replace all exercises', async () => {
    const created = await ok('log_workout', {
      date: '2026-10-25',
      name: 'Full Body',
      exercises: [
        { name: 'Bench Press', sets: [{ reps: 8, weight: 185 }] },
        { name: 'Squat', sets: [{ reps: 5, weight: 225 }] },
      ],
    });
    const workoutId = created.id as string;

    // Pass replaceAllExercises: true with only Bench Press
    const updated = await ok('update_history_entry', {
      workoutId,
      replaceAllExercises: true,
      exercises: [
        { name: 'Bench Press', sets: [{ reps: 10, weight: 185 }] },
      ],
    });

    expect(updated.totalExercises).toBe(1);
    const exNames = (updated.exercises as { exerciseName: string }[]).map((e) => e.exerciseName);
    expect(exNames).toEqual(['Bench Press']);
  });

  it('supports explicit set operations addSets and removeSetNumbers', async () => {
    const created = await ok('log_workout', {
      date: '2026-10-25',
      name: 'Bench Session',
      exercises: [
        {
          name: 'Bench Press',
          sets: [
            { reps: 10, weight: 135 },
            { reps: 8, weight: 185 },
            { reps: 5, weight: 205 },
          ],
        },
      ],
    });
    const workoutId = created.id as string;
    const benchDocId = (created.exercises as { id: string }[])[0].id;

    // Remove set 1 (the warm-up) and add a set of 225x3
    const updated = await ok('update_history_entry', {
      workoutId,
      exercises: [
        {
          id: benchDocId,
          name: 'Bench Press',
          removeSetNumbers: [1],
          addSets: [{ reps: 3, weight: 225 }],
        },
      ],
    });

    const bench = (updated.exercises as { exerciseName: string; sets: { setNumber: number; reps: number; weight: number }[] }[])[0];
    expect(bench.sets).toHaveLength(3);
    expect(bench.sets[0]).toMatchObject({ setNumber: 1, actualReps: 8, weight: 185 });
    expect(bench.sets[1]).toMatchObject({ setNumber: 2, actualReps: 5, weight: 205 });
    expect(bench.sets[2]).toMatchObject({ setNumber: 3, actualReps: 3, weight: 225 });
  });

  it('validates local dates using tz or utcOffset', async () => {
    // NOW is '2026-10-30T12:00:00.000Z'
    // In Asia/Tokyo (UTC+9), NOW is 2026-10-30 21:00.
    // Logging for today ('2026-10-30') with tz succeeds.
    const valid = await ok('log_workout', {
      date: '2026-10-30',
      tz: 'Asia/Tokyo',
      name: 'Tokyo Workout',
      exercises: [{ name: 'Bench Press', sets: [{ reps: 5, weight: 135 }] }],
    });
    expect(valid.name).toBe('Tokyo Workout');

    // Logging tomorrow ('2026-10-31') with tz fails.
    const future = await run('log_workout', {
      date: '2026-10-31',
      tz: 'Asia/Tokyo',
      name: 'Future Tokyo',
      exercises: [{ name: 'Bench Press', sets: [{ reps: 5, weight: 135 }] }],
    });
    expect(future.ok).toBe(false);
    if (!future.ok) expect(future.error).toMatch(/future/i);
  });

  it('reports unmatched exercises in tool result and uses fallback id', async () => {
    const r = await ok('log_workout', {
      date: '2026-10-25',
      name: 'Mystery Workout',
      exercises: [
        { name: 'Bench Press', sets: [{ reps: 8, weight: 185 }] },
        { name: 'Zorblaxian Space Wobble', sets: [{ reps: 10, weight: 50 }] },
      ],
    });
    expect(r.unmatchedExercises).toEqual(['Zorblaxian Space Wobble']);

    const zorblaxId = fallbackExerciseId('Zorblaxian Space Wobble');
    const exercises = r.exercises as { id: string; exerciseName: string }[];
    const zorblaxDocId = exercises.find((e) => e.exerciseName === 'Zorblaxian Space Wobble')!.id;
    const zorblaxDoc = fs.read(['users', UID, 'exercise_history', zorblaxDocId])!;
    expect(zorblaxDoc.exerciseId).toBe(zorblaxId);
    expect(zorblaxDoc.muscleGroups).toEqual(['Unknown']);
    expect(zorblaxDoc.equipment).toBe('Unknown');
  });

  it('resolves custom exercises created via add_exercise', async () => {
    await ok('add_exercise', {
      name: 'Hammer Strength V-Squat',
      muscleGroups: ['Quads', 'Glutes'],
      equipment: 'Machine',
    });

    const logged = await ok('log_workout', {
      date: '2026-10-25',
      name: 'Leg Day',
      exercises: [{ name: 'Hammer Strength V-Squat', sets: [{ reps: 10, weight: 200 }] }],
    });
    expect(logged.unmatchedExercises).toBeUndefined();

    const exHistDocId = (logged.exercises as { id: string }[])[0].id;
    const exHistDoc = fs.read(['users', UID, 'exercise_history', exHistDocId])!;
    expect(exHistDoc.muscleGroups).toEqual(['Quads', 'Glutes']);
    expect(exHistDoc.equipment).toBe('Machine');
    expect(exHistDoc.exerciseId).not.toMatch(/^fallback-/);
  });

  it('updates workoutDate and workoutName for unlisted exercises when date or name changes with a partial exercise list', async () => {
    const created = await ok('log_workout', {
      date: '2026-10-25',
      name: 'Original Workout',
      exercises: [
        { name: 'Bench Press', sets: [{ reps: 8, weight: 185 }] },
        { name: 'Squat', sets: [{ reps: 5, weight: 225 }] },
      ],
    });
    const workoutId = created.id as string;
    const initialExercises = created.exercises as { id: string; exerciseName: string }[];
    const benchDocId = initialExercises.find((e) => e.exerciseName === 'Bench Press')!.id;
    const squatDocId = initialExercises.find((e) => e.exerciseName === 'Squat')!.id;

    // Update with new date 2026-10-20, new name 'Updated Workout', and only Bench Press in exercises
    const updated = await ok('update_history_entry', {
      workoutId,
      date: '2026-10-20',
      name: 'Updated Workout',
      exercises: [
        { id: benchDocId, name: 'Bench Press', sets: [{ reps: 10, weight: 185 }] },
      ],
    });

    expect(updated.name).toBe('Updated Workout');
    expect(new Date(updated.startTime as string).toISOString().slice(0, 10)).toBe('2026-10-20');

    // Both Bench Press AND Squat must have the updated workoutDate and workoutName
    const benchDoc = fs.read(['users', UID, 'exercise_history', benchDocId])!;
    expect(new Date(benchDoc.workoutDate as string).toISOString().slice(0, 10)).toBe('2026-10-20');
    expect(benchDoc.workoutName).toBe('Updated Workout');

    const squatDoc = fs.read(['users', UID, 'exercise_history', squatDocId])!;
    expect(new Date(squatDoc.workoutDate as string).toISOString().slice(0, 10)).toBe('2026-10-20');
    expect(squatDoc.workoutName).toBe('Updated Workout');

    // Stats for both Bench and Squat must be recomputed with the new date
    const benchStats = fs.read(['users', UID, 'exercise_stats', benchDoc.exerciseId as string])!;
    expect(new Date(benchStats.lastPerformed as string).toISOString().slice(0, 10)).toBe('2026-10-20');

    const squatStats = fs.read(['users', UID, 'exercise_stats', squatDoc.exerciseId as string])!;
    expect(new Date(squatStats.lastPerformed as string).toISOString().slice(0, 10)).toBe('2026-10-20');
  });

  it('rejects workout-level notes while accepting and persisting exercise and set notes', async () => {
    // Workout-level notes rejected on log_workout
    const rLogNotes = await run('log_workout', {
      date: '2026-10-25',
      notes: 'Session notes are not on workout_history',
      exercises: [{ name: 'Bench Press', sets: [{ reps: 8, weight: 185 }] }],
    });
    expect(rLogNotes.ok).toBe(false);
    if (!rLogNotes.ok) expect(rLogNotes.error).toMatch(/unrecognized key/i);

    // Workout-level notes rejected on update_history_entry
    const valid = await ok('log_workout', {
      date: '2026-10-25',
      exercises: [
        {
          name: 'Bench Press',
          notes: 'Felt good on chest',
          sets: [{ reps: 8, weight: 185, notes: 'Paused rep' }],
        },
      ],
    });
    const workoutId = valid.id as string;

    const rUpNotes = await run('update_history_entry', {
      workoutId,
      notes: 'New session note',
    });
    expect(rUpNotes.ok).toBe(false);
    if (!rUpNotes.ok) expect(rUpNotes.error).toMatch(/unrecognized key/i);

    // Notes on exercise and sets are properly saved
    const exHistId = (valid.exercises as { id: string }[])[0].id;
    const exDoc = fs.read(['users', UID, 'exercise_history', exHistId])!;
    expect(exDoc.notes).toBe('Felt good on chest');
    const sets = exDoc.sets as { notes?: string }[];
    expect(sets[0].notes).toBe('Paused rep');
  });

  it('validates all changes before writing and does not leave partial mutations on error', async () => {
    const created = await ok('log_workout', {
      date: '2026-10-25',
      name: 'Two Exercise Session',
      exercises: [
        { name: 'Bench Press', sets: [{ reps: 8, weight: 185 }] },
        { name: 'Squat', sets: [{ reps: 5, weight: 225 }] },
      ],
    });
    const workoutId = created.id as string;
    const initialExercises = created.exercises as { id: string; exerciseName: string }[];
    const benchDocId = initialExercises.find((e) => e.exerciseName === 'Bench Press')!.id;
    const squatDocId = initialExercises.find((e) => e.exerciseName === 'Squat')!.id;

    // Attempt to remove Bench AND remove set 1 from Squat (leaving Squat with 0 sets)
    const r = await run('update_history_entry', {
      workoutId,
      removeExerciseIds: [benchDocId],
      exercises: [
        {
          id: squatDocId,
          name: 'Squat',
          removeSetNumbers: [1],
        },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/must have at least one completed set/i);

    // Bench Press must NOT have been deleted because validation happens before writes
    const benchDoc = fs.read(['users', UID, 'exercise_history', benchDocId]);
    expect(benchDoc).toBeDefined();

    // Squat must still have its set
    const squatDoc = fs.read(['users', UID, 'exercise_history', squatDocId])!;
    expect((squatDoc.sets as unknown[])).toHaveLength(1);
  });

  it('returns exercises in get_history_entry in the user-dictated order', async () => {
    const created = await ok('log_workout', {
      date: '2026-10-25',
      name: 'Full Routine',
      exercises: [
        { name: 'Lat Pulldown', sets: [{ reps: 10, weight: 120 }] },
        { name: 'Bench Press', sets: [{ reps: 8, weight: 185 }] },
        { name: 'Squat', sets: [{ reps: 5, weight: 225 }] },
      ],
    });
    const workoutId = created.id as string;

    const entry = await ok('get_history_entry', { workoutId });
    const exNames = (entry.exercises as { exerciseName: string }[]).map((e) => e.exerciseName);
    expect(exNames).toEqual(['Lat Pulldown', 'Bench Press', 'Squat']);

    // Partial update to Lat Pulldown preserves the order
    const latId = (entry.exercises as { id: string }[])[0].id;
    const updated = await ok('update_history_entry', {
      workoutId,
      exercises: [{ id: latId, name: 'Lat Pulldown', sets: [{ reps: 12, weight: 130 }] }],
    });
    const updatedExNames = (updated.exercises as { exerciseName: string }[]).map((e) => e.exerciseName);
    expect(updatedExNames).toEqual(['Lat Pulldown', 'Bench Press', 'Squat']);

    // replaceAllExercises reorders according to input
    const reordered = await ok('update_history_entry', {
      workoutId,
      replaceAllExercises: true,
      exercises: [
        { name: 'Squat', sets: [{ reps: 5, weight: 225 }] },
        { name: 'Bench Press', sets: [{ reps: 8, weight: 185 }] },
      ],
    });
    const reorderedNames = (reordered.exercises as { exerciseName: string }[]).map((e) => e.exerciseName);
    expect(reorderedNames).toEqual(['Squat', 'Bench Press']);
  });
});

describe('list_history paging and date range', () => {
  it('pages through 3 pages using cursor/nextPageToken and filters by date range', async () => {
    // Seed 5 workouts on consecutive days
    for (let i = 1; i <= 5; i++) {
      fs.put(['users', UID, 'workout_history', `wh${i}`], {
        name: `Day ${i}`,
        startTime: new Date(`2026-10-0${i}T10:00:00Z`),
        endTime: new Date(`2026-10-0${i}T11:00:00Z`),
        duration: 60,
        totalSets: 5,
        totalReps: 50,
        totalVolume: 5000,
        exercisesSummary: [{ exerciseId: 'bench', exerciseName: 'Bench', sets: 5, reps: 50, volume: 5000 }],
      });
    }

    // Page 1
    const p1 = await ok('list_history', { pageSize: 2 });
    expect((p1.items as { name: string }[]).map((w) => w.name)).toEqual(['Day 5', 'Day 4']);
    expect(p1.nextPageToken).toBe('2');

    // Page 2
    const p2 = await ok('list_history', { pageSize: 2, pageToken: p1.nextPageToken });
    expect((p2.items as { name: string }[]).map((w) => w.name)).toEqual(['Day 3', 'Day 2']);
    expect(p2.nextPageToken).toBe('4');

    // Page 3
    const p3 = await ok('list_history', { pageSize: 2, cursor: p2.nextPageToken });
    expect((p3.items as { name: string }[]).map((w) => w.name)).toEqual(['Day 1']);
    expect(p3.nextPageToken).toBeUndefined();

    // Date range: from Oct 2 to Oct 4
    const ranged = await ok('list_history', { from: '2026-10-02', to: '2026-10-04' });
    expect((ranged.items as { name: string }[]).map((w) => w.name)).toEqual(['Day 4', 'Day 3', 'Day 2']);
  });
});

describe('list_workouts and get_workout superset count', () => {
  it('counts 9 not 12 for a fixture like Pull Day Seal Row Oct 1', async () => {
    fs.put(['users', UID, 'savedWorkouts', 'sw-seal-row'], {
      name: 'Pull Day Seal Row Oct 1',
      userId: UID,
      parsedWorkout: {
        _dataFormat: 'serialized_v1',
        exercises: [
          { name: 'Machine Plate Loaded Seal Row', sets: [{ reps: 8, weight: 160 }] },
          { name: 'Lat Pulldown', sets: [{ reps: 10, weight: 140 }] },
          { name: 'Face Pull', sets: [{ reps: 15, weight: 50 }] },
          {
            name: 'Barbell Curl + Overhead Tricep Extension',
            isSuperset: true,
            sets: [{ reps: 10, weight: 65 }],
            supersetExercises: [
              { name: 'Barbell Curl', sets: [{ reps: 10, weight: 65 }] },
              { name: 'Overhead Tricep Extension', sets: [{ reps: 10, weight: 50 }] },
            ],
          },
          {
            name: 'Hammer Curl + Lateral Raise',
            isSuperset: true,
            sets: [{ reps: 12, weight: 30 }],
            supersetExercises: [
              { name: 'Hammer Curl', sets: [{ reps: 12, weight: 30 }] },
              { name: 'Lateral Raise', sets: [{ reps: 12, weight: 20 }] },
            ],
          },
          {
            name: 'Shrug + Wrist Curl',
            isSuperset: true,
            sets: [{ reps: 15, weight: 80 }],
            supersetExercises: [
              { name: 'Shrug', sets: [{ reps: 15, weight: 80 }] },
              { name: 'Wrist Curl', sets: [{ reps: 15, weight: 40 }] },
            ],
          },
        ],
        supersets_serialized: JSON.stringify([
          [
            { name: 'Barbell Curl', sets: [{ reps: 10, weight: 65 }] },
            { name: 'Overhead Tricep Extension', sets: [{ reps: 10, weight: 50 }] },
          ],
          [
            { name: 'Hammer Curl', sets: [{ reps: 12, weight: 30 }] },
            { name: 'Lateral Raise', sets: [{ reps: 12, weight: 20 }] },
          ],
          [
            { name: 'Shrug', sets: [{ reps: 15, weight: 80 }] },
            { name: 'Wrist Curl', sets: [{ reps: 15, weight: 40 }] },
          ],
        ]),
      },
      updatedAt: NOW,
    });

    const list = await ok('list_workouts', {});
    const items = list.items as { id: string; exerciseCount: number; exerciseNames: string[] }[];
    const item = items.find((i) => i.id === 'sw-seal-row')!;
    expect(item.exerciseCount).toBe(9);
    expect(item.exerciseNames).toHaveLength(9);
    expect(item.exerciseNames).not.toContain('Barbell Curl + Overhead Tricep Extension');

    const workout = await ok('get_workout', { workoutId: 'sw-seal-row' });
    expect((workout.exercises as unknown[])).toHaveLength(3);
    expect((workout.supersets as unknown[])).toHaveLength(3);
  });
});


describe('search_exercises', () => {
  it('searches the library and finds exercises', async () => {
    const res = await ok('search_exercises', { query: 'Bench Press' });
    const exercises = res.exercises as { id: string; name: string; custom: boolean; isCustom: boolean }[];
    expect(exercises.length).toBeGreaterThan(0);
    const bench = exercises.find((e) => e.name.toLowerCase().includes('bench press'));
    expect(bench).toBeDefined();
    expect(bench?.custom).toBe(false);
  });

  it('searches custom exercises and returns mediaUrl', async () => {
    const added = await ok('add_exercise', {
      name: 'Custom Belt Squat Deluxe',
      muscleGroups: ['Quads', 'Glutes'],
      equipment: 'Machine',
      media_url: 'https://workout-ai.test/media/ownerUid123/deluxe.mp4',
    });
    expect(added.id).toBeDefined();

    const res = await ok('search_exercises', { query: 'Deluxe' });
    const exercises = res.exercises as { id: string; name: string; custom: boolean; mediaUrl?: string }[];
    const found = exercises.find((e) => e.id === added.id);
    expect(found).toBeDefined();
    expect(found?.custom).toBe(true);
    expect(found?.mediaUrl).toBe('https://workout-ai.test/media/ownerUid123/deluxe.mp4');
  });
});

describe('add_exercise duplicate refusal', () => {
  it('refuses near-duplicate of a library exercise and returns match', async () => {
    const res = await run('add_exercise', {
      name: 'Barbell Bench Press',
      muscleGroups: ['Chest'],
      equipment: 'Barbell',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/already exists as a library exercise/);
      expect(res.match).toMatchObject({
        isCustom: false,
        name: expect.any(String),
      });
    }
  });

  it('refuses near-duplicate of an existing custom exercise and returns match', async () => {
    await ok('add_exercise', {
      name: 'Custom Hack Squat Pro',
      muscleGroups: ['Quads'],
      equipment: 'Machine',
    });

    const dup = await run('add_exercise', {
      name: 'custom hack squat pro',
      muscleGroups: ['Quads'],
      equipment: 'Machine',
    });
    expect(dup.ok).toBe(false);
    if (!dup.ok) {
      expect(dup.error).toMatch(/already exists as a custom exercise/);
      expect(dup.match).toMatchObject({
        isCustom: true,
        name: 'Custom Hack Squat Pro',
      });
    }
  });

  it('accepts media_url and persists it to videoLinks', async () => {
    const created = await ok('add_exercise', {
      name: 'Custom Gym Contraption 42',
      muscleGroups: ['Quads'],
      equipment: 'Machine',
      media_url: 'https://workout-ai.test/media/ownerUid123/pendulum.mp4',
    });
    expect(created.videoLinks).toEqual(['https://workout-ai.test/media/ownerUid123/pendulum.mp4']);
    const doc = fs.read(['users', UID, 'customExercises', created.id as string]) as Record<string, unknown>;
    expect(doc.videoLinks).toEqual(['https://workout-ai.test/media/ownerUid123/pendulum.mp4']);
  });
});

describe('update_exercise', () => {
  it('updates custom exercise fields and refuses non-custom exercises', async () => {
    const added = await ok('add_exercise', {
      name: 'Seal Row Bench',
      muscleGroups: ['Back'],
      equipment: 'Bench',
    });

    const updated = await ok('update_exercise', {
      exercise_id: added.id,
      name: 'Seal Row Heavy Bench',
      muscles: ['Back', 'Biceps'],
      notes: 'Chest flat against pad',
      media: 'https://workout-ai.test/media/ownerUid123/seal.mp4',
    });
    expect(updated.name).toBe('Seal Row Heavy Bench');
    expect(updated.muscleGroup).toBe('Back, Biceps');
    expect(updated.videoLinks).toEqual(['https://workout-ai.test/media/ownerUid123/seal.mp4']);

    // Non-existent exercise
    const notFound = await run('update_exercise', {
      exercise_id: 'nonexistent123',
      name: 'Whatever',
    });
    expect(notFound.ok).toBe(false);
    if (!notFound.ok) expect(notFound.error).toMatch(/No custom exercise with id nonexistent123/);
  });

  it('refuses updating to a duplicate library or custom name', async () => {
    const added = await ok('add_exercise', {
      name: 'Custom Preacher Curl 9000',
      muscleGroups: ['Biceps'],
      equipment: 'Machine',
    });

    const dupLib = await run('update_exercise', {
      exercise_id: added.id,
      name: 'Barbell Bench Press',
    });
    expect(dupLib.ok).toBe(false);
    if (!dupLib.ok) {
      expect(dupLib.error).toMatch(/already exists as a library exercise/);
      expect(dupLib.match).toBeDefined();
    }
  });
});

describe('attach_media_from_url', () => {
  it('refuses non-https URL, oversize files, and wrong types', async () => {
    const added = await ok('add_exercise', {
      name: 'Nordic Hamstring Station',
      muscleGroups: ['Hamstrings'],
      equipment: 'Bench',
    });

    // 1. Non-https URL
    const nonHttps = await run('attach_media_from_url', {
      exercise_id: added.id,
      url: 'http://example.com/demo.mp4',
    });
    expect(nonHttps.ok).toBe(false);
    if (!nonHttps.ok) expect(nonHttps.error).toMatch(/https/i);

    // 2. Oversize photo (> 8MB)
    const oversizeJpeg = new Uint8Array(9 * 1024 * 1024);
    oversizeJpeg.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    fetchMock = async () => new Response(oversizeJpeg, { status: 200, headers: { 'content-type': 'image/jpeg' } });

    const oversize = await run('attach_media_from_url', {
      exercise_id: added.id,
      url: 'https://example.com/huge.jpg',
    });
    expect(oversize.ok).toBe(false);
    if (!oversize.ok) expect(oversize.error).toMatch(/exceeds limit/i);

    // 3. Wrong type (e.g. plain text / html)
    fetchMock = async () => new Response(new TextEncoder().encode('<html>not media</html>'), { status: 200 });
    const wrongType = await run('attach_media_from_url', {
      exercise_id: added.id,
      url: 'https://example.com/page.html',
    });
    expect(wrongType.ok).toBe(false);
    if (!wrongType.ok) expect(wrongType.error).toMatch(/Unsupported media type/i);
  });

  it('succeeds on valid media, saves to R2, and updates exercise videoLinks', async () => {
    const added = await ok('add_exercise', {
      name: 'Tibialis Trainer Pro',
      muscleGroups: ['Calves'],
      equipment: 'Machine',
    });

    const sampleMp4 = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x00, 0x00]);
    fetchMock = async () => new Response(sampleMp4, { status: 200, headers: { 'content-type': 'video/mp4' } });

    const res = await ok('attach_media_from_url', {
      exercise_id: added.id,
      url: 'https://example.com/demo.mp4',
    });
    expect(res.kind).toBe('video');
    expect(res.mediaUrl).toMatch(/^https:\/\/workout-ai\.test\/media\/ownerUid123\/[a-z0-9]+\.mp4$/);

    const doc = fs.read(['users', UID, 'customExercises', added.id as string]) as Record<string, unknown>;
    expect(doc.videoLinks).toEqual([res.mediaUrl]);
  });
});

describe('create_media_upload_link', () => {
  it('generates a 15-minute single-use upload link for custom exercise', async () => {
    const added = await ok('add_exercise', {
      name: 'Sissy Squat Bench Pro',
      muscleGroups: ['Quads'],
      equipment: 'Bench',
    });

    const res = await ok('create_media_upload_link', {
      exercise_id: added.id,
    });
    expect(res.uploadUrl).toMatch(/^https:\/\/workout-ai\.test\/upload\/[A-Za-z0-9_-]+$/);
    expect(res.expiresSeconds).toBe(900);

    // Refuses non-existent exercise
    const notFound = await run('create_media_upload_link', {
      exercise_id: 'missing999',
    });
    expect(notFound.ok).toBe(false);
  });
});

describe('log_workout with exercise id', () => {
  it('accepts exercises by id from add_exercise or search_exercises', async () => {
    const custom = await ok('add_exercise', {
      name: 'My Custom Belt Squat Loaded 3000',
      muscleGroups: ['Quads', 'Glutes'],
      equipment: 'Machine',
    });

    const logged = await ok('log_workout', {
      date: '2026-10-25',
      name: 'Snapshot Leg Day',
      exercises: [
        {
          id: custom.id,
          sets: [{ reps: 8, weight: 225 }],
        },
      ],
    });
    expect(logged.unmatchedExercises).toBeUndefined();

    const history = await ok('get_history_entry', { workoutId: logged.workoutId });
    const exercises = history.exercises as { exerciseId: string; exerciseName: string }[];
    expect(exercises[0].exerciseId).toBe(custom.id);
    expect(exercises[0].exerciseName).toBe('My Custom Belt Squat Loaded 3000');
  });
});
