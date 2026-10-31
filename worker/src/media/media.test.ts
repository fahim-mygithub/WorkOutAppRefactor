import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  sniffMediaType,
  isMediaSizeAllowed,
  MAX_PHOTO_BYTES,
  MAX_GIF_BYTES,
  MAX_VIDEO_BYTES,
} from './sniff';
import { assertMediaOwner, validateMediaKey, MediaSecurityError } from './storage';
import { createUploadToken, consumeUploadToken, getUploadToken } from './uploadToken';
import { fakeR2 } from './testing/fakeR2';
import { memoryKv } from '../mcp/testing/memoryKv';
import { FakeFirestore } from '../data/testing/fakeFirestore';
import { handleMediaRequest } from './handler';
import type { McpEnv } from '../mcp/env';
import type { MainDeps } from '../main';

// Magic bytes samples
const SAMPLE_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const SAMPLE_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const SAMPLE_GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00]);
const SAMPLE_WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
const SAMPLE_WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);
const SAMPLE_MP4 = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x00, 0x00]);
const SAMPLE_MOV = new Uint8Array([0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20, 0x00, 0x00, 0x00, 0x00]);
const SAMPLE_HEIC = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00]);

describe('Media: Sniffing & Size Caps', () => {
  it('correctly sniffs photo types (jpeg, png, webp, heic)', () => {
    expect(sniffMediaType(SAMPLE_JPEG)).toEqual({ kind: 'photo', ext: 'jpg', mime: 'image/jpeg' });
    expect(sniffMediaType(SAMPLE_PNG)).toEqual({ kind: 'photo', ext: 'png', mime: 'image/png' });
    expect(sniffMediaType(SAMPLE_WEBP)).toEqual({ kind: 'photo', ext: 'webp', mime: 'image/webp' });
    expect(sniffMediaType(SAMPLE_HEIC)).toEqual({ kind: 'photo', ext: 'heic', mime: 'image/heic' });
  });

  it('correctly sniffs gif', () => {
    expect(sniffMediaType(SAMPLE_GIF)).toEqual({ kind: 'gif', ext: 'gif', mime: 'image/gif' });
  });

  it('correctly sniffs video types (mp4, webm, mov)', () => {
    expect(sniffMediaType(SAMPLE_MP4)).toEqual({ kind: 'video', ext: 'mp4', mime: 'video/mp4' });
    expect(sniffMediaType(SAMPLE_WEBM)).toEqual({ kind: 'video', ext: 'webm', mime: 'video/webm' });
    expect(sniffMediaType(SAMPLE_MOV)).toEqual({ kind: 'video', ext: 'mov', mime: 'video/quicktime' });
  });

  it('rejects unknown or invalid types', () => {
    expect(sniffMediaType(new Uint8Array([]))).toBeNull();
    expect(sniffMediaType(new TextEncoder().encode('<html><body>not media</body></html>'))).toBeNull();
    expect(sniffMediaType(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]))).toBeNull();
  });

  it('enforces size caps per media kind', () => {
    expect(isMediaSizeAllowed('photo', MAX_PHOTO_BYTES)).toBe(true);
    expect(isMediaSizeAllowed('photo', MAX_PHOTO_BYTES + 1)).toBe(false);

    expect(isMediaSizeAllowed('gif', MAX_GIF_BYTES)).toBe(true);
    expect(isMediaSizeAllowed('gif', MAX_GIF_BYTES + 1)).toBe(false);

    expect(isMediaSizeAllowed('video', MAX_VIDEO_BYTES)).toBe(true);
    expect(isMediaSizeAllowed('video', MAX_VIDEO_BYTES + 1)).toBe(false);

    expect(isMediaSizeAllowed('photo', 0)).toBe(false);
  });
});

