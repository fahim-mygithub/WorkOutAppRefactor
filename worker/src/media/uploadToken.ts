import { UPLOAD_TOKEN_TTL_SECONDS, type UploadTokenPayload } from './types';

export function generateUploadToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

/**
 * Creates a single-use upload token bound to uid + exerciseId with 15-minute expiry in KV.
 */
export async function createUploadToken(
  kv: KVNamespace,
  uid: string,
  exerciseId: string,
): Promise<{ token: string; expiresSeconds: number }> {
  const token = generateUploadToken();
  const payload: UploadTokenPayload = {
    uid,
    exerciseId,
    createdAt: Date.now(),
  };
  await kv.put(`upload_token:${token}`, JSON.stringify(payload), {
    expirationTtl: UPLOAD_TOKEN_TTL_SECONDS,
  });
  return { token, expiresSeconds: UPLOAD_TOKEN_TTL_SECONDS };
}

/**
 * Retrieves the upload token payload without consuming it (e.g. for GET page verification).
 */
export async function getUploadToken(
  kv: KVNamespace,
  token: string,
): Promise<UploadTokenPayload | null> {
  if (!token || token.length < 16) return null;
  const raw = await kv.get(`upload_token:${token}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UploadTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Consumes the upload token, deleting it immediately so it cannot be used again (single-use).
 */
export async function consumeUploadToken(
  kv: KVNamespace,
  token: string,
): Promise<UploadTokenPayload | null> {
  const payload = await getUploadToken(kv, token);
  if (!payload) return null;
  await kv.delete(`upload_token:${token}`);
  return payload;
}
