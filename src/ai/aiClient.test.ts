import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AiBackendError, chat, findExerciseOnline, isBackendAvailable, readLiftEntry } from '@/ai/aiClient';

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
});
