// worker/src/index.test.ts
import { describe, it, expect, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { defaultActions, handleRequest, type Deps, type Env } from './index';

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
  it('400 on an oversized chat context without taking a daily slot', async () => {
    const d = deps();
    const big = { ...chat, context: { activeWorkout: 'x'.repeat(40_001) } };
    const r = await handleRequest(post(big), env, d);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: { code: 'invalid-argument', message: 'Context too large.' } });
    expect(d.takeSlot).not.toHaveBeenCalled();
  });
  it('400 on a body over 1,000,000 chars or bad JSON, without taking a slot', async () => {
    const d = deps();
    const huge = new Request('https://w.test/', {
      method: 'POST',
      headers: { origin: 'https://app.test', authorization: 'Bearer t' },
      body: 'x'.repeat(1_000_001),
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
});
