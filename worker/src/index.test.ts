// worker/src/index.test.ts
import { describe, it, expect, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { defaultActions, handleRequest, type Deps, type Env } from './index';
import { MAX_IMAGE_BASE64_CHARS } from './schemas';

const env = {
  FIREBASE_PROJECT_ID: 'p', ALLOWED_ORIGINS: 'https://app.test', APP_ORIGIN: 'https://app.test/',
  AI_ALLOWED_EMAILS: 'me@x.io', AI_DAILY_LIMIT: '2', ANTHROPIC_API_KEY: 'k', AI_USAGE: {} as KVNamespace,
} as Env;

const deps = (over: Partial<Deps> = {}): Deps => ({
  verify: vi.fn().mockResolvedValue({ uid: 'u', email: 'me@x.io' }),
  takeSlot: vi.fn().mockResolvedValue(true),
  actions: { chat: vi.fn().mockResolvedValue({ text: 'hi', toolCalls: [], stopReason: 'end_turn' }) },
  ...over,
});

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://w.test/', {
    method: 'POST',
    headers: { origin: 'https://app.test', authorization: 'Bearer t', 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

const chat = { action: 'chat', messages: [{ role: 'user', content: 'hi' }] };

describe('handleRequest', () => {
  it('answers CORS preflight for allowed origins only', async () => {
    const ok = await handleRequest(new Request('https://w.test/', { method: 'OPTIONS', headers: { origin: 'https://app.test' } }), env, deps());
    expect(ok.status).toBe(204);
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://app.test');
    const bad = await handleRequest(new Request('https://w.test/', { method: 'OPTIONS', headers: { origin: 'https://evil.test' } }), env, deps());
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
  });
  it('runs an allowed chat', async () => {
    const r = await handleRequest(post(chat), env, deps());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ action: 'chat', text: 'hi', toolCalls: [], stopReason: 'end_turn' });
  });
  it('401 without a token, 403 off the allow-list, 429 over the limit, 400 on a bad body', async () => {
    expect((await handleRequest(post(chat, { authorization: '' }), env, deps())).status).toBe(401);
    expect((await handleRequest(post(chat), env, deps({ verify: vi.fn().mockResolvedValue({ uid: 'u', email: 'x@y.z' }) }))).status).toBe(403);
    expect((await handleRequest(post(chat), env, deps({ takeSlot: vi.fn().mockResolvedValue(false) }))).status).toBe(429);
    expect((await handleRequest(post({ action: 'nope' }), env, deps())).status).toBe(400);
  });
  it('reads AI_DAILY_LIMIT: 0 turns AI off (429, no KV), junk or empty falls back to 150', async () => {
    const off = deps();
    expect((await handleRequest(post(chat), { ...env, AI_DAILY_LIMIT: '0' }, off)).status).toBe(429);
    expect(off.takeSlot).not.toHaveBeenCalled();
    for (const raw of ['abc', '', '-3', 'Infinity']) {
      const d = deps();
      await handleRequest(post(chat), { ...env, AI_DAILY_LIMIT: raw }, d);
      expect(d.takeSlot).toHaveBeenCalledWith(env.AI_USAGE, 'u', 150);
    }
    const d = deps();
    await handleRequest(post(chat), { ...env, AI_DAILY_LIMIT: ' 40 ' }, d);
    expect(d.takeSlot).toHaveBeenCalledWith(env.AI_USAGE, 'u', 40);
  });
  it('400 on the removed parse action, without taking a slot', async () => {
    const d = deps();
    expect((await handleRequest(post({ action: 'parse', text: 'bench 3x5' }), env, d)).status).toBe(400);
    expect(d.takeSlot).not.toHaveBeenCalled();
    expect(Object.keys(defaultActions).sort()).toEqual(['chat', 'findExercise', 'readLift', 'readMachine']);
  });
  it('400 on an oversized chat context without taking a daily slot', async () => {
    const d = deps();
    const big = { ...chat, context: { activeWorkout: 'x'.repeat(40_001) } };
    const r = await handleRequest(post(big), env, d);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: { code: 'invalid-argument', message: 'Context too large.' } });
    expect(d.takeSlot).not.toHaveBeenCalled();
  });
  it('400 on a body over 3,100,000 chars or bad JSON, without taking a slot', async () => {
    const d = deps();
    const huge = new Request('https://w.test/', {
      method: 'POST',
      headers: { origin: 'https://app.test', authorization: 'Bearer t' },
      body: 'x'.repeat(3_100_001),
    });
    expect((await handleRequest(huge, env, d)).status).toBe(400);
    const bad = new Request('https://w.test/', {
      method: 'POST',
      headers: { origin: 'https://app.test', authorization: 'Bearer t' },
      body: '{not json',
    });
    expect((await handleRequest(bad, env, d)).status).toBe(400);
    expect(d.takeSlot).not.toHaveBeenCalled();
  });
  it('logs the action and Anthropic status when a handler fails', async () => {
    const { APIError } = await import('@anthropic-ai/sdk');
    const err = new APIError(529, undefined, 'overloaded', new Headers());
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await handleRequest(post(chat), env, deps({ actions: { chat: vi.fn().mockRejectedValue(err) } }));
    expect(r.status).toBe(502);
    expect(spy).toHaveBeenCalledWith('ai worker failed', expect.objectContaining({ action: 'chat', status: 529 }));
    spy.mockRestore();
  });
  it('400 on a photo over the size cap, without taking a slot', async () => {
    const d = deps({ actions: { readMachine: vi.fn() } });
    const big = { action: 'readMachine', image: { mediaType: 'image/jpeg', data: 'A'.repeat(MAX_IMAGE_BASE64_CHARS + 4) } };
    const r = await handleRequest(post(big), env, d);
    expect(r.status).toBe(400);
    expect(d.takeSlot).not.toHaveBeenCalled();
    expect(d.actions.readMachine).not.toHaveBeenCalled();
    const chatBig = { action: 'chat', messages: [{ role: 'user', content: 'what is this', image: big.image }] };
    expect((await handleRequest(post(chatBig), env, d)).status).toBe(400);
    expect(d.takeSlot).not.toHaveBeenCalled();
  });
  it('accepts a full-size photo (the body cap leaves room for it)', async () => {
    const readMachine = vi.fn().mockResolvedValue({ result: { name: 'Leg Curl' } });
    const ok = { action: 'readMachine', image: { mediaType: 'image/jpeg', data: 'A'.repeat(MAX_IMAGE_BASE64_CHARS) } };
    const r = await handleRequest(post(ok), env, deps({ actions: { readMachine } }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ action: 'readMachine', result: { name: 'Leg Curl' } });
  });
  it('503 when the key is missing', async () => {
    expect((await handleRequest(post(chat), { ...env, ANTHROPIC_API_KEY: '' }, deps())).status).toBe(503);
  });
});