describe('Media: Storage & Cross-UID Protection', () => {
  it('refuses cross-uid writes', () => {
    expect(() => assertMediaOwner('userA', 'userA')).not.toThrow();
    expect(() => assertMediaOwner('userB', 'userA')).toThrow(MediaSecurityError);
    expect(() => assertMediaOwner('', 'userA')).toThrow(MediaSecurityError);
  });

  it('validates key format and enforces matching uid', () => {
    const valid = validateMediaKey('user123/file456.mp4', 'user123');
    expect(valid).toEqual({ uid: 'user123', fileWithExt: 'file456.mp4', id: 'file456', ext: 'mp4' });

    // Cross-UID mismatch throws
    expect(() => validateMediaKey('userA/file456.mp4', 'userB')).toThrow(MediaSecurityError);

    // Path traversal or invalid format throws
    expect(() => validateMediaKey('../etc/passwd')).toThrow(MediaSecurityError);
    expect(() => validateMediaKey('user123/../../bad.jpg')).toThrow(MediaSecurityError);
    expect(() => validateMediaKey('user123')).toThrow(MediaSecurityError);
  });
});

describe('Media: Upload Token Single-Use & Expiry', () => {
  it('creates, retrieves, and consumes a token once only', async () => {
    const kv = memoryKv();
    const { token } = await createUploadToken(kv, 'lifter1', 'ex-bench');
    expect(token).toBeDefined();

    // Peeking with getUploadToken does not consume it
    const peek = await getUploadToken(kv, token);
    expect(peek).toEqual(expect.objectContaining({ uid: 'lifter1', exerciseId: 'ex-bench' }));

    // Consuming once succeeds
    const consumed = await consumeUploadToken(kv, token);
    expect(consumed).toEqual(expect.objectContaining({ uid: 'lifter1', exerciseId: 'ex-bench' }));

    // Consuming a second time returns null (single use!)
    const secondConsume = await consumeUploadToken(kv, token);
    expect(secondConsume).toBeNull();

    // After consume, getUploadToken also returns null
    expect(await getUploadToken(kv, token)).toBeNull();
  });

  it('returns null for unknown tokens', async () => {
    const kv = memoryKv();
    expect(await consumeUploadToken(kv, 'nonexistent-token')).toBeNull();
  });
});

