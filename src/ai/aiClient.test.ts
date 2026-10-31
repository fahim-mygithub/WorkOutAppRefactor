import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AiBackendError, chat, findExerciseOnline, isBackendAvailable, readLiftEntry, readMachinePhoto, runHistory } from '@/ai/aiClient';
import { ImageTooLargeError, MAX_IMAGE_BASE64_CHARS } from '@/ai/image';

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

  describe('request size caps', () => {
    it('chat sends at most the last 40 messages, starting with a user turn', async () => {
      const messages = Array.from({ length: 45 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `m${i}`,
      }));
      const f = ok({ action: 'chat', text: '' });
      await chat({ messages }, deps(f));
      const sent = JSON.parse(f.mock.calls[0][1].body).messages;
      // Last 40 would start at m5 (assistant); the leading assistant turn is dropped.
      expect(sent).toHaveLength(39);
      expect(sent[0]).toEqual({ role: 'user', content: 'm6' });
      expect(sent.at(-1)).toEqual({ role: 'user', content: 'm44' });
    });

    it('chat leaves a short conversation untouched', async () => {
      const f = ok({ action: 'chat', text: '' });
      await chat(req, deps(f));
      expect(JSON.parse(f.mock.calls[0][1].body).messages).toEqual(req.messages);
    });

    it('readLiftEntry trims and caps the text at 500 chars', async () => {
      const f = ok({ action: 'readLift', result: { name: 'x' } });
      await readLiftEntry(`  ${'a'.repeat(600)}  `, deps(f));
      expect(JSON.parse(f.mock.calls[0][1].body).text).toBe('a'.repeat(500));
    });

    it('findExerciseOnline trims and caps the name at 120 chars', async () => {
      const f = ok({ action: 'findExercise', result: { name: 'x' } });
      await findExerciseOnline(`  ${'b'.repeat(200)}  `, deps(f));
      expect(JSON.parse(f.mock.calls[0][1].body).name).toBe('b'.repeat(120));
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

  describe('findExerciseOnline()', () => {
    const found = {
      name: 'Zercher Carry',
      muscleGroups: ['Core', 'Upper Back'],
      equipment: 'Barbell',
      difficulty: 'Advanced',
      instructions: ['Set the bar in your elbows.', 'Walk.'],
      media: ['https://m.test/zc.mp4'],
      rejectedMedia: 2,
    };

    it('sends the name and returns the result', async () => {
      const f = ok({ action: 'findExercise', result: found });
      await expect(findExerciseOnline('zercher carry', deps(f))).resolves.toEqual(found);
      expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ action: 'findExercise', name: 'zercher carry' });
    });

    it('throws a failed AiBackendError when the body has no result', async () => {
      await expect(findExerciseOnline('x', deps(ok({ action: 'findExercise' })))).rejects.toMatchObject({
        name: 'AiBackendError',
        code: 'failed',
      });
    });

    it('passes Worker errors through with their code', async () => {
      await expect(findExerciseOnline('x', deps(fail(403)))).rejects.toMatchObject({ code: 'not-allowed' });
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

  describe('photos', () => {
    const photo = { mediaType: 'image/jpeg' as const, data: 'AAAA' };
    const big = { mediaType: 'image/jpeg' as const, data: 'A'.repeat(MAX_IMAGE_BASE64_CHARS + 4) };
    const machine = {
      name: 'Seated Leg Curl', muscleGroups: ['Hamstrings'], equipment: 'Machine',
      setupCues: ['Knees at the pivot.'], defaultSets: { sets: 3, reps: 12 },
    };

    it('readMachinePhoto sends the readMachine action and returns the exercise', async () => {
      const f = ok({ action: 'readMachine', result: machine });
      await expect(readMachinePhoto(photo, deps(f))).resolves.toEqual(machine);
      expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ action: 'readMachine', image: photo });
    });

    it('readMachinePhoto refuses an oversized photo without calling the Worker', async () => {
      const f = ok({});
      await expect(readMachinePhoto(big, deps(f))).rejects.toBeInstanceOf(ImageTooLargeError);
      expect(f).not.toHaveBeenCalled();
    });

    it('readMachinePhoto throws failed when the Worker returns no exercise', async () => {
      await expect(readMachinePhoto(photo, deps(ok({ action: 'readMachine' })))).rejects.toMatchObject({ code: 'failed' });
    });

    it('chat sends a photo only with the latest user message', async () => {
      const f = ok({ action: 'chat', text: '', toolCalls: [], stopReason: 'end_turn' });
      await chat({
        messages: [
          { role: 'user', content: 'first', image: photo },
          { role: 'assistant', content: 'A leg curl.' },
          { role: 'user', content: 'add it', image: { ...photo, data: 'BBBB' } },
        ],
      }, deps(f));
      const sent = JSON.parse(f.mock.calls[0][1].body).messages;
      expect(sent[0]).toEqual({ role: 'user', content: 'first' });
      expect(sent[2]).toEqual({ role: 'user', content: 'add it', image: { ...photo, data: 'BBBB' } });
    });

    it('chat drops a photo from an older turn even when the last turn has none', async () => {
      const f = ok({ action: 'chat', text: '', toolCalls: [], stopReason: 'end_turn' });
      await chat({
        messages: [
          { role: 'user', content: 'first', image: photo },
          { role: 'assistant', content: 'A leg curl.' },
          { role: 'user', content: 'thanks' },
        ],
      }, deps(f));
      const sent = JSON.parse(f.mock.calls[0][1].body).messages;
      expect(sent.some((m: { image?: unknown }) => m.image)).toBe(false);
    });

    it('chat refuses an oversized photo without calling the Worker', async () => {
      const f = ok({});
      await expect(chat({ messages: [{ role: 'user', content: 'x', image: big }] }, deps(f))).rejects.toBeInstanceOf(
        ImageTooLargeError,
      );
      expect(f).not.toHaveBeenCalled();
    });
  });

  describe('runHistory()', () => {
    it('posts the history action with the ID token and resolves with the result fields', async () => {
      const f = ok({ action: 'history', ok: true, workoutId: 'w1', exerciseIds: ['e1'] });
      await expect(runHistory('log', { date: '2026-10-15' }, deps(f))).resolves.toMatchObject({
        workoutId: 'w1',
        exerciseIds: ['e1'],
      });
      const [url, init] = f.mock.calls[0];
      expect(url).toBe('https://w.test/');
      expect(init.headers.authorization).toBe('Bearer t');
      expect(JSON.parse(init.body)).toEqual({ action: 'history', op: 'log', input: { date: '2026-10-15' } });
    });

    it("throws the Worker's reason when it refuses, and AiBackendError when it cannot serve", async () => {
      const refused = ok({ action: 'history', ok: false, error: 'Cannot log a workout in the future.' });
      await expect(runHistory('log', {}, deps(refused))).rejects.toThrow('Cannot log a workout in the future.');
      await expect(runHistory('log', {}, deps(fail(429)))).rejects.toMatchObject({ code: 'limit' });
      await expect(runHistory('undoLog', {}, deps(ok({}), null))).rejects.toMatchObject({ code: 'signed-out' });
    });
  });
});
