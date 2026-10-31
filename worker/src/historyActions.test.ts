import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeFirestore } from './data/testing/fakeFirestore';
import { UserData } from './data/userData';
import { resolveExercise } from './data/exerciseIndex';
import { runAgentTool } from './agentTools/registry';
import { runHistoryAction } from './historyActions';
import { defaultActions, handleRequest, type Deps, type Env } from './index';

const UID = 'ownerUid123';
const OTHER = 'someoneElse456';
const NOW = new Date('2026-10-30T12:00:00.000Z');

type Op = Parameters<typeof runHistoryAction>[0];
type Entry = { name: string; startTime: string; exercises: Record<string, any>[] };

let fs: FakeFirestore;
let data: UserData;

const user = (uid: string) => ['users', uid];
const run = (op: Op, input: unknown) => runHistoryAction(op, input, data, fs.client());
const okRun = async (op: Op, input: unknown) => {
  const r = await run(op, input);
  if (!r.ok) throw new Error(r.error);
  return r;
};
const entry = async (workoutId: string) => {
  const r = await runAgentTool('get_history_entry', { workoutId }, { data });
  if (!r.ok) throw new Error(r.error);
  return r.result as Entry;
};
const shape = (e: Entry) =>
  e.exercises.map((x) => [
    x.exerciseName,
    x.sets.map((s: any) => [s.actualReps, s.weight, s.unit, s.rpe ?? null]),
    x.notes ?? null,
  ]);
const docsIn = (collection: string, uid = UID) =>
  [...fs.docs.keys()].filter((k) => k.startsWith(`users/${uid}/${collection}/`));

const BENCH = resolveExercise('Bench Press');
const SQUAT = resolveExercise('Squat');

const set = (n: number, reps: number, weight: number, rpe?: number) => ({
  setNumber: n, targetReps: reps, actualReps: reps, weight, unit: 'lbs', completed: true, ...(rpe ? { rpe } : {}),
});

/**
 * A session shaped like the app's own: the summary document id (`sumDoc1`)
 * differs from the `workoutId` its exercise documents carry (`sess1`).
 */
function seedAppSession() {
  fs.put([...user(UID), 'workout_history', 'sumDoc1'], {
    userId: UID, name: 'Push Day', workoutId: 'sess1',
    startTime: new Date('2026-10-12T17:30:00.000Z'), endTime: new Date('2026-10-12T18:20:00.000Z'), duration: 50,
    totalExercises: 2, totalSets: 5, totalReps: 28, totalVolume: 5000,
    exercisesSummary: [
      { exerciseId: BENCH.id, exerciseName: 'Bench Press', sets: 3, reps: 18, volume: 3000 },
      { exerciseId: SQUAT.id, exerciseName: 'Squat', sets: 2, reps: 10, volume: 2000 },
    ],
  });
  fs.put([...user(UID), 'exercise_history', 'exA'], {
    userId: UID, workoutId: 'sess1', workoutName: 'Push Day', workoutDate: new Date('2026-10-12T17:30:00.000Z'),
    exerciseId: BENCH.id, exerciseName: 'Bench Press', configuration: '3x6',
    sets: [set(1, 6, 185, 7), set(2, 6, 185, 8), set(3, 6, 185, 9)], totalVolume: 3330,
    muscleGroups: BENCH.muscleGroups, equipment: BENCH.equipment, notes: 'felt strong',
  });
  fs.put([...user(UID), 'exercise_history', 'exB'], {
    userId: UID, workoutId: 'sess1', workoutName: 'Push Day', workoutDate: new Date('2026-10-12T17:30:00.000Z'),
    exerciseId: SQUAT.id, exerciseName: 'Squat', configuration: '2x5',
    sets: [set(1, 5, 225), set(2, 5, 235, 9)], totalVolume: 2300,
    muscleGroups: SQUAT.muscleGroups, equipment: SQUAT.equipment,
  });
}

