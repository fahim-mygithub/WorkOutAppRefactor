import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { fromFirestore, toFirestore, isTimestamp, timestampToISOString } from './serde';

describe('fromFirestore', () => {
  it('converts a Timestamp to an ISO string', () => {
    const date = new Date('2026-06-14T10:00:00.000Z');
    const ts = Timestamp.fromDate(date);
    expect(fromFirestore(ts)).toBe(date.toISOString());
  });

  it('converts a Date to an ISO string', () => {
    const date = new Date('2026-06-14T10:00:00.000Z');
    expect(fromFirestore(date)).toBe(date.toISOString());
  });

  it('recurses into nested objects and converts Timestamps', () => {
    const date = new Date('2026-06-14T10:00:00.000Z');
    const input = {
      name: 'workout',
      metadata: {
        createdAt: Timestamp.fromDate(date),
        viewCount: 3
      }
    };
    expect(fromFirestore(input)).toEqual({
      name: 'workout',
      metadata: {
        createdAt: date.toISOString(),
        viewCount: 3
      }
    });
  });

  it('recurses into arrays (including arrays of Timestamps and objects)', () => {
    const date = new Date('2026-06-14T10:00:00.000Z');
    const input = [
      Timestamp.fromDate(date),
      { performedAt: Timestamp.fromDate(date), reps: 5 }
    ];
    expect(fromFirestore(input)).toEqual([
      date.toISOString(),
      { performedAt: date.toISOString(), reps: 5 }
    ]);
  });

  it('returns primitives unchanged', () => {
    expect(fromFirestore('hello')).toBe('hello');
    expect(fromFirestore(42)).toBe(42);
    expect(fromFirestore(false)).toBe(false);
  });

  it('passes null through', () => {
    expect(fromFirestore(null)).toBe(null);
  });
});

describe('toFirestore', () => {
  it('strips top-level undefined keys', () => {
    const input = { a: 1, b: undefined, c: 'x' };
    expect(toFirestore(input)).toEqual({ a: 1, c: 'x' });
  });

  it('strips nested undefined keys', () => {
    const input = {
      meta: { keep: 'yes', drop: undefined },
      list: [{ a: 1, b: undefined }]
    };
    expect(toFirestore(input)).toEqual({
      meta: { keep: 'yes' },
      list: [{ a: 1 }]
    });
  });

  it('preserves falsy-but-defined values (false, 0, empty string, null)', () => {
    const input = { f: false, z: 0, s: '', n: null, u: undefined };
    expect(toFirestore(input)).toEqual({ f: false, z: 0, s: '', n: null });
  });

  it('recurses into arrays', () => {
    const input = { items: [{ a: 1, b: undefined }, { c: 2 }] };
    expect(toFirestore(input)).toEqual({ items: [{ a: 1 }, { c: 2 }] });
  });

  it('coerces top-level null/undefined to null', () => {
    expect(toFirestore(undefined as unknown as object)).toBe(null);
    expect(toFirestore(null as unknown as object)).toBe(null);
  });
});

describe('isTimestamp', () => {
  it('returns true for a Timestamp and false otherwise', () => {
    expect(isTimestamp(Timestamp.fromDate(new Date()))).toBe(true);
    expect(isTimestamp(new Date())).toBe(false);
    expect(isTimestamp('2026-06-14')).toBe(false);
    expect(isTimestamp(null)).toBe(false);
  });
});

describe('timestampToISOString', () => {
  it('converts a Timestamp', () => {
    const date = new Date('2026-06-14T10:00:00.000Z');
    expect(timestampToISOString(Timestamp.fromDate(date))).toBe(date.toISOString());
  });

  it('handles a duck-typed object with toDate()', () => {
    const date = new Date('2026-06-14T10:00:00.000Z');
    const duck = { toDate: () => date };
    expect(timestampToISOString(duck)).toBe(date.toISOString());
  });

  it('handles a Date', () => {
    const date = new Date('2026-06-14T10:00:00.000Z');
    expect(timestampToISOString(date)).toBe(date.toISOString());
  });

  it('passes through an existing ISO string', () => {
    expect(timestampToISOString('2026-06-14T10:00:00.000Z')).toBe('2026-06-14T10:00:00.000Z');
  });

  it('falls back to current time for falsy input', () => {
    expect(typeof timestampToISOString(null)).toBe('string');
    expect(typeof timestampToISOString(undefined)).toBe('string');
  });
});
