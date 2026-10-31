import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEFAULT_MAX_WRITES_PER_MONTH,
  DEFAULT_MEDIA_MAX_BYTES,
  DEFAULT_USER_MAX_BYTES,
  GIB,
  MediaConfigError,
  StorageFullError,
  assertRoom,
  deleteWithQuota,
  getUsage,
  mediaQuotaFor,
  parseQuotaConfig,
  putWithQuota,
  reconcileMediaUsage,
  reserveBytes,
  type QuotaConfig,
} from './quota';
import { fakeR2 } from './testing/fakeR2';
import { memoryKv } from '../mcp/testing/memoryKv';

const NOW = new Date('2026-10-15T12:00:00Z');
const cfg = (over: Partial<QuotaConfig> = {}): QuotaConfig => ({
  maxBytes: 1000,
  userMaxBytes: 600,
  maxWritesPerMonth: 100,
  ...over,
});
const bytesOf = (n: number) => new Uint8Array(n);
const json = (kv: ReturnType<typeof memoryKv>, key: string) => JSON.parse(kv.store.get(key) ?? 'null');

let r2: ReturnType<typeof fakeR2>;
let kv: ReturnType<typeof memoryKv>;

beforeEach(() => {
  r2 = fakeR2();
  kv = memoryKv();
});

describe('quota config', () => {
  it('defaults to 8 GiB total, 1 GiB per user and 100k writes a month', () => {
    const c = parseQuotaConfig({});
    expect(c).toEqual({ maxBytes: 8 * GIB, userMaxBytes: 1 * GIB, maxWritesPerMonth: 100_000 });
    expect(DEFAULT_MEDIA_MAX_BYTES).toBe(8_589_934_592);
    expect(DEFAULT_USER_MAX_BYTES).toBe(1_073_741_824);
    expect(DEFAULT_MAX_WRITES_PER_MONTH).toBe(100_000);
  });

  it('reads the vars and falls back to defaults on junk', () => {
    expect(parseQuotaConfig({ MEDIA_MAX_BYTES: '5000', MEDIA_USER_MAX_BYTES: '700', MEDIA_MAX_WRITES_PER_MONTH: '9' })).toEqual({
      maxBytes: 5000,
      userMaxBytes: 700,
      maxWritesPerMonth: 9,
    });
    expect(parseQuotaConfig({ MEDIA_MAX_BYTES: 'lots', MEDIA_USER_MAX_BYTES: '-4' }).maxBytes).toBe(8 * GIB);
    expect(parseQuotaConfig({ MEDIA_USER_MAX_BYTES: '-4' }).userMaxBytes).toBe(1 * GIB);
  });

  it('refuses a global ceiling above 9 GiB (and a per-user one above the global)', () => {
    expect(parseQuotaConfig({ MEDIA_MAX_BYTES: String(9 * GIB) }).maxBytes).toBe(9 * GIB);
    expect(() => parseQuotaConfig({ MEDIA_MAX_BYTES: String(9 * GIB + 1) })).toThrow(MediaConfigError);
    expect(() => parseQuotaConfig({ MEDIA_USER_MAX_BYTES: String(10 * GIB) })).toThrow(MediaConfigError);
    expect(() => parseQuotaConfig({ MEDIA_MAX_WRITES_PER_MONTH: '1000001' })).toThrow(MediaConfigError);
    expect(parseQuotaConfig({ MEDIA_MAX_BYTES: '500', MEDIA_USER_MAX_BYTES: '900' }).userMaxBytes).toBe(500);
  });
});

