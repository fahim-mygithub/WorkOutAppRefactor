/**
 * Local-first persistence for the Charlie-Split schedule. localStorage is the
 * source of truth for the loginless demo and anonymous users (and a fast cache
 * for authed users); Firestore is mirrored only when authed AND not the demo
 * identity. Mirrors the WorkoutStorageService static-class pattern.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { isDemo } from '../demo/demo';
import type { PersistedSchedule } from '../types/schedule';
import type { WorkoutSummary } from '../types/exerciseHistory';

const SCHEMA_VERSION = 1;
const scheduleKey = (idKey: string): string => `woapp:v1:schedule:${idKey}`;
const performedKey = (idKey: string): string => `woapp:v1:performed:${idKey}`;

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

export class ScheduleService {
  // ---------- local: schedule blob ----------

  static loadLocal(idKey: string): PersistedSchedule | null {
    const data = readJSON<PersistedSchedule>(scheduleKey(idKey));
    if (!data || data.schemaVersion !== SCHEMA_VERSION) return null;
    return data;
  }

  static saveLocal(idKey: string, data: Omit<PersistedSchedule, 'schemaVersion'>): void {
    writeJSON(scheduleKey(idKey), { ...data, schemaVersion: SCHEMA_VERSION });
  }

  // ---------- local: performed summaries (makes completed demo days render) ----------

  static getPerformedLocal(idKey: string): WorkoutSummary[] {
    const rows = readJSON<WorkoutSummary[]>(performedKey(idKey)) ?? [];
    // localStorage stores dates as ISO strings — revive to Date for the calendar.
    return rows.map((s) => ({
      ...s,
      startTime: new Date(s.startTime),
      endTime: new Date(s.endTime),
    }));
  }

  static appendPerformedLocal(idKey: string, summary: WorkoutSummary): void {
    const existing = readJSON<WorkoutSummary[]>(performedKey(idKey)) ?? [];
    existing.push(summary);
    // Cap to a reasonable window so the blob can't grow unbounded.
    const capped = existing.slice(-400);
    writeJSON(performedKey(idKey), capped);
  }

  // ---------- Firestore mirror (guarded; no-op in demo / anon) ----------

  private static shouldMirror(uid?: string): uid is string {
    return Boolean(uid) && !isDemo(uid);
  }

  static async saveRemote(uid: string | undefined, data: Omit<PersistedSchedule, 'schemaVersion'>): Promise<void> {
    if (!this.shouldMirror(uid)) return;
    try {
      await setDoc(doc(db, 'users', uid, 'schedule', 'charlie'), {
        ...data,
        schemaVersion: SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[scheduleService] saveRemote failed', err);
    }
  }

  static async getRemote(uid: string | undefined): Promise<PersistedSchedule | null> {
    if (!this.shouldMirror(uid)) return null;
    try {
      const snap = await getDoc(doc(db, 'users', uid, 'schedule', 'charlie'));
      if (!snap.exists()) return null;
      const data = snap.data() as PersistedSchedule;
      return data.schemaVersion === SCHEMA_VERSION ? data : null;
    } catch (err) {
      console.warn('[scheduleService] getRemote failed', err);
      return null;
    }
  }
}