beforeEach(() => {
  fs = new FakeFirestore();
  data = new UserData(fs.client(), UID, () => NOW, () => 'new-id-1');
  fs.put(user(UID), { email: 'owner@example.com', displayName: 'Owner', createdAt: NOW });
  fs.put([...user(OTHER), 'workout_history', 'theirs'], { name: 'Not yours', workoutId: 'theirs', startTime: NOW });
});

describe('history edit / undoEdit on app-shaped records', () => {
  const update = {
    name: 'Push Day (fixed)',
    date: '2026-10-20',
    exercises: [
      { id: 'exA', name: 'Bench Press', sets: [{ reps: 5, weight: 195 }, { reps: 5, weight: 195 }] },
      { name: 'Overhead Press', sets: [{ reps: 8, weight: 95 }] },
    ],
    removeExerciseIds: ['exB'],
  };

  it('returns the prior snapshot, applies the edit, and undo restores every set', async () => {
    seedAppSession();
    const before = shape(await entry('sumDoc1'));
    expect(before[0][1]).toHaveLength(3);

    const edited = await okRun('edit', { workoutId: 'sumDoc1', update });
    const prior = edited.prior as { name: string; date: string; exercises: { id: string; sets: unknown[] }[] };
    expect(prior.name).toBe('Push Day');
    expect(prior.date).toBe('2026-10-12');
    expect(prior.exercises.map((e) => e.id)).toEqual(['exA', 'exB']);
    expect(prior.exercises[0].sets).toHaveLength(3);

    const after = await entry('sumDoc1');
    expect(after.name).toBe('Push Day (fixed)');
    expect(after.startTime.slice(0, 10)).toBe('2026-10-20');
    expect(shape(after).map((x) => x[0])).toEqual(['Bench Press', 'Overhead Press']);
    expect(after.exercises[0].sets).toHaveLength(2);
    expect(fs.read([...user(UID), 'exercise_history', 'exB'])).toBeUndefined();

    await okRun('undoEdit', { workoutId: 'sumDoc1', prior });

    const restored = await entry('sumDoc1');
    expect(restored.name).toBe('Push Day');
    expect(restored.startTime.slice(0, 10)).toBe('2026-10-12');
    expect(shape(restored)).toEqual(before);
    // Same exercise document for Bench; Squat is back; the added Overhead Press is gone.
    expect(restored.exercises[0].id).toBe('exA');
    expect(docsIn('exercise_history')).toHaveLength(2);
    for (const k of docsIn('exercise_history')) {
      expect(fs.read(k.split('/'))!.workoutId).toBe('sess1');
    }
    // Stats follow the restored history.
    expect(fs.read([...user(UID), 'exercise_stats', BENCH.id])).toMatchObject({ totalSets: 3, maxWeight: 185 });
    expect(fs.read([...user(UID), 'exercise_stats', SQUAT.id])).toMatchObject({ totalSets: 2, maxWeight: 235 });
    expect(fs.read([...user(UID), 'exercise_stats', resolveExercise('Overhead Press').id])).toBeUndefined();
    // Nothing of another user was touched.
    expect(fs.requests.every((r) => r.path[0] !== 'users' || r.path[1] === UID)).toBe(true);
  });

  it('undo of a sets-only edit leaves the start time as it was', async () => {
    seedAppSession();
    const startBefore = (await entry('sumDoc1')).startTime;
    const edited = await okRun('edit', {
      workoutId: 'sumDoc1',
      update: { exercises: [{ id: 'exA', name: 'Bench Press', sets: [{ reps: 3, weight: 225 }] }] },
    });
    await okRun('undoEdit', { workoutId: 'sumDoc1', prior: edited.prior });
    expect((await entry('sumDoc1')).startTime).toBe(startBefore);
  });

  it('reports an unknown workout and writes nothing', async () => {
    const r = await run('edit', { workoutId: 'nope', update: { name: 'x' } });
    expect(r).toEqual({ ok: false, error: 'No workout history entry with id nope.' });
    expect(docsIn('workout_history')).toHaveLength(0);
  });

  it('rejects a prior or an update that names a user', async () => {
    seedAppSession();
    const r = await run('undoEdit', { workoutId: 'sumDoc1', prior: { uid: OTHER } });
    expect(r.ok).toBe(false);
    const r2 = await run('edit', { workoutId: 'sumDoc1', update: { name: 'x', uid: OTHER } });
    expect(r2.ok).toBe(false);
    expect((await entry('sumDoc1')).name).toBe('Push Day');
  });
});

