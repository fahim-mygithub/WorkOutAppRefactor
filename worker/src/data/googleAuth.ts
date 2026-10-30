/**
 * Google OAuth access tokens for a service account (secret
 * FIREBASE_SERVICE_ACCOUNT, the JSON key file). Signs a JWT-bearer assertion
 * with `jose` and caches the access token until a minute before it expires.
 */
import { importPKCS8, SignJWT } from 'jose';

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id?: string;
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const DATASTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';

export function parseServiceAccount(raw: string | undefined): ServiceAccount {
  if (!raw?.trim()) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
  }
  const sa = parsed as Partial<ServiceAccount>;
  if (typeof sa.client_email !== 'string' || typeof sa.private_key !== 'string') {
    throw new Error('FIREBASE_SERVICE_ACCOUNT needs client_email and private_key');
  }
  return { client_email: sa.client_email, private_key: sa.private_key, project_id: sa.project_id };
}

export type AccessTokenSource = () => Promise<string>;

interface Cached { token: string; expiresAt: number }
const cache = new Map<string, Cached>();

/** Test hook: forget cached tokens. */
export function clearTokenCache(): void {
  cache.clear();
}

export function serviceAccountTokenSource(
  sa: ServiceAccount,
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): AccessTokenSource {
  return async () => {
    const hit = cache.get(sa.client_email);
    if (hit && hit.expiresAt - 60_000 > now()) return hit.token;
    const iat = Math.floor(now() / 1000);
    const key = await importPKCS8(sa.private_key, 'RS256');
    const assertion = await new SignJWT({ scope: DATASTORE_SCOPE })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(sa.client_email)
      .setSubject(sa.client_email)
      .setAudience(TOKEN_URL)
      .setIssuedAt(iat)
      .setExpirationTime(iat + 3600)
      .sign(key);
    const res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
    });
    if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new Error('Google token exchange returned no access_token');
    cache.set(sa.client_email, { token: body.access_token, expiresAt: now() + (body.expires_in ?? 3600) * 1000 });
    return body.access_token;
  };
}
