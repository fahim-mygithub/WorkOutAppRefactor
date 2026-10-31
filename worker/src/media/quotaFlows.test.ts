/**
 * The quota as seen from the outside: HTTP uploads, GET /media/usage, the
 * connector tools and the daily cron, all against a fake R2 and a fake KV.
 */
import '../mcp/testing/cfWorkersShim';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleMediaRequest } from './handler';
import { GIB, mediaQuotaFor } from './quota';
import { createUploadToken } from './uploadToken';
import { fakeR2 } from './testing/fakeR2';
import { memoryKv } from '../mcp/testing/memoryKv';
import { FakeFirestore } from '../data/testing/fakeFirestore';
import { UserData } from '../data/userData';
import { runAgentTool } from '../agentTools/registry';
import type { McpEnv } from '../mcp/env';
import type { MainDeps } from '../main';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00]);

let r2: ReturnType<typeof fakeR2>;
let kv: ReturnType<typeof memoryKv>;
let fs: FakeFirestore;
let env: McpEnv;
let deps: MainDeps;
const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;

beforeEach(() => {
  r2 = fakeR2();
  kv = memoryKv();
  fs = new FakeFirestore();
  env = {
    ANTHROPIC_API_KEY: 'k',
    FIREBASE_PROJECT_ID: 'p',
    ALLOWED_ORIGINS: 'https://app.test',
    APP_ORIGIN: 'https://app.test/',
    AI_ALLOWED_EMAILS: 'owner@example.com',
    AI_DAILY_LIMIT: '100',
    AI_USAGE: kv,
    OAUTH_KV: kv,
    EXERCISE_MEDIA: r2,
    FIREBASE_SERVICE_ACCOUNT: '',
    FIREBASE_WEB_API_KEY: 'k',
    FIREBASE_AUTH_DOMAIN: 'd',
  };
  deps = {
    legacyFetch: vi.fn(),
    verify: vi.fn(async (t) => {
      if (t === 'valid-token') return { uid: 'user123', email: 'owner@example.com' };
      if (t === 'stranger-token') return { uid: 'stranger', email: 'stranger@example.com' };
      throw new Error('invalid token');
    }),
    firestore: () => fs.client(),
  };
});

const seedUsed = (total: number, user = 0, uid = 'user123') => {
  kv.store.set('media_quota:total', JSON.stringify({ usedBytes: total, reservedBytes: 0 }));
  if (user) kv.store.set(`media_quota:user:${uid}`, JSON.stringify({ usedBytes: user, reservedBytes: 0 }));
};

const postMedia = (bytes: Uint8Array, token = 'valid-token') => {
  const form = new FormData();
  form.append('file', new Blob([bytes]));
  return handleMediaRequest(
    new Request('https://worker.test/media', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }),
    env,
    ctx,
    deps,
  );
};