describe('putWithQuota', () => {
  it('stores the object and counts its real size for the total and the user', async () => {
    const obj = await putWithQuota(r2, kv, cfg(), 'u1', 'u1/a.png', bytesOf(100), {}, NOW);
    expect(obj?.size).toBe(100);
    expect(r2.store.has('u1/a.png')).toBe(true);
    const usage = await getUsage(kv, cfg(), 'u1', NOW);
    expect(usage.usedBytes).toBe(100);
    expect(usage.userUsedBytes).toBe(100);
    expect(json(kv, 'media_quota:total').reservedBytes).toBe(0);
  });

  it('refuses a write that would pass the global ceiling and writes nothing', async () => {
    await putWithQuota(r2, kv, cfg(), 'u1', 'u1/a.png', bytesOf(500), {}, NOW);
    await putWithQuota(r2, kv, cfg(), 'u2', 'u2/a.png', bytesOf(450), {}, NOW);
    const before = new Map(kv.store);
    await expect(putWithQuota(r2, kv, cfg(), 'u3', 'u3/a.png', bytesOf(51), {}, NOW)).rejects.toBeInstanceOf(StorageFullError);
    expect(r2.store.has('u3/a.png')).toBe(false);
    expect(r2.store.size).toBe(2);
    expect(kv.store).toEqual(before); // not even a reservation or op was recorded
    // the exact remainder still fits
    await putWithQuota(r2, kv, cfg(), 'u3', 'u3/b.png', bytesOf(50), {}, NOW);
    expect(r2.store.size).toBe(3);
  });

  it('refuses at the real 8 GiB default ceiling', async () => {
    kv.store.set('media_quota:total', JSON.stringify({ usedBytes: 8 * GIB - 5, reservedBytes: 0 }));
    const c = parseQuotaConfig({});
    await expect(putWithQuota(r2, kv, c, 'u1', 'u1/a.png', bytesOf(10), {}, NOW)).rejects.toMatchObject({
      code: 'storage_full',
    });
    expect(r2.store.size).toBe(0);
    await putWithQuota(r2, kv, c, 'u1', 'u1/b.png', bytesOf(5), {}, NOW);
    expect(r2.store.size).toBe(1);
  });

  it('enforces the per-user ceiling while other users still have room', async () => {
    await putWithQuota(r2, kv, cfg(), 'u1', 'u1/a.png', bytesOf(500), {}, NOW);
    await expect(putWithQuota(r2, kv, cfg(), 'u1', 'u1/b.png', bytesOf(101), {}, NOW)).rejects.toMatchObject({
      code: 'storage_full',
      message: expect.stringMatching(/your/i),
    });
    expect(r2.store.has('u1/b.png')).toBe(false);
    await putWithQuota(r2, kv, cfg(), 'u2', 'u2/a.png', bytesOf(101), {}, NOW);
    expect(r2.store.has('u2/a.png')).toBe(true);
  });

  it('reserves before the put: two writes that fit alone but not together, the second is refused', async () => {
    const c = cfg({ maxBytes: 1000, userMaxBytes: 1000 });
    const results = await Promise.allSettled([
      putWithQuota(r2, kv, c, 'u1', 'u1/a.png', bytesOf(600), {}, NOW),
      putWithQuota(r2, kv, c, 'u2', 'u2/a.png', bytesOf(600), {}, NOW),
    ]);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
    expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(StorageFullError);
    expect([...r2.store.keys()]).toEqual(['u1/a.png']);
    expect((await getUsage(kv, c, 'u1', NOW)).usedBytes).toBe(600);
  });

  it('counts an in-flight reservation against later writes', async () => {
    const c = cfg({ maxBytes: 1000, userMaxBytes: 1000 });
    const res = await reserveBytes(kv, c, 'u1', 700, NOW);
    expect(json(kv, 'media_quota:total').reservedBytes).toBe(700);
    await expect(reserveBytes(kv, c, 'u2', 400, NOW)).rejects.toBeInstanceOf(StorageFullError);
    expect(res.bytes).toBe(700);
  });

  it('releases the reservation when the put fails', async () => {
    const failing = Object.assign(Object.create(r2), {
      put: vi.fn(async () => {
        throw new Error('R2 down');
      }),
    }) as typeof r2;
    await expect(putWithQuota(failing, kv, cfg(), 'u1', 'u1/a.png', bytesOf(300), {}, NOW)).rejects.toThrow('R2 down');
    expect(json(kv, 'media_quota:total')).toMatchObject({ usedBytes: 0, reservedBytes: 0 });
    expect(json(kv, 'media_quota:user:u1')).toMatchObject({ usedBytes: 0, reservedBytes: 0 });
    // and the room is really free again
    await putWithQuota(r2, kv, cfg(), 'u1', 'u1/a.png', bytesOf(600), {}, NOW);
    expect(r2.store.size).toBe(1);
  });

  it('records the object size R2 reports, not a claimed size', async () => {
    const lying = Object.assign(Object.create(r2), {
      put: vi.fn(async (key: string, value: Uint8Array, o?: R2PutOptions) => {
        const real = await r2.put(key, new Uint8Array(value.length + 40), o);
        return real;
      }),
    }) as typeof r2;
    await putWithQuota(lying, kv, cfg(), 'u1', 'u1/a.png', bytesOf(100), {}, NOW);
    expect((await getUsage(kv, cfg(), 'u1', NOW)).usedBytes).toBe(140);
  });

  it('refuses a stream body whose size is unknown (no unmetered writes)', async () => {
    const stream = new ReadableStream();
    await expect(putWithQuota(r2, kv, cfg(), 'u1', 'u1/a.png', stream as unknown as Uint8Array, {}, NOW)).rejects.toThrow(
      /known size/i,
    );
    expect(r2.store.size).toBe(0);
  });
});

