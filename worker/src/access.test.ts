import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet, type JWK } from 'jose';
import { isAllowed, nextUsage, verifyIdToken, takeDailySlot } from './access';

const PROJECT = 'workout-pwa-nf0sf';
let privateKey: CryptoKey;
let jwks: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey as CryptoKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' } as JWK;
  jwks = createLocalJWKSet({ keys: [jwk] });
});

const token = (claims: Record<string, unknown>, opts: { iss?: string; aud?: string; exp?: string } = {}) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(opts.iss ?? `https://securetoken.google.com/${PROJECT}`)
    .setAudience(opts.aud ?? PROJECT)
    .setSubject('uid-1')
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '1h')
    .sign(privateKey);

describe('verifyIdToken', () => {
  it('returns uid and email for a valid token', async () => {
    await expect(verifyIdToken(await token({ email: 'me@x.io', email_verified: true }), PROJECT, jwks)).resolves.toEqual({ uid: 'uid-1', email: 'me@x.io' });
  });
  it('drops an unverified email', async () => {
    await expect(verifyIdToken(await token({ email: 'me@x.io', email_verified: false }), PROJECT, jwks)).resolves.toEqual({ uid: 'uid-1', email: undefined });
  });
  it('rejects the wrong project, the wrong issuer or an expired token', async () => {
    await expect(verifyIdToken(await token({}, { aud: 'other' }), PROJECT, jwks)).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(verifyIdToken(await token({}, { iss: 'https://securetoken.google.com/other' }), PROJECT, jwks)).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(verifyIdToken(await token({}, { exp: '-1m' }), PROJECT, jwks)).rejects.toMatchObject({ code: 'unauthenticated' });
  });
  it('rejects an HS256-signed token', async () => {
    const hs = await new SignJWT({ email: 'me@x.io', email_verified: true })
      .setProtectedHeader({ alg: 'HS256', kid: 'k1' })
      .setIssuer(`https://securetoken.google.com/${PROJECT}`)
      .setAudience(PROJECT)
      .setSubject('uid-1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('x'.repeat(32)));
    await expect(verifyIdToken(hs, PROJECT, jwks)).rejects.toMatchObject({ code: 'unauthenticated' });
  });
});

describe('isAllowed', () => {
  it('matches case-insensitively against a comma list', () => {
    expect(isAllowed('Me@Example.com', 'me@example.com, pal@x.io')).toBe(true);
    expect(isAllowed('stranger@x.io', 'me@example.com')).toBe(false);
    expect(isAllowed(undefined, 'me@example.com')).toBe(false);
    expect(isAllowed('me@example.com', '')).toBe(false);
    // AI_ALLOWED_EMAILS is a secret; before `wrangler secret put` it is unset.
    expect(isAllowed('me@example.com', undefined)).toBe(false);
  });
});

describe('nextUsage', () => {
  it('starts a new day at 1, increments, and stops at the limit', () => {
    expect(nextUsage({ day: '2026-09-28', count: 99 }, '2026-09-29', 100)).toEqual({ ok: true, usage: { day: '2026-09-29', count: 1 } });
    expect(nextUsage({ day: '2026-09-29', count: 4 }, '2026-09-29', 5)).toEqual({ ok: true, usage: { day: '2026-09-29', count: 5 } });
    expect(nextUsage({ day: '2026-09-29', count: 5 }, '2026-09-29', 5)).toEqual({ ok: false });
    expect(nextUsage(undefined, '2026-09-29', 5)).toEqual({ ok: true, usage: { day: '2026-09-29', count: 1 } });
  });
});

describe('takeDailySlot', () => {
  it('counts in KV and refuses past the limit', async () => {
    const store = new Map<string, string>();
    const kv = {
      get: async (k: string) => store.get(k) ?? null,
      put: async (k: string, v: string) => void store.set(k, v),
    } as unknown as KVNamespace;
    expect(await takeDailySlot(kv, 'u', 2)).toBe(true);
    expect(await takeDailySlot(kv, 'u', 2)).toBe(true);
    expect(await takeDailySlot(kv, 'u', 2)).toBe(false);
  });
  it('treats an unparsable KV value as no record', async () => {
    const store = new Map<string, string>([['usage:u', 'not json']]);
    const kv = {
      get: async (k: string) => store.get(k) ?? null,
      put: async (k: string, v: string) => void store.set(k, v),
    } as unknown as KVNamespace;
    expect(await takeDailySlot(kv, 'u', 2)).toBe(true);
    expect(JSON.parse(store.get('usage:u')!)).toMatchObject({ count: 1 });
  });
});
