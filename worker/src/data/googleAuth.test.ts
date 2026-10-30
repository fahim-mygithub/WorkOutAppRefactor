import { exportPKCS8, exportSPKI, generateKeyPair, importSPKI, jwtVerify } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTokenCache, DATASTORE_SCOPE, parseServiceAccount, serviceAccountTokenSource } from './googleAuth';

describe('parseServiceAccount', () => {
  it('rejects a missing, non-JSON or incomplete secret', () => {
    expect(() => parseServiceAccount(undefined)).toThrow(/not set/);
    expect(() => parseServiceAccount('nope')).toThrow(/not valid JSON/);
    expect(() => parseServiceAccount('{"client_email":"a@b"}')).toThrow(/private_key/);
  });
});

describe('serviceAccountTokenSource', () => {
  beforeEach(() => clearTokenCache());

  it('signs an RS256 JWT-bearer assertion, exchanges it, and caches the token', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
    const sa = { client_email: 'svc@test.iam.gserviceaccount.com', private_key: await exportPKCS8(privateKey) };
    const now = 1_800_000_000_000;
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const form = new URLSearchParams(String(init?.body));
      expect(form.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
      const { payload } = await jwtVerify(form.get('assertion')!, await importSPKI(await exportSPKI(publicKey), 'RS256'), {
        issuer: sa.client_email,
        audience: 'https://oauth2.googleapis.com/token',
        currentDate: new Date(now),
      });
      expect(payload.scope).toBe(DATASTORE_SCOPE);
      expect(payload.sub).toBe(sa.client_email);
      return new Response(JSON.stringify({ access_token: 'ya29.test', expires_in: 3600 }));
    });
    const source = serviceAccountTokenSource(sa, fetchMock as unknown as typeof fetch, () => now);
    expect(await source()).toBe('ya29.test');
    expect(await source()).toBe('ya29.test');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when Google refuses the assertion', async () => {
    const { privateKey } = await generateKeyPair('RS256', { extractable: true });
    const sa = { client_email: 'bad@test', private_key: await exportPKCS8(privateKey) };
    const source = serviceAccountTokenSource(sa, (async () => new Response('{}', { status: 400 })) as unknown as typeof fetch);
    await expect(source()).rejects.toThrow(/token exchange failed \(400\)/);
  });
});
