import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AiBackendError, chat, isBackendAvailable, parse, readLiftEntry } from '@/ai/aiClient';

// We never hit Firebase or the network here. The client takes injected deps
// (Worker URL, ID-token getter, fetch) so each test drives its own transport.

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    value: online,
    configurable: true,
    writable: true,
  });
}

const deps = (fetchImpl: typeof fetch, token: string | null = 't') => ({
  url: 'https://w.test/',
  getToken: async () => token,
  fetch: fetchImpl,
});
const ok = (body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
const fail = (status: number) =>
  vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'x', message: 'm' } }), { status }),
    );

const req = { messages: [{ role: 'user' as const, content: 'yo' }] };

describe('aiClient', () => {
  beforeEach(() => setOnline(true));
  afterEach(() => {
    vi.restoreAllMocks();
    setOnline(true);
  });

  describe('chat()', () => {
    it('sends the action with the ID token and maps the chat reply', async () => {
      const f = ok({ action: 'chat', text: 'hi', toolCalls: [], stopReason: 'end_turn' });
      await expect(chat(req, deps(f))).resolves.toMatchObject({
        reply: 'hi',
        toolCalls: [],
        source: 'backend',
      });
      const [url, init] = f.mock.calls[0];
      expect(url).toBe('https://w.test/');
      expect(init.method).toBe('POST');
      expect(init.headers.authorization).toBe('Bearer t');
      expect(JSON.parse(init.body)).toMatchObject({ action: 'chat', messages: req.messages });
    });

    it('forwards the chat context', async () => {
      const f = ok({ action: 'chat', text: '', toolCalls: [], stopReason: 'end_turn' });
      await chat({ ...req, context: { screen: 'workout', units: 'kg' } }, deps(f));
      expect(JSON.parse(f.mock.calls[0][1].body).context).toEqual({
        screen: 'workout',
        units: 'kg',
      });
    });

    it('maps statuses to codes', async () => {
      await expect(chat(req, deps(fail(403)))).rejects.toMatchObject({ code: 'not-allowed' });
      await expect(chat(req, deps(fail(429)))).rejects.toMatchObject({ code: 'limit' });
      await expect(chat(req, deps(fail(503)))).rejects.toMatchObject({ code: 'unconfigured' });
      await expect(chat(req, deps(fail(401)))).rejects.toMatchObject({ code: 'signed-out' });
      await expect(chat(req, deps(fail(502)))).rejects.toMatchObject({ code: 'failed' });
      await expect(chat(req, deps(fail(400)))).rejects.toBeInstanceOf(AiBackendError);
    });

    it('wraps a network failure as failed, keeping the cause', async () => {
      const underlying = new Error('boom');
      const f = vi.fn().mockRejectedValue(underlying);
      await expect(chat(req, deps(f))).rejects.toMatchObject({
        name: 'AiBackendError',
        code: 'failed',
        cause: underlying,
      });
    });

    it('is signed-out with no ID token, and never calls fetch', async () => {
      const f = ok({});
      await expect(chat(req, deps(f, null))).rejects.toMatchObject({ code: 'signed-out' });
      expect(f).not.toHaveBeenCalled();
    });

    it('is unconfigured with no URL', async () => {
      const f = ok({});
      await expect(chat(req, { ...deps(f), url: '' })).rejects.toMatchObject({
        code: 'unconfigured',
      });
      expect(f).not.toHaveBeenCalled();
    });

    it('is offline when the device is offline, and never calls fetch', async () => {
      setOnline(false);
      const f = ok({});
      await expect(chat(req, deps(f))).rejects.toMatchObject({ code: 'offline' });
      expect(f).not.toHaveBeenCalled();
    });

    it('defaults reply/toolCalls when the Worker omits them', async () => {
      const res = await chat(req, deps(ok({ action: 'chat' })));
      expect(res.reply).toBe('');
      expect(res.toolCalls).toEqual([]);
    });
  });

  describe('parse()', () => {
    const workerParse = {
      action: 'parse',
      result: {
        exercises: [
          {
            exerciseName: 'Bench',
            sets: [
              {
                exerciseName: 'Bench',
                reps: 5,
                sets: 3,
                weight: 185,
                unit: 'lbs',
                rpe: null,
                timeSeconds: null,
                distanceMeters: null,
                notes: null,
              },
            ],
          },
        ],
      },
    };

    it('maps the Worker result and sends only the parse action + text', async () => {
      const f = ok(workerParse);
      await expect(
        parse({ text: 'bench 3x5 185', knownExerciseNames: ['Bench'] }, deps(f)),
      ).resolves.toMatchObject({
        source: 'backend',
        workout: {
          // "3x5" arrives as one entry with sets: 3 → three ParsedSets.
          exercises: [{ name: 'Bench', sets: Array(3).fill({ reps: 5, weight: 185, unit: 'lbs' }) }],
          supersets: [],
        },
      });
      expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({
        action: 'parse',
        text: 'bench 3x5 185',
      });
    });

    it('keeps rpe, time and distance, and caps an entry at 20 sets', async () => {
      const set = (over: Record<string, unknown>) => ({
        exerciseName: 'X',
        reps: null,
        sets: null,
        weight: null,
        unit: null,
        rpe: null,
        timeSeconds: null,
        distanceMeters: null,
        notes: null,
        ...over,
      });
      const f = ok({
        action: 'parse',
        result: {
          exercises: [
            { exerciseName: 'Run', sets: [set({ timeSeconds: 1500, distanceMeters: 5000 })] },
            { exerciseName: 'Squat', sets: [set({ reps: 5, rpe: 8, sets: 500 })] },
          ],
        },
      });
      const res = await parse({ text: 'ran 5k in 25 min; squat 500x5 @8' }, deps(f));
      const [run, squat] = res.workout.exercises;
      expect(run.sets).toEqual([{ reps: 0, time: 1500, distance: 5000 }]);
      expect(squat.sets).toHaveLength(20);
      expect(squat.sets[0]).toEqual({ reps: 5, rpe: 8 });
    });

    it('falls back on a Worker error', async () => {
      const res = await parse({ text: '3x10 Squats' }, deps(fail(502)));
      expect(res.source).toBe('fallback');
      expect(res.workout.exercises[0].name).toBe('Squats');
      expect(res.workout.exercises[0].sets).toHaveLength(3);
    });

    it('falls back with no URL, when signed out, and when offline', async () => {
      const f = ok(workerParse);
      await expect(parse({ text: '3x10 Squats' }, { ...deps(f), url: '' })).resolves.toMatchObject(
        { source: 'fallback' },
      );
      await expect(parse({ text: '3x10 Squats' }, deps(f, null))).resolves.toMatchObject({
        source: 'fallback',
      });
      setOnline(false);
      await expect(parse({ text: '3x10 Squats' }, deps(f))).resolves.toMatchObject({
        source: 'fallback',
      });
      expect(f).not.toHaveBeenCalled();
    });

    it('falls back when the Worker returns a malformed body', async () => {
      const res = await parse({ text: '3x10 Squats' }, deps(ok({ action: 'parse' })));
      expect(res.source).toBe('fallback');
      expect(res.workout.exercises[0].name).toBe('Squats');
    });
  });

  describe('readLiftEntry()', () => {
    it('readLiftEntry returns the result', async () => {
      const f = ok({ action: 'readLift', result: { name: 'Front Squat', loadKind: 'weight', weight: 250, unit: 'lb', targetKind: 'reps', reps: 5 } });
      await expect(readLiftEntry('fs 250x5', deps(f))).resolves.toMatchObject({ name: 'Front Squat', reps: 5 });
      expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ action: 'readLift', text: 'fs 250x5' });
    });

    it('throws a failed AiBackendError when the body has no result', async () => {
      await expect(readLiftEntry('fs 250x5', deps(ok({ action: 'readLift' })))).rejects.toMatchObject({
        name: 'AiBackendError',
        code: 'failed',
      });
    });

    it('passes Worker errors through with their code', async () => {
      await expect(readLiftEntry('fs 250x5', deps(fail(429)))).rejects.toMatchObject({ code: 'limit' });
    });
  });

  describe('isBackendAvailable()', () => {
    it('is true with a URL while online', () => {
      expect(isBackendAvailable(deps(ok({})))).toBe(true);
    });

    it('is unavailable with no URL', () => {
      expect(isBackendAvailable({ url: '', getToken: async () => 't', fetch })).toBe(false);
    });

    it('is false when offline', () => {
      setOnline(false);
      expect(isBackendAvailable(deps(ok({})))).toBe(false);
    });
  });
});
