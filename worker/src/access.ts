/** Who may call the AI, and how often. */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { AiError } from './errors';

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

/** Verifies a Firebase Auth ID token (RS256, issuer/audience = the project). */
export async function verifyIdToken(
  token: string,
  projectId: string,
  keys: JWTVerifyGetKey = GOOGLE_JWKS,
): Promise<{ uid: string; email?: string }> {
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
    });
    if (!payload.sub) throw new Error('no subject');
    // Unverified addresses must not pass the allow-list: anyone can sign up with a friend's email.
    const email = payload.email_verified === true && typeof payload.email === 'string' ? payload.email : undefined;
    return { uid: payload.sub, email };
  } catch {
    throw new AiError('unauthenticated', 'Sign in to use the AI assistant.');
  }
}

export function isAllowed(email: string | undefined, list: string): boolean {
  if (!email) return false;
  const allowed = list.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

export interface Usage { day: string; count: number }

export function nextUsage(prev: Usage | undefined, today: string, limit: number): { ok: true; usage: Usage } | { ok: false } {
  const count = prev?.day === today ? prev.count : 0;
  if (count >= limit) return { ok: false };
  return { ok: true, usage: { day: today, count: count + 1 } };
}

/** A missing or unparsable KV value counts as no record. */
function parseUsage(raw: string | null): Usage | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Usage;
  } catch {
    return undefined;
  }
}

/**
 * Counts one request for `uid`. KV is eventually consistent, so two requests
 * in the same instant can both pass — fine for a soft per-person limit; the
 * Anthropic Console spend cap is the hard stop.
 */
export async function takeDailySlot(kv: KVNamespace, uid: string, limit: number): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const key = `usage:${uid}`;
  const next = nextUsage(parseUsage(await kv.get(key)), today, limit);
  if (!next.ok) return false;
  await kv.put(key, JSON.stringify(next.usage), { expirationTtl: 60 * 60 * 48 });
  return true;
}
