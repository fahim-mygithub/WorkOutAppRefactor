/**
 * Firestore REST `Value` encoding. Mirrors what the app's JS SDK writes:
 * safe integers -> integerValue, other numbers -> doubleValue, `Date` ->
 * timestampValue, `undefined` keys dropped (the app's `toFirestore`).
 * Decoding turns timestamps into ISO strings (the app's `fromFirestore`).
 */
export type FsValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { timestampValue: string }
  | { arrayValue: { values?: FsValue[] } }
  | { mapValue: { fields?: Record<string, FsValue> } };

export type FsFields = Record<string, FsValue>;

export function toValue(value: unknown): FsValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && !Object.is(value, -0)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } };
  if (typeof value === 'object') return { mapValue: { fields: toFields(value as Record<string, unknown>) } };
  throw new TypeError(`Cannot store a ${typeof value} in Firestore`);
}

/** A plain object as document fields; `undefined` keys are dropped. */
export function toFields(data: Record<string, unknown>): FsFields {
  const fields: FsFields = {};
  for (const [key, v] of Object.entries(data)) {
    if (v !== undefined) fields[key] = toValue(v);
  }
  return fields;
}

export function fromValue(value: FsValue): unknown {
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return new Date(value.timestampValue).toISOString();
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(fromValue);
  if ('mapValue' in value) return fromFields(value.mapValue.fields ?? {});
  return null;
}

export function fromFields(fields: FsFields): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(fields)) out[key] = fromValue(v);
  return out;
}
