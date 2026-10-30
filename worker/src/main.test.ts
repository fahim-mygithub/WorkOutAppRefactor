/**
 * The Worker entry end to end, in process: routing, the OAuth flow a
 * claude.ai connector runs (DCR + PKCE + our /authorize), and an MCP
 * round trip with the SDK client against a fake Firestore.
 */
import './mcp/testing/cfWorkersShim';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeFirestore } from './data/testing/fakeFirestore';
import type { McpEnv } from './mcp/env';
import { memoryKv } from './mcp/testing/memoryKv';

type MainModule = typeof import('./main');
type ProviderModule = typeof import('./mcp/provider');
let main: MainModule;
let providerMod: ProviderModule;

beforeAll(async () => {
  main = await import('./main');
  providerMod = await import('./mcp/provider');
});

const ORIGIN = 'https://workout-ai.test';
const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
const OWNER = { uid: 'ownerUid123', email: 'owner@example.com' };

let fs: FakeFirestore;
let env: McpEnv;
let legacyFetch: ReturnType<typeof vi.fn>;
let verify: ReturnType<typeof vi.fn>;
let worker: { fetch: (r: Request, e: McpEnv, c: ExecutionContext) => Response | Promise<Response> };

const ctx = (): ExecutionContext =>
  ({ waitUntil: () => {}, passThroughOnException: () => {}, props: {} }) as unknown as ExecutionContext;

const call = (input: string, init?: RequestInit) => worker.fetch(new Request(new URL(input, ORIGIN), init), env, ctx());

beforeEach(() => {
  fs = new FakeFirestore();
  fs.put(['users', OWNER.uid], { email: OWNER.email, displayName: 'Owner', preferences: { weightUnit: 'lbs' } });
  env = {
    ANTHROPIC_API_KEY: 'k',
    FIREBASE_PROJECT_ID: 'test-project',
    ALLOWED_ORIGINS: 'https://app.test',
    APP_ORIGIN: 'https://app.test/',
    AI_ALLOWED_EMAILS: 'owner@example.com',
    AI_DAILY_LIMIT: '150',
    AI_USAGE: memoryKv(),
    OAUTH_KV: memoryKv(),
    FIREBASE_SERVICE_ACCOUNT: '',
    FIREBASE_WEB_API_KEY: 'web-key',
    FIREBASE_AUTH_DOMAIN: 'test-project.firebaseapp.com',
  };
  legacyFetch = vi.fn(async () => new Response('legacy', { status: 299, headers: { 'x-legacy': '1' } }));
  verify = vi.fn(async (token: string) => {
    if (token === 'owner-id-token') return OWNER;
    if (token === 'stranger-id-token') return { uid: 'strangerUid', email: 'stranger@example.com' };
    throw new Error('bad token');
  });
  worker = main.createWorker({
    legacyFetch,
    verify,
    firestore: () => fs.client(),
    provider: providerMod.createProvider,
  });
});

describe('routing', () => {
  it('sends non-connector traffic to the original handler unchanged', async () => {
    for (const [path, method] of [['/', 'POST'], ['/', 'OPTIONS'], ['/anything', 'GET'], ['/mcpx', 'POST']] as const) {
      legacyFetch.mockClear();
      const req = new Request(new URL(path, ORIGIN), { method, body: method === 'POST' ? '{"action":"chat"}' : undefined });
      const res = await worker.fetch(req, env, ctx());
      expect(res.status).toBe(299);
      expect(res.headers.get('x-legacy')).toBe('1');
      expect(legacyFetch).toHaveBeenCalledTimes(1);
      expect(legacyFetch.mock.calls[0][0]).toBe(req);
      expect(legacyFetch.mock.calls[0][1]).toBe(env);
    }
  });

  it('the default export keeps the old Worker on /', async () => {
    // No Authorization header: the original handler's own 401 JSON, not the connector's.
    const res = await main.default.fetch(new Request(`${ORIGIN}/`, { method: 'POST', body: '{}' }), env, ctx());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: 'unauthenticated', message: 'Sign in to use the AI assistant.' } });
  });

  it('classifies connector paths', () => {
    const yes = ['/mcp', '/mcp/x', '/authorize', '/oauth/token', '/register', '/.well-known/oauth-authorization-server'];
    for (const p of yes) expect(providerMod.isConnectorPath(p)).toBe(true);
    for (const p of ['/', '/mcpx', '/authorize/x', '/readLift']) expect(providerMod.isConnectorPath(p)).toBe(false);
  });
});

describe('unauthenticated MCP', () => {
  it('gets 401 with a challenge pointing at the resource metadata', async () => {
    const res = await call('/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain(`resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/mcp"`);
    expect(legacyFetch).not.toHaveBeenCalled();
    expect(fs.requests).toHaveLength(0);
  });

  it('rejects a made-up bearer token', async () => {
    const res = await call('/mcp', { method: 'POST', headers: { authorization: 'Bearer nope:nope:nope' }, body: '{}' });
    expect(res.status).toBe(401);
  });

  it('publishes discovery metadata', async () => {
    const pr = await (await call('/.well-known/oauth-protected-resource/mcp')).json();
    expect(pr).toMatchObject({ resource: `${ORIGIN}/mcp`, authorization_servers: [ORIGIN] });
    const as = (await (await call('/.well-known/oauth-authorization-server')).json()) as Record<string, unknown>;
    expect(as).toMatchObject({
      issuer: ORIGIN,
      authorization_endpoint: `${ORIGIN}/authorize`,
      token_endpoint: `${ORIGIN}/oauth/token`,
      registration_endpoint: `${ORIGIN}/register`,
    });
  });
});

// ---- OAuth helpers: what a connector client does ----

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function registerClient(): Promise<string> {
  const res = await call('/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Claude',
      redirect_uris: [REDIRECT],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    }),
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { client_id: string }).client_id;
}

