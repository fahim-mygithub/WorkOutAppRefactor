import { useState, useCallback } from 'react';

export type WorkoutViewMode = 'cards' | 'list';

export const WORKOUT_VIEW_MODE_STORAGE_KEY = 'workoutViewMode';

/** Safely reads the persisted workout view mode from localStorage.
 *  Falls back to 'cards' if missing, invalid, or if storage access throws
 *  (e.g., private browsing, quota, security restrictions). */
export function getStoredWorkoutViewMode(): WorkoutViewMode {
  try {
    const stored = localStorage.getItem(WORKOUT_VIEW_MODE_STORAGE_KEY);
    if (stored === 'cards' || stored === 'list') {
      return stored;
    }
    return 'cards';
  } catch {
    return 'cards';
  }
}

/** Hook to read and write the persisted workout view mode preference.
 *  Defaults to 'cards' with a safe fallback when storage is unreadable. */
export function useWorkoutViewMode(initialMode?: WorkoutViewMode) {
  const [viewMode, setViewModeState] = useState<WorkoutViewMode>(() => {
    if (initialMode) return initialMode;
    return getStoredWorkoutViewMode();
  });

  const setViewMode = useCallback((mode: WorkoutViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(WORKOUT_VIEW_MODE_STORAGE_KEY, mode);
    } catch {
      // Safe fallback if storage write fails
    }
  }, []);

  return [viewMode, setViewMode] as const;
}