describe('POST /media', () => {
  it('counts what it stores', async () => {
    const res = await postMedia(JPEG);
    expect(res.status).toBe(200);
    const usage = await (
      await handleMediaRequest(
        new Request('https://worker.test/media/usage', { headers: { Authorization: 'Bearer valid-token' } }),
        env,
        ctx,
        deps,
      )
    ).json();
    expect(usage).toMatchObject({
      usedBytes: JPEG.length,
      limitBytes: 8 * GIB,
      userUsedBytes: JPEG.length,
      userLimitBytes: 1 * GIB,
      monthlyWrites: 1,
    });
  });

  it('refuses with 507 storage_full a write that would pass 8 GiB, and writes nothing', async () => {
    seedUsed(8 * GIB - 5);
    const res = await postMedia(JPEG);
    expect(res.status).toBe(507);
    expect(await res.json()).toEqual({ error: { code: 'storage_full', message: expect.stringMatching(/full/i) } });
    expect(r2.store.size).toBe(0);
  });

  it('refuses the request up front when storage is already full (body is not read)', async () => {
    seedUsed(8 * GIB);
    const req = new Request('https://worker.test/media', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'content-type': 'multipart/form-data; boundary=x' },
      body: new ReadableStream({
        pull() {
          throw new Error('body was read');
        },
      }),
      // @ts-expect-error duplex is required for stream bodies in undici
      duplex: 'half',
    });
    const res = await handleMediaRequest(req, env, ctx, deps);
    expect(res.status).toBe(507);
  });

  it('refuses at the per-user cap, other users unaffected', async () => {
    env.MEDIA_USER_MAX_BYTES = String(JPEG.length + 5);
    expect((await postMedia(JPEG)).status).toBe(200);
    const res = await postMedia(JPEG);
    expect(res.status).toBe(507);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('storage_full');
    expect(r2.store.size).toBe(1);
    expect((await postMedia(JPEG, 'stranger-token')).status).toBe(403); // not allow-listed: untouched by quota
  });

  it('refuses beyond the monthly write cap with the same error shape', async () => {
    env.MEDIA_MAX_WRITES_PER_MONTH = '2';
    expect((await postMedia(JPEG)).status).toBe(200);
    expect((await postMedia(JPEG)).status).toBe(200);
    const res = await postMedia(JPEG);
    expect(res.status).toBe(507);
    expect(await res.json()).toEqual({ error: { code: 'storage_full', message: expect.stringMatching(/month/i) } });
    expect(r2.store.size).toBe(2);
  });

  it('refuses all writes (500) when the ceiling is configured above 9 GiB', async () => {
    env.MEDIA_MAX_BYTES = String(10 * GIB);
    const res = await postMedia(JPEG);
    expect(res.status).toBe(500);
    expect(r2.store.size).toBe(0);
  });

  it('two concurrent uploads that only fit one at a time: the second is refused', async () => {
    env.MEDIA_MAX_BYTES = String(JPEG.length + 3);
    const [a, b] = await Promise.all([postMedia(JPEG), postMedia(JPEG)]);
    expect([a.status, b.status].sort()).toEqual([200, 507]);
    expect(r2.store.size).toBe(1);
  });

  it('a failed R2 put gives its reservation back', async () => {
    env.MEDIA_MAX_BYTES = String(JPEG.length + 3);
    const realPut = r2.put.bind(r2);
    r2.put = vi.fn(async () => {
      throw new Error('R2 down');
    }) as typeof r2.put;
    await expect(postMedia(JPEG)).rejects.toThrow('R2 down');
    r2.put = realPut;
    expect((await postMedia(JPEG)).status).toBe(200);
  });
});

describe('GET /media/usage', () => {
  const get = (token?: string) =>
    handleMediaRequest(
      new Request('https://worker.test/media/usage', { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
      env,
      ctx,
      deps,
    );

  it('needs a valid, allow-listed sign-in', async () => {
    expect((await get()).status).toBe(401);
    expect((await get('nope')).status).toBe(401);
    expect((await get('stranger-token')).status).toBe(403);
  });

  it('returns the four numbers for the caller', async () => {
    seedUsed(5000, 700);
    const res = await get('valid-token');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      usedBytes: 5000,
      limitBytes: 8 * GIB,
      userUsedBytes: 700,
      userLimitBytes: 1 * GIB,
    });
  });

  it('is not shadowed by the media-file route', async () => {
    const post = await handleMediaRequest(
      new Request('https://worker.test/media/usage', { method: 'POST', headers: { Authorization: 'Bearer valid-token' } }),
      env,
      ctx,
      deps,
    );
    expect(post.status).toBe(405);
  });
});

describe('upload link', () => {
  const seedExercise = () => fs.put(['users', 'user123', 'customExercises', 'row'], { name: 'Row', videoLinks: [] });
  const upload = (token: string, bytes = GIF) => {
    const form = new FormData();
    form.append('file', new Blob([bytes]));
    return handleMediaRequest(
      new Request(`https://worker.test/upload/${token}`, { method: 'POST', headers: { Accept: 'application/json' }, body: form }),
      env,
      ctx,
      deps,
    );
  };

  it('refuses a full store with 507 and keeps the single-use link valid', async () => {
    seedExercise();
    const { token } = await createUploadToken(kv, 'user123', 'row');
    seedUsed(8 * GIB);
    const res = await upload(token);
    expect(res.status).toBe(507);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('storage_full');
    expect(r2.store.size).toBe(0);

    seedUsed(0); // space was freed: the same link still works
    expect((await upload(token)).status).toBe(200);
    expect(r2.store.size).toBe(1);
  });

  it('refuses a file that would pass the cap even though there is some room', async () => {
    seedExercise();
    const { token } = await createUploadToken(kv, 'user123', 'row');
    seedUsed(8 * GIB - 5);
    expect((await upload(token)).status).toBe(507);
    expect(r2.store.size).toBe(0);
  });

  it('removes the stored object and its bytes when attaching fails', async () => {
    const { token } = await createUploadToken(kv, 'user123', 'row');
    seedExercise();
    const original = fs.client();
    deps.firestore = () =>
      Object.assign(Object.create(original), {
        patch: async () => {
          throw new Error('firestore down');
        },
      });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await upload(token);
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(r2.store.size).toBe(0);
    expect(JSON.parse(kv.store.get('media_quota:total')!).usedBytes).toBe(0);
    expect(JSON.parse(kv.store.get('media_quota:user:user123')!).usedBytes).toBe(0);
  });
});

