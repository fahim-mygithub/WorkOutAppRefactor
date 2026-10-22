import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useWorkoutViewMode,
  getStoredWorkoutViewMode,
  WORKOUT_VIEW_MODE_STORAGE_KEY,
} from './useWorkoutViewMode';

describe('useWorkoutViewMode', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('default and stored preference', () => {
    it('defaults to "cards" when localStorage has no entry', () => {
      const { result } = renderHook(() => useWorkoutViewMode());
      expect(result.current[0]).toBe('cards');
    });

    it('reads "list" when localStorage has "list"', () => {
      localStorage.setItem(WORKOUT_VIEW_MODE_STORAGE_KEY, 'list');
      const { result } = renderHook(() => useWorkoutViewMode());
      expect(result.current[0]).toBe('list');
    });

    it('reads "cards" when localStorage has "cards"', () => {
      localStorage.setItem(WORKOUT_VIEW_MODE_STORAGE_KEY, 'cards');
      const { result } = renderHook(() => useWorkoutViewMode());
      expect(result.current[0]).toBe('cards');
    });

    it('respects initialMode override if provided', () => {
      localStorage.setItem(WORKOUT_VIEW_MODE_STORAGE_KEY, 'cards');
      const { result } = renderHook(() => useWorkoutViewMode('list'));
      expect(result.current[0]).toBe('list');
    });
  });

  describe('safe fallback handling', () => {
    it('falls back to "cards" when stored value is invalid', () => {
      localStorage.setItem(WORKOUT_VIEW_MODE_STORAGE_KEY, 'invalid_mode');
      const { result } = renderHook(() => useWorkoutViewMode());
      expect(result.current[0]).toBe('cards');
    });

    it('falls back to "cards" when localStorage.getItem throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError: storage is disabled');
      });
      expect(getStoredWorkoutViewMode()).toBe('cards');

      const { result } = renderHook(() => useWorkoutViewMode());
      expect(result.current[0]).toBe('cards');
    });
  });

  describe('updating mode', () => {
    it('updates view mode state and persists to localStorage', () => {
      const { result } = renderHook(() => useWorkoutViewMode());
      expect(result.current[0]).toBe('cards');

      act(() => {
        result.current[1]('list');
      });

      expect(result.current[0]).toBe('list');
      expect(localStorage.getItem(WORKOUT_VIEW_MODE_STORAGE_KEY)).toBe('list');

      act(() => {
        result.current[1]('cards');
      });

      expect(result.current[0]).toBe('cards');
      expect(localStorage.getItem(WORKOUT_VIEW_MODE_STORAGE_KEY)).toBe('cards');
    });

    it('updates state safely even if localStorage.setItem throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const { result } = renderHook(() => useWorkoutViewMode());
      expect(result.current[0]).toBe('cards');

      act(() => {
        result.current[1]('list');
      });

      expect(result.current[0]).toBe('list');
    });
  });
});