describe('Media: Endpoints & Routing', () => {
  let env: McpEnv;
  let r2: ReturnType<typeof fakeR2>;
  let kv: ReturnType<typeof memoryKv>;
  let fs: FakeFirestore;
  let deps: MainDeps;
  const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;

  beforeEach(() => {
    r2 = fakeR2();
    kv = memoryKv();
    fs = new FakeFirestore();
    env = {
      ANTHROPIC_API_KEY: 'test-key',
      FIREBASE_PROJECT_ID: 'test-project',
      ALLOWED_ORIGINS: 'https://app.test,http://localhost:5290',
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

  it('GET /media/<uid>/<id>.<ext> serves content type, long cache headers, and ETag', async () => {
    await r2.put('user123/clip1.mp4', SAMPLE_MP4, {
      httpMetadata: { contentType: 'video/mp4', cacheControl: 'public, max-age=31536000, immutable' },
    });

    const req = new Request('https://worker.test/media/user123/clip1.mp4', {
      headers: { Origin: 'https://app.test' },
    });
    const res = await handleMediaRequest(req, env, ctx, deps);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('video/mp4');
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.test');
    expect(res.headers.get('content-length')).toBe(String(SAMPLE_MP4.length));

    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes).toEqual(SAMPLE_MP4);
  });

  it('GET /media/<uid>/<id>.<ext> serves 206 Range requests', async () => {
    await r2.put('user123/clip1.mp4', SAMPLE_MP4, {
      httpMetadata: { contentType: 'video/mp4' },
    });

    const req = new Request('https://worker.test/media/user123/clip1.mp4', {
      headers: { Range: 'bytes=0-3' },
    });
    const res = await handleMediaRequest(req, env, ctx, deps);

    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe(`bytes 0-3/${SAMPLE_MP4.length}`);
    expect(res.headers.get('content-length')).toBe('4');
    const slice = new Uint8Array(await res.arrayBuffer());
    expect(slice).toEqual(SAMPLE_MP4.slice(0, 4));
  });

  it('POST /media: refuses unauthenticated or non-allowlisted callers', async () => {
    // Missing auth header
    const noAuth = new Request('https://worker.test/media', { method: 'POST' });
    const r1 = await handleMediaRequest(noAuth, env, ctx, deps);
    expect(r1.status).toBe(401);
    expect(await r1.json()).toEqual({ error: { code: 'unauthenticated', message: expect.any(String) } });

    // Not allow-listed email
    const formData = new FormData();
    formData.append('file', new Blob([SAMPLE_PNG], { type: 'image/png' }));
    const notAllowed = new Request('https://worker.test/media', {
      method: 'POST',
      headers: { Authorization: 'Bearer stranger-token' },
      body: formData,
    });
    const r2 = await handleMediaRequest(notAllowed, env, ctx, deps);
    expect(r2.status).toBe(403);
    expect(await r2.json()).toEqual({ error: { code: 'permission-denied', message: expect.any(String) } });
  });

  it('POST /media: uploads photo and returns {url, kind, bytes}', async () => {
    const formData = new FormData();
    formData.append('file', new Blob([SAMPLE_JPEG], { type: 'image/jpeg' }), 'photo.jpg');

    const req = new Request('https://worker.test/media', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        Origin: 'https://app.test',
      },
      body: formData,
    });

    const res = await handleMediaRequest(req, env, ctx, deps);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string; kind: string; bytes: number };

    expect(body.kind).toBe('photo');
    expect(body.bytes).toBe(SAMPLE_JPEG.length);
    expect(body.url).toMatch(/^https:\/\/worker\.test\/media\/user123\/[a-f0-9]+\.jpg$/);

    // Check stored in R2
    const key = new URL(body.url).pathname.replace('/media/', '');
    const obj = await r2.get(key);
    expect(obj).not.toBeNull();
  });

  it('POST /media: rejects unsupported media format (415)', async () => {
    const formData = new FormData();
    formData.append('file', new Blob([new TextEncoder().encode('plain text file')], { type: 'text/plain' }));

    const req = new Request('https://worker.test/media', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
      body: formData,
    });

    const res = await handleMediaRequest(req, env, ctx, deps);
    expect(res.status).toBe(415);
    expect(await res.json()).toEqual({ error: { code: 'unsupported-media-type', message: expect.any(String) } });
  });

  it('POST /media: rejects oversized file (413)', async () => {
    // Fake large photo: starts with JPEG magic bytes, followed by > 8 MB of zeros
    const bigPhoto = new Uint8Array(MAX_PHOTO_BYTES + 100);
    bigPhoto.set(SAMPLE_JPEG);

    const formData = new FormData();
    formData.append('file', new Blob([bigPhoto]));

    const req = new Request('https://worker.test/media', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
      body: formData,
    });

    const res = await handleMediaRequest(req, env, ctx, deps);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: { code: 'payload-too-large', message: expect.any(String) } });
  });

  it('Upload link flow: GET serves HTML form; POST consumes token and attaches media in Firestore', async () => {
    const { token } = await createUploadToken(kv, 'user123', 'custom-row');

    // Seed custom exercise in Firestore
    fs.put(['users', 'user123', 'customExercises', 'custom-row'], {
      name: 'Custom Row',
      videoLinks: [],
    });

    // GET /upload/<token>
    const getReq = new Request(`https://worker.test/upload/${token}`, { method: 'GET' });
    const getRes = await handleMediaRequest(getReq, env, ctx, deps);
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get('content-type')).toContain('text/html');
    const html = await getRes.text();
    expect(html).toContain('Upload Exercise Media');
    expect(html).toContain('capture="environment"');

    // POST /upload/<token> with GIF
    const postForm = new FormData();
    postForm.append('file', new Blob([SAMPLE_GIF]));

    const postReq = new Request(`https://worker.test/upload/${token}`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: postForm,
    });
    const postRes = await handleMediaRequest(postReq, env, ctx, deps);
    expect(postRes.status).toBe(200);
    const postBody = (await postRes.json()) as { ok: boolean; url: string; kind: string };
    expect(postBody.ok).toBe(true);
    expect(postBody.kind).toBe('gif');
    expect(postBody.url).toMatch(/\.gif$/);

    // Firestore custom exercise updated with videoLinks
    const updated = fs.read(['users', 'user123', 'customExercises', 'custom-row']);
    expect(updated?.videoLinks).toEqual([postBody.url]);

    // Token was consumed; calling again returns 404
    const reuseRes = await handleMediaRequest(postReq, env, ctx, deps);
    expect(reuseRes.status).toBe(404);
  });
});
