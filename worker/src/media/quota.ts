/**
 * Storage quota for the media bucket. Cloudflare R2 has no hard cap, so the
 * Worker keeps the bucket under the free tier itself:
 *
 *  - a global byte ceiling (`MEDIA_MAX_BYTES`, default 8 GiB, never above 9 GiB),
 *  - a per-user byte ceiling (`MEDIA_USER_MAX_BYTES`, default 1 GiB),
 *  - a monthly cap on writes (`MEDIA_MAX_WRITES_PER_MONTH`, default 100k).
 *
 * Counters live in KV (the AI_USAGE namespace). A write goes reserve -> put ->
 * confirm: the incoming bytes are reserved in the counters BEFORE the put (so
 * two writes that only fit one at a time cannot both pass), confirmed with the
 * object's real size afterwards, and released if the put fails. A refused write
 * records nothing. KV has no atomic update, so reservations are serialized
 * inside one isolate; across isolates a race can overshoot by a few uploads,
 * which the >= 1 GiB headroom between 8 GiB and the 10 GB free tier absorbs.
 * `reconcileMediaUsage` (daily cron) recomputes the counters from the bucket.
 */

export const GIB = 1024 * 1024 * 1024;
export const DEFAULT_MEDIA_MAX_BYTES = 8 * GIB;
export const DEFAULT_USER_MAX_BYTES = 1 * GIB;
export const DEFAULT_MAX_WRITES_PER_MONTH = 100_000;
/** Config above this is refused: the free tier is 10 GB. */
export const HARD_CEILING_BYTES = 9 * GIB;
/** R2 free tier: 1M Class A (write) operations a month. */
export const HARD_CEILING_WRITES = 1_000_000;

export interface QuotaConfig {
  maxBytes: number;
  userMaxBytes: number;
  maxWritesPerMonth: number;
}

export interface QuotaEnv {
  MEDIA_MAX_BYTES?: string;
  MEDIA_USER_MAX_BYTES?: string;
  MEDIA_MAX_WRITES_PER_MONTH?: string;
  AI_USAGE?: KVNamespace;
}

/** Thrown for a write that would pass a limit. Shown to the model and the user as-is. */
export class StorageFullError extends Error {
  readonly code = 'storage_full' as const;
  constructor(readonly detail: string) {
    super(`storage_full: ${detail}`);
    this.name = 'StorageFullError';
  }
}

/** The limits are mis-set (or the counters have nowhere to live): writes are refused. */
export class MediaConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaConfigError';
  }
}

function positiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : fallback;
}

export function parseQuotaConfig(env: Pick<QuotaEnv, 'MEDIA_MAX_BYTES' | 'MEDIA_USER_MAX_BYTES' | 'MEDIA_MAX_WRITES_PER_MONTH'>): QuotaConfig {
  const maxBytes = positiveInt(env.MEDIA_MAX_BYTES, DEFAULT_MEDIA_MAX_BYTES);
  if (maxBytes > HARD_CEILING_BYTES) {
    throw new MediaConfigError(
      `MEDIA_MAX_BYTES (${maxBytes}) is above the 9 GiB safety ceiling; media writes are refused until it is lowered.`,
    );
  }
  const userRaw = positiveInt(env.MEDIA_USER_MAX_BYTES, DEFAULT_USER_MAX_BYTES);
  if (userRaw > HARD_CEILING_BYTES) {
    throw new MediaConfigError(
      `MEDIA_USER_MAX_BYTES (${userRaw}) is above the 9 GiB safety ceiling; media writes are refused until it is lowered.`,
    );
  }
  const maxWritesPerMonth = positiveInt(env.MEDIA_MAX_WRITES_PER_MONTH, DEFAULT_MAX_WRITES_PER_MONTH);
  if (maxWritesPerMonth > HARD_CEILING_WRITES) {
    throw new MediaConfigError(
      `MEDIA_MAX_WRITES_PER_MONTH (${maxWritesPerMonth}) is above the 1,000,000 free-tier writes; media writes are refused until it is lowered.`,
    );
  }
  return { maxBytes, userMaxBytes: Math.min(userRaw, maxBytes), maxWritesPerMonth };
}

