import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveWorkoutSnapshot,
  loadWorkoutSnapshot,
  clearWorkoutSnapshot,
  validateWorkoutSnapshot,
  getStoredPlanContext,
  setStoredPlanContext,
  clearStoredPlanContext,
  WORKOUT_SNAPSHOT_KEY,
  ACTIVE_PLAN_CONTEXT_KEY,
  type ActivePlanContext,
  type StorageLike,
} from './workoutSession';
import type { ActiveWorkout, RestTimer } from '../types/exercise';

class MockStorage implements StorageLike {
  private store = new Map<string, string>();
  public throwOnSet = false;
  public throwOnGet = false;
  public throwOnRemove = false;

  getItem(key: string): string | null {
    if (this.throwOnGet) throw new Error('Quota or security error on getItem');
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSet) throw new Error('QuotaExceededError');
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    if (this.throwOnRemove) throw new Error('SecurityError');
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

const mockWorkout: ActiveWorkout = {
  id: 'workout-123',
  name: 'Push Day A',
  exercises: [
    {
      id: 'ex-1',
      exercise: {
        id: 'bench-press',
        name: 'Bench Press',
        muscleGroup: 'Chest',
        muscleGroups: ['Chest'],
        equipment: 'Barbell',
        videoLinks: [],
        instructions: [],
        difficulty: 'Intermediate',
        force: 'Push',
        grips: 'Overhand',
        mechanic: 'Compound',
        searchKeywords: [],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      sets: [
        { id: 'set-1', reps: 8, weight: 185, unit: 'lbs', completed: true },
        { id: 'set-2', reps: 8, weight: 185, unit: 'lbs', completed: false },
      ],
    },
  ],
  currentExerciseIndex: 0,
  currentSetIndex: 1,
  startTime: '2026-10-22T10:00:00.000Z',
  duration: 25,
  isActive: true,
};

const mockRestTimer: RestTimer = {
  isActive: true,
  timeRemaining: 45,
  duration: 90,
  targetEndTime: 1729600000000,
};

const mockPlanContext: ActivePlanContext = {
  dateKey: '2026-10-22',
  templateId: 'charlie-split',
  dayType: 'push',
  cycleOrdinal: 1,
  isRetest: false,
};

describe('workoutSession', () => {
  let storage: MockStorage;
  let sessionFallback: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
    sessionFallback = new MockStorage();
  });

  describe('snapshot save / load / clear', () => {
    it('saves, loads, and clears a valid snapshot', () => {
      const saved = saveWorkoutSnapshot(
        {
          activeWorkout: mockWorkout,
          restTimer: mockRestTimer,
          planContext: mockPlanContext,
          savedAt: '2026-10-22T10:30:00.000Z',
        },
        storage,
      );

      expect(saved).toBe(true);
      const loaded = loadWorkoutSnapshot(storage);
      expect(loaded).not.toBeNull();
      expect(loaded?.version).toBe(1);
      expect(loaded?.savedAt).toBe('2026-10-22T10:30:00.000Z');
      expect(loaded?.activeWorkout.id).toBe(mockWorkout.id);
      expect(loaded?.restTimer?.isActive).toBe(true);
      expect(loaded?.planContext?.dateKey).toBe('2026-10-22');

      clearWorkoutSnapshot(storage);
      expect(loadWorkoutSnapshot(storage)).toBeNull();
    });

    it('does not persist an empty or never-started workout', () => {
      const emptyWorkout: ActiveWorkout = {
        ...mockWorkout,
        exercises: [],
      };

      const saved = saveWorkoutSnapshot(
        {
          activeWorkout: emptyWorkout,
        },
        storage,
      );

      expect(saved).toBe(false);
      expect(storage.getItem(WORKOUT_SNAPSHOT_KEY)).toBeNull();
      expect(validateWorkoutSnapshot(null)).toBe(false);
      expect(validateWorkoutSnapshot({ version: 1, savedAt: '2026-10-22', activeWorkout: mockWorkout })).toBe(true);
    });
  });

  describe('error handling / durability', () => {
    it('ignores corrupt JSON safely without crashing', () => {
      storage.setItem(WORKOUT_SNAPSHOT_KEY, '{ invalid json... [');
      const loaded = loadWorkoutSnapshot(storage);
      expect(loaded).toBeNull();
    });

    it('ignores snapshots with the wrong version safely', () => {
      const snapshot = {
        version: 99,
        savedAt: new Date().toISOString(),
        activeWorkout: mockWorkout,
      };
      storage.setItem(WORKOUT_SNAPSHOT_KEY, JSON.stringify(snapshot));
      expect(loadWorkoutSnapshot(storage)).toBeNull();
    });

    it('ignores snapshots with missing required fields safely', () => {
      const missingWorkout = {
        version: 1,
        savedAt: new Date().toISOString(),
        activeWorkout: null,
      };
      storage.setItem(WORKOUT_SNAPSHOT_KEY, JSON.stringify(missingWorkout));
      expect(loadWorkoutSnapshot(storage)).toBeNull();

      const missingId = {
        version: 1,
        savedAt: new Date().toISOString(),
        activeWorkout: { name: 'Workout', exercises: [] },
      };
      storage.setItem(WORKOUT_SNAPSHOT_KEY, JSON.stringify(missingId));
      expect(loadWorkoutSnapshot(storage)).toBeNull();
    });

    it('handles throwing storage (QuotaExceeded / SecurityError) safely', () => {
      storage.throwOnSet = true;
      expect(() => {
        const saved = saveWorkoutSnapshot({ activeWorkout: mockWorkout }, storage);
        expect(saved).toBe(false);
      }).not.toThrow();

      storage.throwOnSet = false;
      storage.throwOnGet = true;
      expect(() => {
        const loaded = loadWorkoutSnapshot(storage);
        expect(loaded).toBeNull();
      }).not.toThrow();

      storage.throwOnGet = false;
      storage.throwOnRemove = true;
      expect(() => {
        clearWorkoutSnapshot(storage);
      }).not.toThrow();
    });
  });

  describe('plan context durability and fallback', () => {
    it('reads plan context from localStorage if present', () => {
      setStoredPlanContext(mockPlanContext, storage);
      const read = getStoredPlanContext(storage, sessionFallback);
      expect(read).toEqual(mockPlanContext);
    });

    it('falls back to sessionStorage if localStorage does not have it', () => {
      sessionFallback.setItem(ACTIVE_PLAN_CONTEXT_KEY, JSON.stringify(mockPlanContext));
      const read = getStoredPlanContext(storage, sessionFallback);
      expect(read).toEqual(mockPlanContext);
    });

    it('clears plan context from both localStorage and sessionStorage', () => {
      setStoredPlanContext(mockPlanContext, storage);
      sessionFallback.setItem(ACTIVE_PLAN_CONTEXT_KEY, JSON.stringify(mockPlanContext));

      clearStoredPlanContext(storage, sessionFallback);
      expect(storage.getItem(ACTIVE_PLAN_CONTEXT_KEY)).toBeNull();
      expect(sessionFallback.getItem(ACTIVE_PLAN_CONTEXT_KEY)).toBeNull();
    });

    it('safely handles corrupt plan context JSON', () => {
      storage.setItem(ACTIVE_PLAN_CONTEXT_KEY, '{ invalid json');
      expect(getStoredPlanContext(storage, sessionFallback)).toBeNull();
    });
  });
});
