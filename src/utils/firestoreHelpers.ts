/**
 * Back-compat re-exports. The canonical implementation now lives in
 * `src/firestore/serde.ts`. `serializeFirestoreData` is the old name for
 * `fromFirestore` (the read path).
 */
export { fromFirestore as serializeFirestoreData, isTimestamp, timestampToISOString } from '../firestore/serde';