describe('history log / undoLog', () => {
  const workout = {
    date: '2026-10-25',
    name: 'Pull Day',
    exercises: [
      { name: 'Bench Press', sets: [{ reps: 8, weight: 185 }, { reps: 8, weight: 185 }] },
      { name: 'Squat', sets: [{ reps: 5, weight: 225 }] },
    ],
  };

  it('log returns the created ids; undoLog leaves no summary or exercise docs', async () => {
    seedAppSession();
    const summaries = docsIn('workout_history').length;
    const exercises = docsIn('exercise_history').length;

    const logged = await okRun('log', workout);
    expect(logged.workoutId).toBe('new-id-1');
    expect(logged.exerciseIds as string[]).toHaveLength(2);
    expect(docsIn('workout_history')).toHaveLength(summaries + 1);
    expect(docsIn('exercise_history')).toHaveLength(exercises + 2);

    await okRun('undoLog', { workoutId: logged.workoutId, exerciseIds: logged.exerciseIds });

    expect(fs.read([...user(UID), 'workout_history', 'new-id-1'])).toBeUndefined();
    expect(docsIn('workout_history')).toHaveLength(summaries);
    expect(docsIn('exercise_history')).toHaveLength(exercises);
    // The earlier session's exercises are still the only history behind the stats.
    expect(fs.read([...user(UID), 'exercise_stats', BENCH.id])).toMatchObject({ totalSessions: 1, totalSets: 3 });
  });

  it('undoLog on a fresh account removes the stats docs the log created', async () => {
    const logged = await okRun('log', workout);
    expect(docsIn('exercise_stats').length).toBeGreaterThan(0);
    await okRun('undoLog', { workoutId: logged.workoutId, exerciseIds: logged.exerciseIds });
    expect(docsIn('workout_history')).toHaveLength(0);
    expect(docsIn('exercise_history')).toHaveLength(0);
    expect(docsIn('exercise_stats')).toHaveLength(0);
    expect(docsIn('workout_history', OTHER)).toHaveLength(1);
  });

  it('undoLog refuses exercise ids that are not in the workout and deletes nothing', async () => {
    seedAppSession();
    const r = await run('undoLog', { workoutId: 'sumDoc1', exerciseIds: ['exA', 'zzz'] });
    expect(r).toEqual({ ok: false, error: 'Exercise history id zzz does not belong to this workout.' });
    expect(docsIn('exercise_history')).toHaveLength(2);
    expect(docsIn('workout_history')).toHaveLength(1);
  });

  it('resolves a custom exercise name to the custom exercise, not Unknown', async () => {
    fs.put([...user(UID), 'customExercises', 'cust1'], {
      name: 'Hammer Strength Iso Row', muscleGroups: ['Back', 'Biceps'], equipment: 'Machine',
    });
    const logged = await okRun('log', {
      date: '2026-10-25',
      exercises: [{ name: 'Hammer Strength Iso Row', sets: [{ reps: 10, weight: 90 }] }],
    });
    expect(logged.unmatchedExercises).toBeUndefined();
    const doc = fs.read([...user(UID), 'exercise_history', (logged.exerciseIds as string[])[0]])!;
    expect(doc.exerciseId).toBe('cust1');
    expect(doc.muscleGroups).toEqual(['Back', 'Biceps']);
    expect(doc.equipment).toBe('Machine');
  });

  it('reports exercises that matched nothing', async () => {
    const logged = await okRun('log', {
      date: '2026-10-25',
      exercises: [{ name: 'Zorblax Thruster 9000', sets: [{ reps: 3 }] }],
    });
    expect(logged.unmatchedExercises).toEqual(['Zorblax Thruster 9000']);
  });

  it('refuses a future date', async () => {
    const r = await run('log', { ...workout, date: '2999-01-01' });
    expect(r.ok).toBe(false);
  });
});

