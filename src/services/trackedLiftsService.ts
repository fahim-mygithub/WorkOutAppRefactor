/**
 * Local-first persistence for tracked lifts, keyed by user identity. Mirrors
 * ScheduleService's localStorage pattern (versioned blob, non-fatal failures).
 */
import type { TrackedLiftsData } from '../types/trackedLifts';

const SCHEMA_VERSION = 1;
const storageKey = (idKey: string): string => `woapp:v1:trackedLifts:${idKey}`;

interface PersistedTrackedLifts extends TrackedLiftsData {
  schemaVersion: number;
}

export class TrackedLiftsService {
  static loadLocal(idKey: string): TrackedLiftsData | null {
    try {
      const raw = localStorage.getItem(storageKey(idKey));
      if (!raw) return null;
      const data = JSON.parse(raw) as PersistedTrackedLifts;
      if (data.schemaVersion !== SCHEMA_VERSION) return null;
      if (!Array.isArray(data.categories) || !Array.isArray(data.lifts)) return null;
      return {
        categories: data.categories,
        lifts: data.lifts,
        lastGoal: data.lastGoal,
        pendingBests: Array.isArray(data.pendingBests) ? data.pendingBests : [],
      };
    } catch {
      return null;
    }
  }

  static saveLocal(idKey: string, data: TrackedLiftsData): void {
    try {
      const blob: PersistedTrackedLifts = { ...data, schemaVersion: SCHEMA_VERSION };
      localStorage.setItem(storageKey(idKey), JSON.stringify(blob));
    } catch {
      /* quota / unavailable — non-fatal */
    }
  }
}