// ---------------------------------------------------------------------------
// Counter records
// ---------------------------------------------------------------------------

const TOTAL_KEY = 'media_quota:total';
const USER_PREFIX = 'media_quota:user:';
const OPS_KEY = 'media_quota:ops';
const RECONCILED_KEY = 'media_quota:reconciled';

interface Counter {
  usedBytes: number;
  reservedBytes: number;
}
interface OpsCounter {
  month: string;
  count: number;
}

const userKey = (uid: string) => `${USER_PREFIX}${uid}`;
const monthOf = (now: Date) => now.toISOString().slice(0, 7);

async function readJson<T>(kv: KVNamespace, key: string): Promise<T | null> {
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function asCounter(v: Counter | null): Counter {
  const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);
  return { usedBytes: num(v?.usedBytes), reservedBytes: num(v?.reservedBytes) };
}

const readCounter = async (kv: KVNamespace, key: string) => asCounter(await readJson<Counter>(kv, key));
const writeJson = (kv: KVNamespace, key: string, value: unknown) => kv.put(key, JSON.stringify(value));

async function readOps(kv: KVNamespace, now: Date): Promise<OpsCounter> {
  const month = monthOf(now);
  const ops = await readJson<OpsCounter>(kv, OPS_KEY);
  return ops && ops.month === month && Number.isFinite(ops.count) ? ops : { month, count: 0 };
}

/**
 * KV read-modify-write is not atomic, so counter updates run one at a time in
 * this isolate. (Other isolates can still interleave: see the file header.)
 */
let chain: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

// ---------------------------------------------------------------------------
// Reserve -> confirm / release
// ---------------------------------------------------------------------------

export interface Reservation {
  uid: string;
  bytes: number;
}

const fmt = (n: number) => (n >= GIB / 4 ? `${(n / GIB).toFixed(2)} GiB` : `${(n / (1024 * 1024)).toFixed(1)} MiB`);

function checkRoom(cfg: QuotaConfig, total: Counter, user: Counter, ops: OpsCounter, bytes: number): void {
  if (ops.count + 1 > cfg.maxWritesPerMonth) {
    throw new StorageFullError(
      `The monthly media write limit (${cfg.maxWritesPerMonth} uploads) has been reached. Nothing was uploaded; uploads work again next month.`,
    );
  }
  if (total.usedBytes + total.reservedBytes + bytes > cfg.maxBytes) {
    throw new StorageFullError(
      `Media storage is full (${fmt(total.usedBytes + total.reservedBytes)} of ${fmt(cfg.maxBytes)} used). Nothing was uploaded; delete some media first.`,
    );
  }
  if (user.usedBytes + user.reservedBytes + bytes > cfg.userMaxBytes) {
    throw new StorageFullError(
      `Your media storage is full (${fmt(user.usedBytes + user.reservedBytes)} of your ${fmt(cfg.userMaxBytes)} limit used). Nothing was uploaded; delete some media first.`,
    );
  }
}

/** Refuses (StorageFullError) when `bytes` more would pass a limit; otherwise reserves them and counts one write. */
export function reserveBytes(kv: KVNamespace, cfg: QuotaConfig, uid: string, bytes: number, now = new Date()): Promise<Reservation> {
  return exclusive(async () => {
    const [total, user, ops] = await Promise.all([readCounter(kv, TOTAL_KEY), readCounter(kv, userKey(uid)), readOps(kv, now)]);
    checkRoom(cfg, total, user, ops, bytes);
    total.reservedBytes += bytes;
    user.reservedBytes += bytes;
    ops.count += 1;
    try {
      await writeJson(kv, TOTAL_KEY, total);
      await writeJson(kv, userKey(uid), user);
      await writeJson(kv, OPS_KEY, ops);
    } catch (err) {
      await settle(kv, { uid, bytes }, 0).catch(() => {});
      throw err;
    }
    return { uid, bytes };
  });
}

