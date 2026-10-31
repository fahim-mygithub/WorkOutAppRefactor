import type { McpEnv } from '../mcp/env';
import type { MainDeps } from '../main';
import { isAllowed, nextUsage, type Usage } from '../access';
import { maxBytesForKind, type MediaErrorCode, type MediaErrorResponse } from './types';
import { mimeFromExt, sniffMediaType } from './sniff';
import { assertMediaOwner, generateMediaId, validateMediaKey } from './storage';
import { consumeUploadToken, getUploadToken } from './uploadToken';
import { UserData } from '../data/userData';

export function isMediaPath(pathname: string): boolean {
  return (
    pathname === '/media' ||
    pathname.startsWith('/media/') ||
    pathname.startsWith('/upload/')
  );
}

function jsonError(status: number, code: MediaErrorCode, message: string, corsOrigin?: string): Response {
  const body: MediaErrorResponse = { error: { code, message } };
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (corsOrigin) {
    headers['access-control-allow-origin'] = corsOrigin;
    headers['vary'] = 'origin';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function parseUsage(raw: string | null): Usage | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Usage;
  } catch {
    return undefined;
  }
}

export async function takeDailyUploadSlot(
  kv: KVNamespace,
  uid: string,
  limit: number,
): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const key = `media_usage:${uid}`;
  const next = nextUsage(parseUsage(await kv.get(key)), today, limit);
  if (!next.ok) return false;
  await kv.put(key, JSON.stringify(next.usage), { expirationTtl: 60 * 60 * 48 });
  return true;
}

function getMatchingOrigin(request: Request, allowedOriginsStr?: string): string | undefined {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOriginsStr) return undefined;
  const allowed = allowedOriginsStr.split(',').map((o) => o.trim().toLowerCase());
  return allowed.includes(origin.toLowerCase()) ? origin : undefined;
}