describe('defaultActions', () => {
  it('registers readLift and wraps the lift in { result }', async () => {
    const lift = { name: 'Front Squat', loadKind: 'weight', weight: 250, unit: 'lb', targetKind: 'reps', reps: 5 };
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'tool_use', id: 't1', name: 'submitLift', input: lift }],
      stop_reason: 'tool_use',
    });
    const client = { messages: { create } } as unknown as Anthropic;
    await expect(defaultActions.readLift!({ action: 'readLift', text: 'fs 250x5' }, client, env)).resolves.toEqual({ result: lift });
  });
  it('registers findExercise, verifies media with APP_ORIGIN as Referer, and wraps it in { result }', async () => {
    const input = {
      name: 'Skull Crusher', muscleGroups: ['Triceps'], equipment: 'Barbell', difficulty: 'Intermediate',
      instructions: ['Lie back.', 'Extend.'], mediaCandidates: ['https://m.test/a.mp4'],
    };
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'tool_use', id: 't1', name: 'submitExercise', input }],
      stop_reason: 'tool_use',
    });
    const client = { messages: { create } } as unknown as Anthropic;
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200, ok: true, url: 'https://m.test/a.mp4', headers: new Headers({ 'content-type': 'video/mp4' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const { mediaCandidates: _c, ...rest } = input;
      await expect(defaultActions.findExercise!({ action: 'findExercise', name: 'skull crushers' }, client, env)).resolves.toEqual({
        result: { ...rest, media: ['https://m.test/a.mp4'], rejectedMedia: 0 },
      });
      expect(fetchMock.mock.calls[0][1].headers.Referer).toBe(env.APP_ORIGIN);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('registers readMachine and wraps the exercise in { result }', async () => {
    const machine = {
      name: 'Seated Leg Curl', muscleGroups: ['Hamstrings'], equipment: 'Machine',
      setupCues: ['Knees at the pivot.'], defaultSets: { sets: 3, reps: 12 },
    };
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'tool_use', id: 't1', name: 'submitMachine', input: machine }],
      stop_reason: 'tool_use',
    });
    const client = { messages: { create } } as unknown as Anthropic;
    await expect(
      defaultActions.readMachine!({ action: 'readMachine', image: { mediaType: 'image/jpeg', data: 'AAAA' } }, client, env),
    ).resolves.toEqual({ result: machine });
  });

  it('fails soft through index.ts/handleChat when FIREBASE_SERVICE_ACCOUNT is missing', async () => {
    const envNoSa = { ...env, FIREBASE_SERVICE_ACCOUNT: undefined };
    const create = vi
      .fn()
      // Round 1: Model calls list_history
      .mockResolvedValueOnce({
        content: [{ type: 'tool_use', id: 'read_fail', name: 'list_history', input: { kind: 'workouts' } }],
        stop_reason: 'tool_use',
      })
      // Round 2: Model receives soft error and explains to user
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Workout history is currently unavailable.' }],
        stop_reason: 'end_turn',
      });
    const client = { messages: { create } } as unknown as Anthropic;

    const res = (await defaultActions.chat!(
      { action: 'chat', messages: [{ role: 'user', content: 'What did I do yesterday?' }] },
      client,
      envNoSa,
      { uid: 'u123', email: 'me@x.io' },
    )) as { text: string; toolCalls: unknown[] };

    expect(create).toHaveBeenCalledTimes(2);
    // Verify soft-fail error was returned in tool_result to Anthropic
    const secondCallMessages = create.mock.calls[1][0].messages;
    const toolResultBlock = secondCallMessages[secondCallMessages.length - 1].content[0];
    expect(toolResultBlock.content).toContain('history is unavailable');
    expect(res.text).toBe('Workout history is currently unavailable.');
    expect(res.toolCalls).toHaveLength(0);
  });

  it('passes logPastWorkout and editPastWorkout proposals through defaultActions.chat', async () => {
    const create = vi.fn().mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'log_1',
          name: 'logPastWorkout',
          input: {
            date: '2026-10-29',
            name: 'Push Day',
            exercises: [{ name: 'Bench Press', sets: [{ reps: 5, weight: 225 }] }],
          },
        },
        {
          type: 'tool_use',
          id: 'edit_1',
          name: 'editPastWorkout',
          input: {
            workoutId: 'w_old',
            name: 'Renamed Session',
          },
        },
        { type: 'text', text: 'Here are the workout changes to review.' },
      ],
      stop_reason: 'tool_use',
    });
    const client = { messages: { create } } as unknown as Anthropic;

    const res = (await defaultActions.chat!(
      { action: 'chat', messages: [{ role: 'user', content: 'log and edit' }] },
      client,
      env,
      { uid: 'u123', email: 'me@x.io' },
    )) as { text: string; toolCalls: { name: string }[] };

    expect(res.toolCalls).toHaveLength(2);
    expect(res.toolCalls[0].name).toBe('logPastWorkout');
    expect(res.toolCalls[1].name).toBe('editPastWorkout');
    expect(res.text).toBe('Here are the workout changes to review.');
  });
});
