import { describe, it, expect } from 'vitest';
import type { ActiveWorkout } from '../types/exercise';
import type { PlannedWorkout } from '../store/slices/plannedWorkoutsSlice';
import { addDaysKey, toDateKey } from '../lib/dateKey';
import { libraryScreen, profileScreen, todayScreen, workoutScreen } from './screenSummaries';

// Dates are relative to now, never literals (they rot against past-date guards).
const now = new Date();
const today = toDateKey(now);
const plan = (id: string, days: number, name: string, status: PlannedWorkout['status'] = 'planned'): PlannedWorkout => ({
  id, dateKey: addDaysKey(today, days), name, exercises: [], status, createdAt: '',
});

describe('todayScreen', () => {
  it('lists today and the planned week by name and date, skipping done and later plans', () => {
    const s = todayScreen([
      plan('a', 0, 'Push'), plan('b', 2, 'Pull'), plan('c', 6, 'Legs'), plan('d', 7, 'Next week'),
      plan('e', 1, 'Done one', 'done'), plan('f', -1, 'Yesterday'),
    ], now);
    expect(s.tab).toBe('today');
    expect(s.summary).toBe('Today: Push. 3 planned workouts in the next 7 days');
    expect(s.data).toEqual({
      date: today,
      today: [{ id: 'a', name: 'Push', exercises: 0 }],
      week: [{ date: today, name: 'Push' }, { date: addDaysKey(today, 2), name: 'Pull' }, { date: addDaysKey(today, 6), name: 'Legs' }],
    });
  });

  it('says so when nothing is planned', () => {
    expect(todayScreen([], now).summary).toBe('Nothing planned for today. 0 planned workouts in the next 7 days');
  });
});

describe('workoutScreen', () => {
  const active = {
    id: 'w', name: 'Push', currentExerciseIndex: 1, currentSetIndex: 2,
    exercises: [
      { id: 'e0', exercise: { id: 'x0', name: 'Squat' }, sets: [] },
      { id: 'e1', exercise: { id: 'x1', name: 'Bench Press' }, sets: [{ completed: true }, { completed: true }, { completed: false }, { completed: false }] },
    ],
  } as unknown as ActiveWorkout;

  it('says which exercise and set is current and whether resting', () => {
    const s = workoutScreen(active, { isActive: true });
    expect(s?.summary).toBe('Exercise 2 of 2: Bench Press, set 3 of 4 (2 done), resting between sets');
    expect(s?.data).toEqual({ exerciseId: 'e1', exercise: 'Bench Press', exerciseIndex: 1, setIndex: 2, resting: true });
    expect(workoutScreen(active, { isActive: false })?.summary).toContain('not resting');
  });

  it('publishes nothing without a workout in progress', () => {
    expect(workoutScreen(null, { isActive: false })).toBeNull();
  });
});

describe('libraryScreen / profileScreen', () => {
  it('names the filters and caps the visible exercise names at 20', () => {
    const names = Array.from({ length: 40 }, (_, k) => `Exercise ${k}`);
    const s = libraryScreen({ search: 'press', muscle: 'Chest', mineOnly: false, visibleNames: names, total: 120 });
    expect(s.summary).toBe('120 exercises for search "press", muscle Chest');
    expect((s.data as { visible: string[] }).visible).toHaveLength(20);
  });

  it('shows the profile summary without account details', () => {
    const s = profileScreen({ displayName: 'Alex', section: 'saved', savedWorkoutNames: ['Push', 'Pull'], completedCount: 12 });
    expect(s.summary).toBe('Alex: saved section, 2 saved workouts, 12 finished workouts');
    expect(JSON.stringify(s)).not.toMatch(/@|token/i);
  });
});
