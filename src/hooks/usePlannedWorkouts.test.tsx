import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import plannedWorkoutsReducer, { planAdded } from '../store/slices/plannedWorkoutsSlice';
import { usePlannedWorkouts } from './usePlannedWorkouts';

vi.mock('./useStartPlannedWorkout', () => ({
  useStartPlannedWorkout: () => vi.fn(),
}));

function createStore() {
  return configureStore({
    reducer: {
      plannedWorkouts: plannedWorkoutsReducer,
    },
  });
}

describe('usePlannedWorkouts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('recomputes todayKey and categorizes overdue plans after midnight without full remount', () => {
    // Start at 2026-10-22 23:55:00
    vi.setSystemTime(new Date(2026, 9, 22, 23, 55, 0));

    const store = createStore();
    // Add a plan for today (2026-10-22)
    store.dispatch(
      planAdded({
        id: 'plan-midnight',
        name: 'Late Workout',
        dateKey: '2026-10-22',
        exercises: [],
      }),
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { result, rerender } = renderHook(() => usePlannedWorkouts(), { wrapper });

    expect(result.current.todayKey).toBe('2026-10-22');
    expect(result.current.todayPlans.length).toBe(1);
    expect(result.current.overduePlans.length).toBe(0);

    // Advance time past midnight to next day (2026-10-23 00:05:00)
    vi.setSystemTime(new Date(2026, 9, 23, 0, 5, 0));

    // Simulate visibility change (e.g. user opens phone or app becomes visible in morning)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    rerender();

    // todayKey should have rolled over to 2026-10-23
    expect(result.current.todayKey).toBe('2026-10-23');
    // The previous day's plan should now be marked overdue / missed!
    expect(result.current.todayPlans.length).toBe(0);
    expect(result.current.overduePlans.length).toBe(1);
    expect(result.current.overduePlans[0].id).toBe('plan-midnight');
  });
});
