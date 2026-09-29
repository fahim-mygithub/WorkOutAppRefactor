// worker/src/index.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleRequest, type Deps, type Env } from './index';

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
  it('503 when the key is missing', async () => {
    expect((await handleRequest(post(chat), { ...env, ANTHROPIC_API_KEY: '' }, deps())).status).toBe(503);
  });
});
