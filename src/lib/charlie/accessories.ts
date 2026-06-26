/**
 * Seeded, avoid-last accessory selection. Mirrors `randomForMuscle`'s avoid-last
 * semantics but swaps Math.random for a deterministic PRNG keyed by program
 * position, so a projected calendar day shows the SAME picks every render and a
 * workout that slides to another date keeps its content.
 */
import type { AccessoryOption } from './definition';

/** FNV-1a string hash → unsigned 32-bit. */
export function hashString(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG → uniform [0,1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRandom(key: string): () => number {
  return mulberry32(hashString(key));
}

/** Pick one option, preferring something != avoidId (never silently repeats). */
export function pickAccessory(
  pool: ReadonlyArray<AccessoryOption>,
  rng: () => number,
  avoidId?: string,
): AccessoryOption {
  const candidates = avoidId ? pool.filter((o) => o.exerciseId !== avoidId) : pool;
  const list = candidates.length > 0 ? candidates : pool; // pool of one → unavoidable
  return list[Math.floor(rng() * list.length)];
}

/**
 * Deterministic per-role pick for the m-th occurrence of a day, avoiding the
 * (m-1)-th pick so consecutive sessions never repeat. `lastPerformedId` seeds the
 * avoid-chain from real history once a session exists. Iterative (no recursion
 * depth limit for far-future projections).
 */
export function accessoryPickForOrdinal(
  programId: string,
  scopeKey: string,
  pool: ReadonlyArray<AccessoryOption>,
  m: number,
  lastPerformedId?: string,
): AccessoryOption {
  if (pool.length === 0) {
    throw new Error(`accessoryPickForOrdinal: empty pool for "${scopeKey}"`);
  }
  let avoid = lastPerformedId;
  let pick: AccessoryOption = pool[0];
  const upto = Math.max(0, m);
  for (let i = 0; i <= upto; i++) {
    const rng = seededRandom(`${programId}|${scopeKey}|m${i}`);
    pick = pickAccessory(pool, rng, avoid);
    avoid = pick.exerciseId;
  }
  return pick;
}
