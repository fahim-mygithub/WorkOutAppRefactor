/**
 * What each screen publishes for the assistant (the Build screen's own is in
 * BuildPage, next to its state). Thin on purpose: names, counts and the
 * position in a workout; the store caps whatever is sent (`capScreen`).
 */
import type { ActiveWorkout, RestTimer } from '../types/exercise';
import type { PlannedWorkout } from '../store/slices/plannedWorkoutsSlice';
import { addDaysKey, toDateKey } from '../lib/dateKey';
import type { ScreenSnapshot } from './screenSnapshot';

/** Planned days listed for the week, and exercise / workout names listed. */
const MAX_WEEK_DAYS = 14;
const MAX_NAMES = 20;

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Today: today's plans not yet done, and the planned days of the week from today (name + date). */
export function todayScreen(plans: readonly PlannedWorkout[], now: Date = new Date()): ScreenSnapshot {
  const todayKey = toDateKey(now);
  const weekEnd = addDaysKey(todayKey, 6);
  const open = plans.filter((p) => p.status === 'planned');
  const today = open.filter((p) => p.dateKey === todayKey);
  const week = open
    .filter((p) => p.dateKey >= todayKey && p.dateKey <= weekEnd)
    .sort((a, b) => (a.dateKey === b.dateKey ? a.name.localeCompare(b.name) : a.dateKey < b.dateKey ? -1 : 1))
    .slice(0, MAX_WEEK_DAYS);
  const summary = [
    today.length ? `Today: ${today.map((p) => p.name).join(', ')}` : 'Nothing planned for today',
    `${plural(week.length, 'planned workout')} in the next 7 days`,
  ].join('. ');
  return {
    tab: 'today',
    title: 'Today',
    summary,
    data: {
      date: todayKey,
      today: today.slice(0, 3).map((p) => ({ id: p.id, name: p.name, exercises: p.exercises.length })),
      week: week.map((p) => ({ date: p.dateKey, name: p.name })),
    },
  };
}

/** The player: which exercise and set is current, and whether the rest timer runs (not its seconds: they tick). */
export function workoutScreen(active: ActiveWorkout | null, rest: Pick<RestTimer, 'isActive'>): ScreenSnapshot | null {
  if (!active) return null;
  const exercise = active.exercises[active.currentExerciseIndex];
  if (!exercise) return null;
  const name = exercise.customTitle || exercise.exercise.name;
  const setNo = active.currentSetIndex + 1;
  const done = exercise.sets.filter((s) => s.completed).length;
  const resting = rest.isActive;
  return {
    tab: 'workout',
    title: active.name,
    summary: [
      `Exercise ${active.currentExerciseIndex + 1} of ${active.exercises.length}: ${name}`,
      `set ${setNo} of ${exercise.sets.length} (${done} done)`,
      resting ? 'resting between sets' : 'not resting',
    ].join(', '),
    data: {
      exerciseId: exercise.id,
      exercise: name,
      exerciseIndex: active.currentExerciseIndex,
      setIndex: active.currentSetIndex,
      resting,
    },
  };
}

/** Library: the open search and filters, and the exercise names the list shows. */
export function libraryScreen(view: {
  search: string;
  muscle: string;
  mineOnly: boolean;
  visibleNames: readonly string[];
  total: number;
}): ScreenSnapshot {
  const filters = [
    view.search ? `search "${view.search.slice(0, 40)}"` : '',
    view.muscle ? `muscle ${view.muscle}` : '',
    view.mineOnly ? 'my exercises only' : '',
  ].filter(Boolean);
  return {
    tab: 'library',
    title: 'Exercise library',
    summary: `${plural(view.total, 'exercise')}${filters.length ? ` for ${filters.join(', ')}` : ''}`,
    data: {
      search: view.search.slice(0, 80),
      muscle: view.muscle,
      mineOnly: view.mineOnly,
      total: view.total,
      visible: view.visibleNames.slice(0, MAX_NAMES),
    },
  };
}

/** Profile: the name, the section open, and the lifter's own saved workouts. */
export function profileScreen(view: {
  displayName: string;
  section: string;
  savedWorkoutNames: readonly string[];
  completedCount: number;
}): ScreenSnapshot {
  return {
    tab: 'profile',
    title: 'Profile',
    summary: `${view.displayName}: ${view.section} section, ${plural(view.savedWorkoutNames.length, 'saved workout')}, ${plural(view.completedCount, 'finished workout')}`,
    data: {
      displayName: view.displayName,
      section: view.section,
      savedWorkouts: view.savedWorkoutNames.slice(0, MAX_NAMES),
      finishedWorkouts: view.completedCount,
    },
  };
}