describe('delete', () => {
  it('decrements the total and the user by the object real size', async () => {
    await putWithQuota(r2, kv, cfg(), 'u1', 'u1/a.png', bytesOf(200), {}, NOW);
    await putWithQuota(r2, kv, cfg(), 'u1', 'u1/b.png', bytesOf(100), {}, NOW);
    await deleteWithQuota(r2, kv, 'u1/a.png');
    expect(r2.store.has('u1/a.png')).toBe(false);
    const usage = await getUsage(kv, cfg(), 'u1', NOW);
    expect(usage.usedBytes).toBe(100);
    expect(usage.userUsedBytes).toBe(100);
  });

  it('is a no-op for a missing object and never goes below zero', async () => {
    await deleteWithQuota(r2, kv, 'u1/nope.png');
    expect((await getUsage(kv, cfg(), 'u1', NOW)).usedBytes).toBe(0);
    // counter already drifted low, then the object is deleted
    await r2.put('u1/a.png', bytesOf(300));
    await deleteWithQuota(r2, kv, 'u1/a.png');
    expect((await getUsage(kv, cfg(), 'u1', NOW)).usedBytes).toBe(0);
  });

  it('frees room for new writes', async () => {
    await putWithQuota(r2, kv, cfg(), 'u1', 'u1/a.png', bytesOf(600), {}, NOW);
    await expect(putWithQuota(r2, kv, cfg(), 'u1', 'u1/b.png', bytesOf(10), {}, NOW)).rejects.toBeInstanceOf(StorageFullError);
    await deleteWithQuota(r2, kv, 'u1/a.png');
    await putWithQuota(r2, kv, cfg(), 'u1', 'u1/b.png', bytesOf(10), {}, NOW);
    expect(r2.store.has('u1/b.png')).toBe(true);
  });
});

describe('monthly write cap', () => {
  it('refuses writes beyond the monthly cap with the same error and resets next month', async () => {
    const c = cfg({ maxWritesPerMonth: 3 });
    for (let i = 0; i < 3; i++) await putWithQuota(r2, kv, c, 'u1', `u1/${i}.png`, bytesOf(1), {}, NOW);
    await expect(putWithQuota(r2, kv, c, 'u1', 'u1/x.png', bytesOf(1), {}, NOW)).rejects.toMatchObject({
      code: 'storage_full',
      message: expect.stringMatching(/month/i),
    });
    expect(r2.store.has('u1/x.png')).toBe(false);
    const usage = await getUsage(kv, c, 'u1', NOW);
    expect(usage.monthlyWrites).toBe(3);
    expect(usage.monthlyWriteLimit).toBe(3);

    const nextMonth = new Date('2026-11-01T00:00:01Z');
    await putWithQuota(r2, kv, c, 'u1', 'u1/y.png', bytesOf(1), {}, nextMonth);
    expect(r2.store.has('u1/y.png')).toBe(true);
  });

  it('assertRoom refuses when the month is used up or storage is full, without recording anything', async () => {
    const c = cfg({ maxWritesPerMonth: 1 });
    await putWithQuota(r2, kv, c, 'u1', 'u1/a.png', bytesOf(1), {}, NOW);
    const before = new Map(kv.store);
    await expect(assertRoom(kv, c, 'u1', NOW)).rejects.toBeInstanceOf(StorageFullError);
    expect(kv.store).toEqual(before);
    await expect(assertRoom(kv, cfg({ userMaxBytes: 1 }), 'u1', NOW)).rejects.toBeInstanceOf(StorageFullError);
    await expect(assertRoom(kv, cfg(), 'u2', NOW)).resolves.toBeUndefined();
  });
});

