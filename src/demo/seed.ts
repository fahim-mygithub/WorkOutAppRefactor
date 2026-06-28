/**
 * Seed data for the demo build. Dispatches a believable in-memory profile +
 * stats so the published demo isn't empty, and supplies a few past workouts that
 * the Home calendar / streak / stats read (via the demo-guarded
 * ExerciseHistoryService.getWorkoutHistory). All RAM-only — nothing persists.
 */
import type { AppDispatch } from '../store';
import { setProfile, updateStats } from '../store/slices/userSlice';
import type { WorkoutSummary } from '../types/exerciseHistory';
import { DEMO_UID, DEMO_USER } from './demo';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A handful of recent workouts for the demo account. Days 1/2/3 are consecutive
 * (a 3-day streak ending yesterday), with two more earlier in the week so the
 * calendar shows activity. TODAY is intentionally left free so the active plan's
 * "Today" workout still surfaces with a Start button (a logged-today workout
 * would otherwise mask it). Shape mirrors home-calendar-showcase.tsx.
 */
export function getDemoWorkoutHistory(): WorkoutSummary[] {
  const now = Date.now();
  const names = ['Push Day', 'Pull Day', 'Leg Day', 'Upper Body', 'Full Body'];
  const dayOffsets = [1, 2, 3, 5, 7];

  return dayOffsets.map((offset, i) => {
    const end = new Date(now - offset * DAY_MS);
    const start = new Date(end.getTime() - (50 + i * 5) * 60 * 1000);
    return {
      id: `demo-workout-${i}`,
      userId: DEMO_UID,
      name: names[i % names.length],
      startTime: start,
      endTime: end,
      duration: 50 + i * 5,
      totalExercises: 4 + (i % 3),
      totalSets: 16 + i * 2,
      totalReps: 140 + i * 12,
      totalVolume: 9000 + i * 1100,
      exercisesSummary: [],
    };
  });
}

/** Dispatch the demo identity + lifetime stats into the in-memory store. */
export function seedDemoState(dispatch: AppDispatch): void {
  const now = Date.now();

  dispatch(
    setProfile({
      uid: DEMO_USER.uid,
      email: DEMO_USER.email,
      displayName: DEMO_USER.displayName,
      createdAt: new Date(now - 30 * DAY_MS).toISOString(),
      lastActiveAt: new Date(now).toISOString(),
    }),
  );

  dispatch(
    updateStats({
      totalWorkouts: 5,
      totalWorkoutTime: 270,
      totalSets: 92,
      totalReps: 720,
      totalWeightLifted: 48000,
      currentStreak: 3,
      favoriteExercises: ['Barbell Bench Press', 'Back Squat', 'Deadlift'],
      lastWorkoutDate: new Date(now).toISOString(),
    }),
  );
}
