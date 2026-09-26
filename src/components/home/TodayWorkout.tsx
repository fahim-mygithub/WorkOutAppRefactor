import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Play, Plus } from 'lucide-react';
import type { WorkoutSummary } from '../../types/exerciseHistory';
import { getMuscleGroupMeta, MUSCLE_GROUP_META } from './muscleGroup';
import { usePlannedSchedule } from '../../hooks/usePlannedSchedule';
import { useStartPlannedDay } from '../../hooks/useStartPlannedDay';
import type { PlannedDay } from '../../types/schedule';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';

interface TodayWorkoutProps {
  /** Raw workout history (month-independent). Drives the Today states. */
  workoutHistory: WorkoutSummary[];
  isLoading: boolean;
}

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const daysBetween = (a: Date, b: Date): number =>
  Math.abs(Math.floor((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000)));

// Compact volume: 9,000 → "9K", 1,200,000 → "1.2M".
const formatVolume = (num: number): string => {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

/**
 * The Home hero (Tempo): what's happening *today*, answered with one display
 * title, one sentence, and at most one amber action. Four states, derived from
 * the raw history (not the displayed calendar month, so it stays correct while
 * the user pages the grid):
 *   1. Planned session today    → "Push" + variant + Start workout (primary).
 *   2. A workout logged today   → workout name + three quiet stats.
 *   3. Trained in the last 3 days → "Rest day".
 *   4. Otherwise                → "Nothing planned" + Build a workout (primary).
 */
export function TodayWorkout({ workoutHistory, isLoading }: TodayWorkoutProps) {
  const { getPlannedDay } = usePlannedSchedule();
  const startPlannedDay = useStartPlannedDay();

  if (isLoading) {
    return (
      <div aria-busy="true" className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-12 w-3/5" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    );
  }

  const now = new Date();
  const todays = workoutHistory.find((w) => isSameDay(new Date(w.startTime), now)) ?? null;
  const trainedRecently = workoutHistory.some((w) => {
    const d = new Date(w.startTime);
    return !isSameDay(d, now) && d < now && daysBetween(d, now) <= 3;
  });

  const plannedToday = getPlannedDay(now);
  const showPlanned = !todays && plannedToday != null && plannedToday.status === 'planned';

  return (
    <section aria-label="Today">
      {todays ? (
        <LoggedWorkout workout={todays} />
      ) : showPlanned && plannedToday ? (
        <PlannedToday planned={plannedToday} onStart={() => startPlannedDay(plannedToday)} />
      ) : trainedRecently ? (
        <RestDay />
      ) : (
        <NoWorkoutPlanned />
      )}
    </section>
  );
}

function HeroTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="mt-1 break-words font-display text-display-lg text-ink">{children}</h1>
  );
}

function PlannedToday({ planned, onStart }: { planned: PlannedDay; onStart: () => void }) {
  const meta = MUSCLE_GROUP_META[planned.dayType];
  const accessoryCount = planned.preview.filter((p) => p.kind === 'accessory').length;
  return (
    <div>
      <p className="text-body-sm text-ink-muted">Planned for today</p>
      <HeroTitle>{meta.label}</HeroTitle>
      <p className="mt-3 max-w-[34ch] text-body text-ink-muted">
        {planned.variantLabel}
        {accessoryCount > 0
          ? `, one compound lift and ${accessoryCount} accessor${accessoryCount === 1 ? 'y' : 'ies'}.`
          : '.'}
      </p>
      <Button variant="primary" size="xl" className="mt-6" onClick={onStart}>
        <Play size={20} fill="currentColor" aria-hidden="true" />
        <span>Start workout</span>
      </Button>
    </div>
  );
}

function LoggedWorkout({ workout }: { workout: WorkoutSummary }) {
  const meta = getMuscleGroupMeta(workout.name);
  const stats = [
    { value: String(workout.totalSets), label: 'sets' },
    { value: formatVolume(workout.totalVolume), label: 'lb moved' },
    { value: String(workout.duration), label: 'min' },
  ];
  return (
    <div>
      <p className="text-body-sm text-accent-2">Done today, {meta.label.toLowerCase()} focus</p>
      <HeroTitle>{workout.name}</HeroTitle>
      <dl className="mt-5 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="sr-only">{s.label}</dt>
            <dd className="font-display font-tabular text-display text-ink">{s.value}</dd>
            <dd aria-hidden="true" className="text-body-sm text-ink-muted">{s.label}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RestDay() {
  return (
    <div>
      <p className="text-body-sm text-ink-muted">Recovery</p>
      <HeroTitle>Rest day</HeroTitle>
      <p className="mt-3 max-w-[34ch] text-body text-ink-muted">
        You trained recently. Muscles grow on the days off.
      </p>
      <Button asChild variant="secondary" size="lg" className="mt-5">
        <Link to="/build">Train anyway</Link>
      </Button>
    </div>
  );
}

function NoWorkoutPlanned() {
  return (
    <div>
      <p className="text-body-sm text-ink-muted">Nothing planned</p>
      <HeroTitle>Free day</HeroTitle>
      <p className="mt-3 max-w-[34ch] text-body text-ink-muted">
        Pick a template or write your own session.
      </p>
      <Button asChild variant="primary" size="xl" className="mt-6">
        <Link to="/build">
          <Plus size={20} aria-hidden="true" />
          <span>Build a workout</span>
        </Link>
      </Button>
    </div>
  );
}