describe('reconcile', () => {
  it('rewrites drifted counters from the bucket listing and stores lastReconciled', async () => {
    await r2.put('u1/a.png', bytesOf(100));
    await r2.put('u1/b.png', bytesOf(50));
    await r2.put('u2/a.mp4', bytesOf(400));
    kv.store.set('media_quota:total', JSON.stringify({ usedBytes: 99999, reservedBytes: 123 }));
    kv.store.set('media_quota:user:u1', JSON.stringify({ usedBytes: 1, reservedBytes: 0 }));
    kv.store.set('media_quota:user:gone', JSON.stringify({ usedBytes: 777, reservedBytes: 0 }));

    const result = await reconcileMediaUsage(r2, kv, NOW);
    expect(result).toMatchObject({ ok: true, totalBytes: 550, objects: 3 });
    expect(json(kv, 'media_quota:total')).toEqual({ usedBytes: 550, reservedBytes: 0 });
    expect(json(kv, 'media_quota:user:u1')).toEqual({ usedBytes: 150, reservedBytes: 0 });
    expect(json(kv, 'media_quota:user:u2')).toEqual({ usedBytes: 400, reservedBytes: 0 });
    expect(kv.store.has('media_quota:user:gone')).toBe(false);
    expect(json(kv, 'media_quota:reconciled').at).toBe(NOW.toISOString());
    expect((await getUsage(kv, cfg(), 'u1', NOW)).lastReconciled).toBe(NOW.toISOString());
  });

  it('walks every page of a large listing', async () => {
    for (let i = 0; i < 25; i++) await r2.put(`u1/${String(i).padStart(3, '0')}.png`, bytesOf(10));
    const list = r2.list.bind(r2);
    const page = vi.fn((o?: R2ListOptions) => list({ ...o, limit: 7 }));
    r2.list = page as typeof r2.list;
    const result = await reconcileMediaUsage(r2, kv, NOW);
    expect(result).toMatchObject({ ok: true, totalBytes: 250, objects: 25 });
    expect(page.mock.calls.length).toBe(4);
  });

  it('keeps the old counters (and lastReconciled) when listing fails', async () => {
    await putWithQuota(r2, kv, cfg(), 'u1', 'u1/a.png', bytesOf(100), {}, NOW);
    await reconcileMediaUsage(r2, kv, NOW);
    const before = new Map(kv.store);
    r2.list = (async () => {
      throw new Error('list failed');
    }) as typeof r2.list;
    const errs = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await reconcileMediaUsage(r2, kv, new Date('2026-10-16T12:00:00Z'));
    errs.mockRestore();
    expect(result).toMatchObject({ ok: false });
    expect(kv.store).toEqual(before);
  });

  it('keeps the old counters when the listing dies halfway through', async () => {
    await r2.put('u1/a.png', bytesOf(10));
    await r2.put('u1/b.png', bytesOf(10));
    kv.store.set('media_quota:total', JSON.stringify({ usedBytes: 20, reservedBytes: 0 }));
    const list = r2.list.bind(r2);
    let calls = 0;
    r2.list = (async (o?: R2ListOptions) => {
      if (++calls > 1) throw new Error('boom');
      return list({ ...o, limit: 1 });
    }) as typeof r2.list;
    const errs = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await reconcileMediaUsage(r2, kv, NOW);
    errs.mockRestore();
    expect(result.ok).toBe(false);
    expect(json(kv, 'media_quota:total')).toEqual({ usedBytes: 20, reservedBytes: 0 });
    expect(kv.store.has('media_quota:reconciled')).toBe(false);
  });

  it('does not touch the monthly write counter', async () => {
    await putWithQuota(r2, kv, cfg(), 'u1', 'u1/a.png', bytesOf(10), {}, NOW);
    const ops = kv.store.get('media_quota:ops');
    await reconcileMediaUsage(r2, kv, NOW);
    expect(kv.store.get('media_quota:ops')).toBe(ops);
  });
});

describe('mediaQuotaFor (the connector tools)', () => {
  const env = (over: Record<string, string> = {}) => ({ AI_USAGE: kv, ...over });

  it('guards the bucket handed to UserData: a write past the cap throws storage_full and stores nothing', async () => {
    const q = mediaQuotaFor(env({ MEDIA_MAX_BYTES: '100' }), 'u1');
    const guarded = q.guard(r2);
    await guarded.put('u1/a.png', bytesOf(60));
    await expect(guarded.put('u1/b.png', bytesOf(60))).rejects.toBeInstanceOf(StorageFullError);
    expect([...r2.store.keys()]).toEqual(['u1/a.png']);
    expect(await guarded.head('u1/a.png')).not.toBeNull(); // other methods pass through
  });

  it('assertRoom surfaces a storage_full message the model can read', async () => {
    const q = mediaQuotaFor(env({ MEDIA_USER_MAX_BYTES: '10' }), 'u1');
    await q.guard(r2).put('u1/a.png', bytesOf(10));
    const err = await q.assertRoom().catch((e) => e);
    expect(err).toBeInstanceOf(StorageFullError);
    expect(err.message).toMatch(/^storage_full:/);
  });

  it('reports a bad config as a MediaConfigError when used', async () => {
    const q = mediaQuotaFor(env({ MEDIA_MAX_BYTES: String(20 * GIB) }), 'u1');
    await expect(q.assertRoom()).rejects.toBeInstanceOf(MediaConfigError);
  });
});
