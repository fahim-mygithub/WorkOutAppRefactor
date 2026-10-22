import type { ActiveWorkout, RestTimer } from '../types/exercise';

export const WORKOUT_SNAPSHOT_KEY = 'workout.active.v1';
export const WORKOUT_SNAPSHOT_VERSION = 1;
export const ACTIVE_PLAN_CONTEXT_KEY = 'activePlanContext';

export interface ActivePlanContext {
  dateKey: string;
  templateId: 'charlie-split';
  dayType: 'push' | 'pull' | 'legs';
  cycleOrdinal: number;
  isRetest?: boolean;
}

export interface WorkoutSessionSnapshot {
  version: 1;
  savedAt: string;
  activeWorkout: ActiveWorkout;
  restTimer: RestTimer | null;
  planContext?: ActivePlanContext | null;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function getSafeLocalStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Disabled / throwing storage
  }
  return null;
}

export function getSafeSessionStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch {
    // Disabled / throwing storage
  }
  return null;
}

export function validateWorkoutSnapshot(data: unknown): data is WorkoutSessionSnapshot {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;

  if (d.version !== WORKOUT_SNAPSHOT_VERSION) return false;
  if (typeof d.savedAt !== 'string' || d.savedAt.length === 0) return false;

  const w = d.activeWorkout;
  if (!w || typeof w !== 'object') return false;
  const workout = w as Record<string, unknown>;

  if (typeof workout.id !== 'string' || workout.id.length === 0) return false;
  if (typeof workout.name !== 'string') return false;
  if (!Array.isArray(workout.exercises) || workout.exercises.length === 0) return false;
  if (typeof workout.currentExerciseIndex !== 'number' || typeof workout.currentSetIndex !== 'number') {
    return false;
  }

  // Validate restTimer if present
  if (d.restTimer !== null && d.restTimer !== undefined) {
    if (typeof d.restTimer !== 'object') return false;
    const r = d.restTimer as Record<string, unknown>;
    if (typeof r.isActive !== 'boolean' || typeof r.timeRemaining !== 'number' || typeof r.duration !== 'number') {
      return false;
    }
  }

  // Validate planContext if present
  if (d.planContext !== null && d.planContext !== undefined) {
    if (typeof d.planContext !== 'object') return false;
    const p = d.planContext as Record<string, unknown>;
    if (typeof p.dateKey !== 'string' || p.templateId !== 'charlie-split' || typeof p.dayType !== 'string') {
      return false;
    }
  }

  return true;
}

export function saveWorkoutSnapshot(
  snapshot: {
    activeWorkout: ActiveWorkout;
    restTimer?: RestTimer | null;
    planContext?: ActivePlanContext | null;
    savedAt?: string;
  },
  storage: StorageLike | null = getSafeLocalStorage(),
): boolean {
  if (!storage) return false;
  try {
    if (!snapshot.activeWorkout || !Array.isArray(snapshot.activeWorkout.exercises) || snapshot.activeWorkout.exercises.length === 0) {
      return false;
    }
    const fullSnapshot: WorkoutSessionSnapshot = {
      version: WORKOUT_SNAPSHOT_VERSION,
      savedAt: snapshot.savedAt ?? new Date().toISOString(),
      activeWorkout: snapshot.activeWorkout,
      restTimer: snapshot.restTimer ?? null,
      planContext: snapshot.planContext ?? null,
    };
    storage.setItem(WORKOUT_SNAPSHOT_KEY, JSON.stringify(fullSnapshot));
    return true;
  } catch {
    return false;
  }
}

export function loadWorkoutSnapshot(
  storage: StorageLike | null = getSafeLocalStorage(),
): WorkoutSessionSnapshot | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(WORKOUT_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (validateWorkoutSnapshot(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearWorkoutSnapshot(
  storage: StorageLike | null = getSafeLocalStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(WORKOUT_SNAPSHOT_KEY);
  } catch {
    // Non-fatal
  }
}

export function getStoredPlanContext(
  storage: StorageLike | null = getSafeLocalStorage(),
  sessionFallback: StorageLike | null = getSafeSessionStorage(),
): ActivePlanContext | null {
  try {
    if (storage) {
      const raw = storage.getItem(ACTIVE_PLAN_CONTEXT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.dateKey === 'string' && parsed.templateId === 'charlie-split') {
          return parsed as ActivePlanContext;
        }
      }
    }
  } catch {
    // Non-fatal, try fallback
  }

  try {
    if (sessionFallback) {
      const raw = sessionFallback.getItem(ACTIVE_PLAN_CONTEXT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.dateKey === 'string' && parsed.templateId === 'charlie-split') {
          return parsed as ActivePlanContext;
        }
      }
    }
  } catch {
    // Non-fatal
  }

  return null;
}

export function setStoredPlanContext(
  context: ActivePlanContext,
  storage: StorageLike | null = getSafeLocalStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(ACTIVE_PLAN_CONTEXT_KEY, JSON.stringify(context));
  } catch {
    // Non-fatal
  }
}

export function clearStoredPlanContext(
  storage: StorageLike | null = getSafeLocalStorage(),
  sessionFallback: StorageLike | null = getSafeSessionStorage(),
): void {
  try {
    storage?.removeItem(ACTIVE_PLAN_CONTEXT_KEY);
  } catch {
    // Non-fatal
  }
  try {
    sessionFallback?.removeItem(ACTIVE_PLAN_CONTEXT_KEY);
  } catch {
    // Non-fatal
  }
}