export async function handleMediaRequest(
  request: Request,
  env: McpEnv,
  ctx: ExecutionContext,
  deps: MainDeps,
): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const corsOrigin = getMatchingOrigin(request, env.ALLOWED_ORIGINS);

  // -------------------------------------------------------------------------
  // Preflight OPTIONS for /media and /media/*
  // -------------------------------------------------------------------------
  if (request.method === 'OPTIONS') {
    const headers = new Headers();
    if (corsOrigin) {
      headers.set('access-control-allow-origin', corsOrigin);
      headers.set('access-control-allow-methods', 'GET, HEAD, POST, OPTIONS');
      headers.set('access-control-allow-headers', 'authorization, content-type, range');
      headers.set('access-control-max-age', '86400');
      headers.set('vary', 'origin');
    }
    return new Response(null, { status: 204, headers });
  }

  // -------------------------------------------------------------------------
  // 1. GET /media/<uid>/<id>.<ext> (or HEAD)
  // -------------------------------------------------------------------------
  if (pathname.startsWith('/media/')) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return jsonError(405, 'invalid-argument', 'Method not allowed.', corsOrigin);
    }
    const key = pathname.slice('/media/'.length);
    let parsedKey: { uid: string; fileWithExt: string; id: string; ext: string };
    try {
      parsedKey = validateMediaKey(key);
    } catch {
      return jsonError(400, 'invalid-argument', 'Invalid media path format.', corsOrigin);
    }

    if (!env.EXERCISE_MEDIA) {
      return jsonError(500, 'internal', 'Media storage bucket is not configured.', corsOrigin);
    }

    const rangeHeader = request.headers.get('range');
    const object = await env.EXERCISE_MEDIA.get(
      key,
      rangeHeader ? { range: request.headers } : undefined,
    );

    if (!object) {
      return new Response('Not found', { status: 404, headers: corsOrigin ? { 'access-control-allow-origin': corsOrigin } : {} });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    if (!headers.has('content-type')) {
      headers.set('content-type', mimeFromExt(parsedKey.ext));
    }
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    headers.set('accept-ranges', 'bytes');
    if (object.httpEtag) {
      headers.set('etag', object.httpEtag);
    }

    if (corsOrigin) {
      headers.set('access-control-allow-origin', corsOrigin);
      headers.set('access-control-allow-methods', 'GET, HEAD, OPTIONS');
      headers.set('access-control-expose-headers', 'content-range, content-length, accept-ranges, content-type, etag');
      headers.set('vary', 'origin, range');
    }

    // Range responses: 206 Partial Content
    if (object.range) {
      const off = 'offset' in object.range && typeof object.range.offset === 'number'
        ? object.range.offset
        : object.size - (object.range as { suffix: number }).suffix;
      const len = 'length' in object.range && typeof object.range.length === 'number'
        ? object.range.length
        : object.size - off;
      const end = off + len - 1;
      headers.set('content-range', `bytes ${off}-${end}/${object.size}`);
      headers.set('content-length', String(len));

      if (request.method === 'HEAD') {
        return new Response(null, { status: 206, headers });
      }
      return new Response(object.body, { status: 206, headers });
    }

    headers.set('content-length', String(object.size));
    if (request.method === 'HEAD') {
      return new Response(null, { status: 200, headers });
    }
    return new Response(object.body, { status: 200, headers });
  }

  // -------------------------------------------------------------------------
  // 2. POST /media (Firebase ID token, multipart)
  // -------------------------------------------------------------------------
  if (pathname === '/media') {
    if (request.method !== 'POST') {
      return jsonError(405, 'invalid-argument', 'Method not allowed.', corsOrigin);
    }

    // Check Authorization: Bearer <Firebase ID token>
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonError(401, 'unauthenticated', 'Missing or invalid Authorization header.', corsOrigin);
    }
    const token = authHeader.slice('Bearer '.length).trim();

    let user: { uid: string; email?: string };
    try {
      user = await deps.verify(token, env.FIREBASE_PROJECT_ID);
    } catch {
      return jsonError(401, 'unauthenticated', 'Sign in to upload exercise media.', corsOrigin);
    }

    // Check allow-list
    if (!isAllowed(user.email, env.AI_ALLOWED_EMAILS)) {
      return jsonError(403, 'permission-denied', 'This account is not enabled.', corsOrigin);
    }

    // Check daily upload cap via KV
    const dailyLimit = Number(env.AI_DAILY_LIMIT) || 50;
    if (env.AI_USAGE) {
      const allowed = await takeDailyUploadSlot(env.AI_USAGE, user.uid, dailyLimit);
      if (!allowed) {
        return jsonError(429, 'resource-exhausted', 'Daily media upload limit exceeded.', corsOrigin);
      }
    }

    // Parse multipart form
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return jsonError(400, 'invalid-argument', 'Expected multipart/form-data request body.', corsOrigin);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonError(400, 'invalid-argument', 'Failed to parse multipart form data.', corsOrigin);
    }

    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return jsonError(400, 'invalid-argument', 'Missing "file" field in multipart body.', corsOrigin);
    }

    const arrayBuffer = await (file as Blob).arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (bytes.length === 0) {
      return jsonError(400, 'invalid-argument', 'File is empty.', corsOrigin);
    }

    if (bytes.length > 60 * 1024 * 1024) {
      return jsonError(413, 'payload-too-large', 'File exceeds the maximum 60 MB size limit.', corsOrigin);
    }

    // Sniff magic bytes
    const sniffed = sniffMediaType(bytes);
    if (!sniffed) {
      return jsonError(
        415,
        'unsupported-media-type',
        'Unsupported media format. Expected photo (jpeg/png/webp/heic), gif, or video (mp4/webm/mov).',
        corsOrigin,
      );
    }

    // Check size limit for the detected kind
    const cap = maxBytesForKind(sniffed.kind);
    if (bytes.length > cap) {
      return jsonError(
        413,
        'payload-too-large',
        `File size (${bytes.length} bytes) exceeds limit for ${sniffed.kind} (${cap} bytes).`,
        corsOrigin,
      );
    }

    if (!env.EXERCISE_MEDIA) {
      return jsonError(500, 'internal', 'Media storage bucket is not configured.', corsOrigin);
    }

    // Store in R2 for this verified user's UID only
    const id = generateMediaId();
    const key = `${user.uid}/${id}.${sniffed.ext}`;

    // Verify ownership invariant
    assertMediaOwner(key.split('/')[0], user.uid);

    await env.EXERCISE_MEDIA.put(key, bytes, {
      httpMetadata: {
        contentType: sniffed.mime,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });

    const absoluteUrl = `https://${url.host}/media/${user.uid}/${id}.${sniffed.ext}`;
    const resultHeaders: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (corsOrigin) {
      resultHeaders['access-control-allow-origin'] = corsOrigin;
      resultHeaders['vary'] = 'origin';
    }

    return new Response(
      JSON.stringify({
        url: absoluteUrl,
        kind: sniffed.kind,
        bytes: bytes.length,
      }),
      { status: 200, headers: resultHeaders },
    );
  }

  // -------------------------------------------------------------------------
  // 3. /upload/<token> (GET serving upload HTML, POST consuming token + R2 upload + Firestore attach)
  // -------------------------------------------------------------------------
  if (pathname.startsWith('/upload/')) {
    const token = pathname.slice('/upload/'.length).trim();
    if (!token) {
      return new Response('Not found', { status: 404 });
    }

    if (!env.AI_USAGE) {
      return jsonError(500, 'internal', 'Upload token storage is not configured.');
    }

    // GET /upload/<token> -> serve tiny mobile page
    if (request.method === 'GET') {
      const payload = await getUploadToken(env.AI_USAGE, token);
      if (!payload) {
        return new Response(
          `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Upload link expired</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 2rem; text-align: center; color: #1e293b; max-width: 480px; margin: 2rem auto; }
    h2 { color: #dc2626; }
    p { color: #64748b; line-height: 1.5; }
  </style>
</head>
<body>
  <h2>Upload Link Expired or Used</h2>
  <p>This single-use upload link is invalid, expired, or has already been used. Please ask the WorkoutApp assistant to generate a new upload link.</p>
</body>
</html>`,
          { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } },
        );
      }

      return new Response(
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Upload Exercise Media</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 1.5rem; color: #0f172a; max-width: 480px; margin: 0 auto; background: #f8fafc; }
    .card { background: white; border-radius: 16px; padding: 1.75rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
    h2 { margin: 0 0 0.5rem 0; font-size: 1.35rem; }
    p { margin: 0 0 1.5rem 0; color: #64748b; font-size: 0.95rem; line-height: 1.4; }
    .dropzone { border: 2px dashed #94a3b8; border-radius: 12px; padding: 2rem 1rem; text-align: center; background: #f1f5f9; margin-bottom: 1.5rem; }
    input[type=file] { width: 100%; }
    button { width: 100%; background: #2563eb; color: white; border: none; padding: 0.85rem; font-size: 1rem; font-weight: 600; border-radius: 10px; cursor: pointer; }
    button:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Upload Exercise Media</h2>
    <p>Snap a photo, record a clip, or select a file to attach to your custom exercise.</p>
    <form method="POST" action="/upload/${token}" enctype="multipart/form-data">
      <div class="dropzone">
        <input type="file" name="file" accept="image/*,video/*" capture="environment" required>
      </div>
      <button type="submit">Upload & Attach</button>
    </form>
  </div>
</body>
</html>`,
        { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
      );
    }

    // POST /upload/<token> -> consume token, upload to R2, attach to custom exercise in Firestore
    if (request.method === 'POST') {
      const payload = await consumeUploadToken(env.AI_USAGE, token);
      if (!payload) {
        return jsonError(404, 'not-found', 'Upload token expired or already used.');
      }

      const contentType = request.headers.get('content-type') || '';
      if (!contentType.includes('multipart/form-data')) {
        return jsonError(400, 'invalid-argument', 'Expected multipart/form-data.');
      }

      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        return jsonError(400, 'invalid-argument', 'Failed to parse form data.');
      }

      const file = formData.get('file');
      if (!file || typeof file === 'string') {
        return jsonError(400, 'invalid-argument', 'Missing "file" field.');
      }

      const arrayBuffer = await (file as Blob).arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      if (bytes.length === 0) {
        return jsonError(400, 'invalid-argument', 'File is empty.');
      }

      if (bytes.length > 60 * 1024 * 1024) {
        return jsonError(413, 'payload-too-large', 'File exceeds the maximum 60 MB size limit.');
      }

      const sniffed = sniffMediaType(bytes);
      if (!sniffed) {
        return jsonError(415, 'unsupported-media-type', 'Unsupported media format.');
      }

      const cap = maxBytesForKind(sniffed.kind);
      if (bytes.length > cap) {
        return jsonError(413, 'payload-too-large', `File size exceeds ${sniffed.kind} limit of ${cap} bytes.`);
      }

      if (!env.EXERCISE_MEDIA) {
        return jsonError(500, 'internal', 'Media storage bucket is not configured.');
      }

      const id = generateMediaId();
      const key = `${payload.uid}/${id}.${sniffed.ext}`;

      // Enforce ownership: write must match token's bound uid
      assertMediaOwner(key.split('/')[0], payload.uid);

      await env.EXERCISE_MEDIA.put(key, bytes, {
        httpMetadata: {
          contentType: sniffed.mime,
          cacheControl: 'public, max-age=31536000, immutable',
        },
      });

      const mediaUrl = `https://${url.host}/media/${payload.uid}/${id}.${sniffed.ext}`;

      // Attach to custom exercise in Firestore
      try {
        const firestore = deps.firestore(env);
        const userData = new UserData(firestore, payload.uid);
        await userData.attachMediaToExercise(payload.exerciseId, mediaUrl);
      } catch (err) {
        console.error('Failed to attach media to custom exercise', err);
        return jsonError(500, 'internal', 'Failed to attach uploaded media to custom exercise.');
      }

      const acceptsJson = request.headers.get('accept')?.includes('application/json') ||
        request.headers.get('x-requested-with') === 'XMLHttpRequest';

      if (acceptsJson) {
        return new Response(
          JSON.stringify({ ok: true, url: mediaUrl, kind: sniffed.kind, bytes: bytes.length }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      return new Response(
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Upload Complete</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 2rem; text-align: center; color: #0f172a; max-width: 480px; margin: 2rem auto; }
    h2 { color: #16a34a; }
    p { color: #64748b; line-height: 1.5; }
  </style>
</head>
<body>
  <h2>Upload Successful!</h2>
  <p>The media demonstration has been saved and attached to your custom exercise. You can now return to the WorkoutApp or your chat assistant.</p>
</body>
</html>`,
        { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
      );
    }

    return jsonError(405, 'invalid-argument', 'Method not allowed.');
  }

  return new Response('Not found', { status: 404 });
}