describe('connector tools', () => {
  const NOW = new Date('2026-10-30T12:00:00.000Z');
  let fetchMock: () => Promise<Response>;
  let toolCtx: { data: UserData; mediaQuota: ReturnType<typeof mediaQuotaFor> };

  beforeEach(() => {
    fetchMock = async () => new Response(JPEG, { status: 200, headers: { 'content-type': 'image/jpeg' } });
    const quota = mediaQuotaFor(env, 'user123');
    toolCtx = {
      mediaQuota: quota,
      data: new UserData(fs.client(), 'user123', {
        now: () => NOW,
        r2: quota.guard(r2),
        kv,
        origin: 'https://workout-ai.test',
        fetchImpl: () => fetchMock(),
      }),
    };
    fs.put(['users', 'user123'], { email: 'owner@example.com', displayName: 'Owner', createdAt: NOW });
    fs.put(['users', 'user123', 'customExercises', 'row'], { name: 'Row Rig', videoLinks: [] });
  });

  it('attach_media_from_url stores and counts the file', async () => {
    const r = await runAgentTool('attach_media_from_url', { exercise_id: 'row', url: 'https://example.com/a.jpg' }, toolCtx);
    expect(r.ok).toBe(true);
    expect(JSON.parse(kv.store.get('media_quota:total')!).usedBytes).toBe(JPEG.length);
  });

  it('attach_media_from_url returns a storage_full message and stores nothing when full', async () => {
    seedUsed(8 * GIB);
    const r = await runAgentTool('attach_media_from_url', { exercise_id: 'row', url: 'https://example.com/a.jpg' }, toolCtx);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/^storage_full: .*full/i) });
    expect(r2.store.size).toBe(0);
  });

  it('attach_media_from_url is refused by the put guard too when only the file would not fit', async () => {
    seedUsed(8 * GIB - 5);
    const r = await runAgentTool('attach_media_from_url', { exercise_id: 'row', url: 'https://example.com/a.jpg' }, toolCtx);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/^storage_full:/) });
    expect(r2.store.size).toBe(0);
    expect(fs.read(['users', 'user123', 'customExercises', 'row'])?.videoLinks).toEqual([]);
  });

  it('create_media_upload_link returns storage_full instead of a link when full', async () => {
    seedUsed(0, 1 * GIB);
    const r = await runAgentTool('create_media_upload_link', { exercise_id: 'row' }, toolCtx);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/^storage_full: Your media storage is full/) });
    expect([...kv.store.keys()].some((k) => k.startsWith('upload_token'))).toBe(false);
  });

  it('create_media_upload_link still works with room', async () => {
    const r = await runAgentTool('create_media_upload_link', { exercise_id: 'row' }, toolCtx);
    expect(r.ok).toBe(true);
  });

  it('the monthly write cap reaches the tools as storage_full', async () => {
    kv.store.set('media_quota:ops', JSON.stringify({ month: new Date().toISOString().slice(0, 7), count: 100_000 }));
    const r = await runAgentTool('create_media_upload_link', { exercise_id: 'row' }, toolCtx);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/^storage_full:.*month/i) });
  });
});

describe('daily cron', () => {
  it('scheduled() reconciles the counters from the bucket', async () => {
    const { createWorker } = await import('../main');
    await r2.put('user123/a.jpg', new Uint8Array(300));
    await r2.put('other/b.mp4', new Uint8Array(200));
    seedUsed(123456789, 5);
    const waits: Promise<unknown>[] = [];
    const worker = createWorker(deps);
    worker.scheduled({} as ScheduledController, env, { waitUntil: (p: Promise<unknown>) => waits.push(p) } as unknown as ExecutionContext);
    await Promise.all(waits);
    expect(JSON.parse(kv.store.get('media_quota:total')!)).toEqual({ usedBytes: 500, reservedBytes: 0 });
    expect(JSON.parse(kv.store.get('media_quota:user:user123')!).usedBytes).toBe(300);
    expect(kv.store.has('media_quota:reconciled')).toBe(true);
  });

  it('scheduled() does nothing without a bucket or KV', async () => {
    const { createWorker } = await import('../main');
    const worker = createWorker(deps);
    const waitUntil = vi.fn();
    worker.scheduled({} as ScheduledController, { ...env, EXERCISE_MEDIA: undefined }, { waitUntil } as unknown as ExecutionContext);
    expect(waitUntil).not.toHaveBeenCalled();
  });
});