/** Moves a reservation to used (`actual` bytes), or just drops it (`actual` = 0). */
async function settle(kv: KVNamespace, res: Reservation, actual: number): Promise<void> {
  const [total, user] = await Promise.all([readCounter(kv, TOTAL_KEY), readCounter(kv, userKey(res.uid))]);
  for (const c of [total, user]) {
    c.reservedBytes = Math.max(0, c.reservedBytes - res.bytes);
    c.usedBytes += actual;
  }
  await writeJson(kv, TOTAL_KEY, total);
  await writeJson(kv, userKey(res.uid), user);
}

export const confirmReservation = (kv: KVNamespace, res: Reservation, actualBytes: number) =>
  exclusive(() => settle(kv, res, actualBytes));
export const releaseReservation = (kv: KVNamespace, res: Reservation) => exclusive(() => settle(kv, res, 0));

function bodySize(value: unknown): number {
  if (typeof value === 'string') return new TextEncoder().encode(value).length;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return value.size;
  throw new Error('Media writes need a body of known size (bytes, a Blob or a string), not a stream.');
}

/**
 * The one way to write to the media bucket: reserve, put, confirm with the
 * object's real size. A failed put releases the reservation and rethrows. A
 * confirm that fails after a good put is logged: the daily reconcile fixes it.
 */
export async function putWithQuota(
  bucket: R2Bucket,
  kv: KVNamespace,
  cfg: QuotaConfig,
  uid: string,
  key: string,
  value: Parameters<R2Bucket['put']>[1],
  options?: R2PutOptions,
  now = new Date(),
): Promise<R2Object | null> {
  const size = bodySize(value);
  const res = await reserveBytes(kv, cfg, uid, size, now);
  let object: R2Object | null;
  try {
    object = await bucket.put(key, value, options);
  } catch (err) {
    await releaseReservation(kv, res).catch((e) => console.error('media quota: release failed', e));
    throw err;
  }
  await confirmReservation(kv, res, object?.size ?? size).catch((e) => console.error('media quota: confirm failed', e));
  return object;
}

/** Deletes an object and takes its real size off the counters. Missing objects are a no-op. */
export async function deleteWithQuota(bucket: R2Bucket, kv: KVNamespace, key: string): Promise<void> {
  const head = await bucket.head(key);
  if (!head) return;
  await bucket.delete(key);
  const uid = key.split('/')[0];
  await exclusive(async () => {
    const [total, user] = await Promise.all([readCounter(kv, TOTAL_KEY), readCounter(kv, userKey(uid))]);
    total.usedBytes = Math.max(0, total.usedBytes - head.size);
    user.usedBytes = Math.max(0, user.usedBytes - head.size);
    await writeJson(kv, TOTAL_KEY, total);
    await writeJson(kv, userKey(uid), user);
  });
}

/** Cheap pre-flight (writes nothing): refuses when even one more byte could not be stored. */
export async function assertRoom(kv: KVNamespace, cfg: QuotaConfig, uid: string, now = new Date()): Promise<void> {
  const [total, user, ops] = await Promise.all([readCounter(kv, TOTAL_KEY), readCounter(kv, userKey(uid)), readOps(kv, now)]);
  checkRoom(cfg, total, user, ops, 1);
}

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

export interface MediaUsage {
  usedBytes: number;
  limitBytes: number;
  userUsedBytes: number;
  userLimitBytes: number;
  monthlyWrites: number;
  monthlyWriteLimit: number;
  lastReconciled: string | null;
}

