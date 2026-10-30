import { describe, expect, it } from 'vitest';
import { fromFields, toFields, toValue } from './firestoreValue';

describe('Firestore value encoding', () => {
  it('encodes like the JS SDK: safe integers as integerValue, others as doubleValue', () => {
    expect(toValue(5)).toEqual({ integerValue: '5' });
    expect(toValue(2.5)).toEqual({ doubleValue: 2.5 });
    expect(toValue(Number.MAX_SAFE_INTEGER + 2)).toEqual({ doubleValue: Number.MAX_SAFE_INTEGER + 2 });
  });

  it('turns Dates into timestamps and leaves ISO strings as strings', () => {
    expect(toValue(new Date('2026-10-30T10:00:00Z'))).toEqual({ timestampValue: '2026-10-30T10:00:00.000Z' });
    expect(toValue('2026-10-30T10:00:00.000Z')).toEqual({ stringValue: '2026-10-30T10:00:00.000Z' });
  });

  it('drops undefined keys at every depth, like toFirestore', () => {
    const fields = toFields({ a: 1, b: undefined, c: { d: undefined, e: 'x' }, f: [undefined, null] });
    expect(Object.keys(fields)).toEqual(['a', 'c', 'f']);
    expect(fields.c).toEqual({ mapValue: { fields: { e: { stringValue: 'x' } } } });
    expect(fields.f).toEqual({ arrayValue: { values: [{ nullValue: null }, { nullValue: null }] } });
  });

  it('round-trips, with timestamps read back as ISO strings (fromFirestore)', () => {
    const data = { n: 3, s: 'x', b: true, z: null, t: new Date('2026-01-02T03:04:05Z'), arr: [1, 'two', [3]], m: { k: [] } };
    expect(fromFields(toFields(data))).toEqual({ ...data, t: '2026-01-02T03:04:05.000Z' });
  });
});