describe('history action over the Worker request path', () => {
  const env = {
    FIREBASE_PROJECT_ID: 'p', ALLOWED_ORIGINS: 'https://app.test', APP_ORIGIN: 'https://app.test/',
    AI_ALLOWED_EMAILS: 'me@x.io', AI_DAILY_LIMIT: '2', ANTHROPIC_API_KEY: 'k', AI_USAGE: {} as KVNamespace,
  } as Env;

  const deps = (over: Partial<Deps> = {}): Deps => ({
    verify: vi.fn().mockResolvedValue({ uid: UID, email: 'me@x.io' }),
    takeSlot: vi.fn().mockResolvedValue(true),
    actions: {
      history: async (d, _c, _env, u) => {
        const req = d as Extract<typeof d, { action: 'history' }>;
        const scoped = new UserData(fs.client(), u!.uid, () => NOW, () => 'new-id-1');
        return runHistoryAction(req.op, req.input, scoped, fs.client());
      },
    },
    ...over,
  });

  const post = (body: unknown, headers: Record<string, string> = {}) =>
    new Request('https://w.test/', {
      method: 'POST',
      headers: { origin: 'https://app.test', authorization: 'Bearer t', 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });

  it('writes under the uid from the verified token, whatever the body says', async () => {
    const d = deps();
    const res = await handleRequest(
      post({
        action: 'history', op: 'log', uid: OTHER, userId: OTHER,
        input: { date: '2026-10-25', exercises: [{ name: 'Bench Press', sets: [{ reps: 5, weight: 100 }] }] },
      }),
      env,
      d,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ action: 'history', ok: true, workoutId: 'new-id-1' });
    expect(d.takeSlot).toHaveBeenCalledWith(env.AI_USAGE, UID, 2);
    expect(docsIn('workout_history')).toEqual([`users/${UID}/workout_history/new-id-1`]);
    expect(docsIn('workout_history', OTHER)).toHaveLength(1);
    expect(docsIn('exercise_history', OTHER)).toHaveLength(0);
  });

  it('rejects a uid inside input', async () => {
    const res = await handleRequest(
      post({
        action: 'history', op: 'log',
        input: { uid: OTHER, date: '2026-10-25', exercises: [{ name: 'Bench Press', sets: [{ reps: 5 }] }] },
      }),
      env,
      deps(),
    );
    expect(await res.json()).toMatchObject({ ok: false });
    expect(docsIn('workout_history')).toHaveLength(0);
  });

  it('uses the same gates as the other actions: sign-in, allow-list, daily limit, shape', async () => {
    const body = { action: 'history', op: 'log', input: {} };
    expect((await handleRequest(post(body, { authorization: '' }), env, deps())).status).toBe(401);
    expect(
      (await handleRequest(post(body), env, deps({ verify: vi.fn().mockResolvedValue({ uid: UID, email: 'x@y.z' }) }))).status,
    ).toBe(403);
    expect((await handleRequest(post(body), env, deps({ takeSlot: vi.fn().mockResolvedValue(false) }))).status).toBe(429);
    expect((await handleRequest(post({ action: 'history', op: 'wipe', input: {} }), env, deps())).status).toBe(400);
    expect((await handleRequest(post({ action: 'history', op: 'log' }), env, deps())).status).toBe(400);
  });

  it('the real handler fails with failed-precondition when the service account is not configured', async () => {
    await expect(
      defaultActions.history!({ action: 'history', op: 'log', input: {} }, {} as never, env, { uid: UID }),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});