export async function getUsage(kv: KVNamespace, cfg: QuotaConfig, uid: string, now = new Date()): Promise<MediaUsage> {
  const [total, user, ops, reconciled] = await Promise.all([
    readCounter(kv, TOTAL_KEY),
    readCounter(kv, userKey(uid)),
    readOps(kv, now),
    readJson<{ at?: string }>(kv, RECONCILED_KEY),
  ]);
  return {
    usedBytes: total.usedBytes,
    limitBytes: cfg.maxBytes,
    userUsedBytes: user.usedBytes,
    userLimitBytes: cfg.userMaxBytes,
    monthlyWrites: ops.count,
    monthlyWriteLimit: cfg.maxWritesPerMonth,
    lastReconciled: reconciled?.at ?? null,
  };
}

// ---------------------------------------------------------------------------
// Reconcile (daily cron)
// ---------------------------------------------------------------------------

export type ReconcileResult =
  | { ok: true; totalBytes: number; objects: number; users: number }
  | { ok: false; error: string };

/**
 * Lists the whole bucket and rewrites the counters from what is really there.
 * If listing fails at any point nothing is written: the old counters stay.
 * Reservations are reset (an in-flight upload that straddles this run is
 * simply counted on the next one).
 */
export async function reconcileMediaUsage(bucket: R2Bucket, kv: KVNamespace, now = new Date()): Promise<ReconcileResult> {
  const perUser = new Map<string, number>();
  let totalBytes = 0;
  let objects = 0;
  try {
    let cursor: string | undefined;
    do {
      const page = await bucket.list({ cursor, limit: 1000 });
      for (const o of page.objects) {
        totalBytes += o.size;
        objects += 1;
        const slash = o.key.indexOf('/');
        if (slash > 0) {
          const uid = o.key.slice(0, slash);
          perUser.set(uid, (perUser.get(uid) ?? 0) + o.size);
        }
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);

    const staleUserKeys: string[] = [];
    let kvCursor: string | undefined;
    for (;;) {
      const listed = await kv.list({ prefix: USER_PREFIX, cursor: kvCursor });
      for (const k of listed.keys) if (!perUser.has(k.name.slice(USER_PREFIX.length))) staleUserKeys.push(k.name);
      if (listed.list_complete) break;
      kvCursor = listed.cursor;
    }

    await exclusive(async () => {
      await writeJson(kv, TOTAL_KEY, { usedBytes: totalBytes, reservedBytes: 0 } satisfies Counter);
      for (const [uid, bytes] of perUser) await writeJson(kv, userKey(uid), { usedBytes: bytes, reservedBytes: 0 } satisfies Counter);
      for (const k of staleUserKeys) await kv.delete(k);
      await writeJson(kv, RECONCILED_KEY, { at: now.toISOString(), totalBytes, objects });
    });
    return { ok: true, totalBytes, objects, users: perUser.size };
  } catch (err) {
    console.error('media quota: reconcile failed, keeping the old counters', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Per-user handle for the connector tools
// ---------------------------------------------------------------------------

export interface MediaQuota {
  /** Throws StorageFullError / MediaConfigError when nothing more could be stored. */
  assertRoom(): Promise<void>;
  /** The bucket with `put` metered; everything else passes through. */
  guard(bucket: R2Bucket): R2Bucket;
}

function requireKv(env: QuotaEnv): KVNamespace {
  if (!env.AI_USAGE) throw new MediaConfigError('Media quota storage (KV) is not configured; media writes are refused.');
  return env.AI_USAGE;
}

export function mediaQuotaFor(env: QuotaEnv, uid: string): MediaQuota {
  return {
    assertRoom: async () => {
      const kv = requireKv(env);
      return assertRoom(kv, parseQuotaConfig(env), uid);
    },
    guard: (bucket) =>
      new Proxy(bucket, {
        get(target, prop) {
          if (prop === 'put') {
            return async (key: string, value: Parameters<R2Bucket['put']>[1], options?: R2PutOptions) =>
              putWithQuota(target, requireKv(env), parseQuotaConfig(env), uid, key, value, options);
          }
          const v = Reflect.get(target, prop, target);
          return typeof v === 'function' ? v.bind(target) : v;
        },
      }),
  };
}