async function openConsent(clientId: string) {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT,
    state: 'st4te',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: 'workouts',
    resource: `${ORIGIN}/mcp`,
  });
  const res = await call(`/authorize?${q}`);
  expect(res.status).toBe(200);
  const html = await res.text();
  const handle = /name="handle" value="([^"]+)"/.exec(html)?.[1];
  expect(handle).toBeTruthy();
  const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  return { html, handle: handle!, cookie, verifier };
}

function submitConsent(c: { handle: string; cookie: string }, fields: Record<string, string>) {
  return call('/authorize', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: c.cookie, origin: ORIGIN },
    body: new URLSearchParams({ handle: c.handle, ...fields }).toString(),
    redirect: 'manual',
  });
}

async function connect(): Promise<string> {
  const clientId = await registerClient();
  const consent = await openConsent(clientId);
  const res = await submitConsent(consent, { decision: 'approve', idToken: 'owner-id-token' });
  expect(res.status).toBe(302);
  const location = new URL(res.headers.get('location')!);
  expect(`${location.origin}${location.pathname}`).toBe(REDIRECT);
  expect(location.searchParams.get('state')).toBe('st4te');
  const code = location.searchParams.get('code')!;
  const tokenRes = await call('/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT,
      client_id: clientId,
      code_verifier: consent.verifier,
      resource: `${ORIGIN}/mcp`,
    }).toString(),
  });
  expect(tokenRes.status).toBe(200);
  return ((await tokenRes.json()) as { access_token: string }).access_token;
}

describe('/authorize', () => {
  it('shows the client, the redirect host and a Firebase Google sign-in', async () => {
    const { html } = await openConsent(await registerClient());
    expect(html).toContain('Connect Claude to your workouts?');
    expect(html).toContain('claude.ai');
    expect(html).toContain('signInWithPopup');
    expect(html).toContain('"apiKey":"web-key"');
  });

  it('verifies the Firebase ID token and refuses accounts not on the allow-list', async () => {
    const consent = await openConsent(await registerClient());
    const bad = await submitConsent(consent, { decision: 'approve', idToken: 'forged' });
    expect(bad.status).toBe(401);
    const stranger = await submitConsent(consent, { decision: 'approve', idToken: 'stranger-id-token' });
    expect(stranger.status).toBe(403);
    expect(verify).toHaveBeenCalledWith('stranger-id-token', 'test-project');
    const none = await submitConsent(consent, { decision: 'approve' });
    expect(none.status).toBe(401);
  });

  it('sends access_denied back to the client on Deny', async () => {
    const consent = await openConsent(await registerClient());
    const res = await submitConsent(consent, { decision: 'deny' });
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get('location')!).searchParams.get('error')).toBe('access_denied');
  });
});

describe('MCP round trip (OAuth token + SDK client + mocked Firestore)', () => {
  async function client(token: string) {
    const transport = new StreamableHTTPClientTransport(new URL(`${ORIGIN}/mcp`), {
      requestInit: { headers: { authorization: `Bearer ${token}` } },
      fetch: async (url, init) => worker.fetch(new Request(url, init), env, ctx()),
    });
    const c = new Client({ name: 'test-client', version: '1.0.0' });
    await c.connect(transport);
    return c;
  }

  it('initializes, lists the tools and creates workouts as the signed-in user', async () => {
    const token = await connect();
    const c = await client(token);
    expect(c.getServerVersion()).toMatchObject({ name: 'workout-app' });

    const { tools } = await c.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'add_exercise', 'create_workout', 'get_profile', 'get_workout', 'list_history',
      'list_plans', 'list_workouts', 'plan_workout', 'update_profile', 'update_workout',
    ]);
    const create = tools.find((t) => t.name === 'create_workout')!;
    expect(create.annotations).toMatchObject({ readOnlyHint: false });
    expect(create.inputSchema).toMatchObject({ type: 'object', additionalProperties: false });

    const result = await c.callTool({
      name: 'create_workout',
      arguments: {
        workouts: [
          { name: 'Push', exercises: [{ name: 'Bench Press', sets: 3, reps: 8, weight: 135 }] },
          { name: 'Pull', exercises: [{ name: 'Row', sets: 3, reps: 10 }] },
        ],
      },
    });
    expect(result.isError).toBeFalsy();
    const created = JSON.parse((result.content as { text: string }[])[0].text).created as { id: string }[];
    expect(created).toHaveLength(2);
    expect(fs.read(['users', OWNER.uid, 'savedWorkouts', created[0].id])).toMatchObject({
      userId: OWNER.uid,
      workoutText: '3x8 Bench Press @135lbs',
    });
    for (const r of fs.requests) expect(r.path.slice(0, 2)).toEqual(['users', OWNER.uid]);

    const bad = await c.callTool({ name: 'get_profile', arguments: { uid: 'someoneElse' } });
    expect(bad.isError).toBe(true);
    await c.close();
  });

  it('cuts off a token whose email leaves the allow-list', async () => {
    const token = await connect();
    env.AI_ALLOWED_EMAILS = 'someone-else@example.com';
    const res = await call('/mcp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(res.status).toBe(403);
  });

  it('answers 503 when the service account is not configured', async () => {
    const token = await connect();
    worker = main.createWorker({
      legacyFetch,
      verify,
      firestore: main.defaultMainDeps.firestore,
      provider: providerMod.createProvider,
    });
    const res = await call('/mcp', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(res.status).toBe(503);
  });
});
