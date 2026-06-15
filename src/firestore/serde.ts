import { Timestamp } from 'firebase/firestore';

/**
 * Firestore serialization/deserialization helpers.
 *
 * Read and write are opposite concerns, so they are two separate functions:
 *  - `fromFirestore` deserializes snapshot data into plain, Redux-serializable JS
 *    (Timestamp -> ISO string, Date -> ISO string). It does NOT strip `undefined`.
 *  - `toFirestore` sanitizes plain JS into a Firestore-safe payload by recursively
 *    stripping `undefined` keys. It does NOT convert dates (callers wrap specific
 *    fields with `Timestamp.fromDate(...)` at the call site, because Firestore range
 *    queries / `orderBy` need real Timestamps on those fields only).
 */

/**
 * Type guard to check if a value is a Firebase Timestamp
 */
export function isTimestamp(value: any): value is Timestamp {
  return value instanceof Timestamp;
}

/**
 * Safely converts a Firebase Timestamp (or duck-typed timestamp / Date / ISO string)
 * to an ISO string, with a sensible fallback.
 */
export function timestampToISOString(timestamp: any): string {
  if (!timestamp) {
    return new Date().toISOString();
  }
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  if (typeof timestamp === 'string') {
    return timestamp; // Already a string, assume it's valid
  }
  return new Date().toISOString();
}

/**
 * READ: Firestore snapshot data -> plain, Redux-serializable JS.
 * Recursively converts Timestamp -> ISO string and Date -> ISO string.
 * Recurses arrays and nested objects; returns primitives as-is.
 * Does NOT strip `undefined` (read data has none).
 */
export function fromFirestore<T>(data: T): T {
  if (!data) return data;

  // Handle Timestamp objects
  if (data instanceof Timestamp) {
    return data.toDate().toISOString() as T;
  }

  // Handle Date objects (convert to ISO strings)
  if (data instanceof Date) {
    return data.toISOString() as T;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => fromFirestore(item)) as T;
  }

  // Handle objects
  if (typeof data === 'object' && data !== null) {
    const serialized = {} as T;
    for (const [key, value] of Object.entries(data)) {
      (serialized as any)[key] = fromFirestore(value);
    }
    return serialized;
  }

  // Return primitive values as-is
  return data;
}

/**
 * WRITE: plain JS -> Firestore-safe payload.
 * Recursively strips `undefined` keys (Firestore rejects `undefined`); top-level
 * `null`/`undefined` becomes `null`. Recurses arrays and nested objects.
 * Does NOT convert dates (see module note) — callers handle Timestamp coercion.
 */
export function toFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as T;
  }

  if (Array.isArray(data)) {
    return data.map(item => toFirestore(item)) as T;
  }

  if (typeof data === 'object') {
    const cleaned: any = {};
    Object.keys(data as object).forEach(key => {
      const value = (data as any)[key];
      if (value !== undefined) {
        cleaned[key] = toFirestore(value);
      }
    });
    return cleaned as T;
  }

  return data;
}
