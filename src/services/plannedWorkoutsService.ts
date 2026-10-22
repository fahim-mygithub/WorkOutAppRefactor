import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { isDemo } from '../demo/demo';
import { toFirestore, fromFirestore } from '../firestore/serde';
import type { PlannedWorkout } from '../store/slices/plannedWorkoutsSlice';

const SCHEMA_VERSION = 1;
const storageKey = (idKey: string): string => `woapp:v1:plannedWorkouts:${idKey}`;

interface PersistedPlannedWorkouts {
  schemaVersion: number;
  plans: PlannedWorkout[];
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / unavailable — non-fatal */
  }
}

export class PlannedWorkoutsService {
  static loadLocal(idKey: string): PlannedWorkout[] | null {
    const data = readJSON<PersistedPlannedWorkouts>(storageKey(idKey));
    if (!data || data.schemaVersion !== SCHEMA_VERSION || !Array.isArray(data.plans)) {
      return null;
    }
    return data.plans;
  }

  static saveLocal(idKey: string, plans: PlannedWorkout[]): void {
    writeJSON(storageKey(idKey), {
      schemaVersion: SCHEMA_VERSION,
      plans,
    });
  }

  private static shouldMirror(uid?: string): uid is string {
    return Boolean(uid) && !isDemo(uid);
  }

  static async saveRemote(uid: string | undefined, plans: PlannedWorkout[]): Promise<void> {
    if (!this.shouldMirror(uid)) return;
    try {
      const payload = toFirestore({
        plans,
        schemaVersion: SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
      });
      await setDoc(doc(db, 'users', uid, 'schedule', 'plannedWorkouts'), payload);
    } catch (err) {
      console.warn('[plannedWorkoutsService] saveRemote failed', err);
    }
  }

  static async getRemote(uid: string | undefined): Promise<PlannedWorkout[] | null> {
    if (!this.shouldMirror(uid)) return null;
    try {
      const snap = await getDoc(doc(db, 'users', uid, 'schedule', 'plannedWorkouts'));
      if (!snap.exists()) return null;
      const data = fromFirestore(snap.data()) as { plans?: PlannedWorkout[]; schemaVersion?: number };
      return Array.isArray(data?.plans) ? data.plans : null;
    } catch (err) {
      console.warn('[plannedWorkoutsService] getRemote failed', err);
      return null;
    }
  }
}
