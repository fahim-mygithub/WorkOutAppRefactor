import { Timestamp } from 'firebase/firestore';

/**
 * Recursively converts all Firebase Timestamp objects to ISO strings in an object or array
 * This ensures data is serializable for Redux store
 */
export function serializeFirestoreData<T>(data: T): T {
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
    return data.map(item => serializeFirestoreData(item)) as T;
  }

  // Handle objects
  if (typeof data === 'object' && data !== null) {
    const serialized = {} as T;
    for (const [key, value] of Object.entries(data)) {
      (serialized as any)[key] = serializeFirestoreData(value);
    }
    return serialized;
  }

  // Return primitive values as-is
  return data;
}

/**
 * Type guard to check if a value is a Firebase Timestamp
 */
export function isTimestamp(value: any): value is Timestamp {
  return value instanceof Timestamp;
}

/**
 * Safely converts a Firebase Timestamp to ISO string, with fallback
 */
export function timestampToISOString(timestamp: Timestamp | null | undefined): string {
  if (!timestamp) {
    return new Date().toISOString();
  }
  return timestamp.toDate().toISOString();
}