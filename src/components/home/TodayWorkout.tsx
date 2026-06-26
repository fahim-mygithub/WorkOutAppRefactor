import { Link } from 'react-router-dom';
import { Moon, Plus, Play } from 'lucide-react';
import type { WorkoutSummary } from '../../types/exerciseHistory';
import { getMuscleGroupMeta, MUSCLE_GROUP_META } from './muscleGroup';
import { usePlannedSchedule } from '../../hooks/usePlannedSchedule';
import { useStartPlannedDay } from '../../hooks/useStartPlannedDay';
import type { PlannedDay } from '../../types/schedule';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../../lib/utils';

interface TodayWorkoutProps {
  /** Raw workout history (month-independent). Drives the three Today states. */
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
 * Bottom section of the Home hub: what's happening *today*. Three states,
 * derived from the raw history (not the displayed calendar month, so it stays
 * correct while the user pages the grid):
 *   1. A workout logged today  → title heading + two descriptive lines.
 *   2. No workout today, but trained within the last 3 days → "Rest Day".
 *   3. No workout today and no recent training → "No workout planned" + CTA.
 *
 * NOTE: the data model has no scheduled/planned-workout concept yet, so the
 * Rest-Day vs No-Plan split keys off *recent* activity. Swap this heuristic for
 * a real plan/schedule lookup once that exists.
 */
export function TodayWorkout({ workoutHistory, isLoading }: TodayWorkoutProps) {
  const { getPlannedDay } = usePlannedSchedule();
  const startPlannedDay = useStartPlannedDay();

  if (isLoading) {
    return (
      <div className="border-t border-ink/10 pt-5">
        <Skeleton className="mb-3 h-3 w-16" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
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
    <div className="border-t border-ink/10 pt-5">
      <p className="mb-3 font-marker text-caption uppercase tracking-wide text-ink-subtle">
        Today
      </p>
      {todays ? (
        <LoggedWorkout workout={todays} />
      ) : showPlanned && plannedToday ? (
        <PlannedToday planned={plannedToday} onStart={() => startPlannedDay(plannedToday)} />
      ) : trainedRecently ? (
        <RestDay />
      ) : (
        <NoWorkoutPlanned />
      )}
    </div>
  );
}

function PlannedToday({ planned, onStart }: { planned: PlannedDay; onStart: () => void }) {
  const meta = MUSCLE_GROUP_META[planned.dayType];
  const Icon = meta.icon;
  const accessoryCount = planned.preview.filter((p) => p.kind === 'accessory').length;
  return (
    <div className="flex items-start gap-3">
      <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-md', meta.bgClass)}>
        <Icon size={22} className="text-ink-inverse" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-marker text-title leading-tight text-ink">Today: {meta.label}</h3>
        <p className="mt-0.5 truncate text-body-sm text-ink-muted">
          {planned.variantLabel}
          {accessoryCount > 0 ? ` · compound + ${accessoryCount} more` : ''}
        </p>
        <Button variant="primary" size="sm" className="mt-3" onClick={onStart}>
          <Play size={16} />
          <span>Start workout</span>
        </Button>
      </div>
    </div>
  );
}

function LoggedWorkout({ workout }: { workout: WorkoutSummary }) {
  const meta = getMuscleGroupMeta(workout.name);
  const Icon = meta.icon;
  const exerciseLabel = `${workout.totalExercises} exercise${workout.totalExercises === 1 ? '' : 's'}`;

  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-md',
          meta.bgClass,
        )}
      >
        <Icon size={22} className="text-ink-inverse" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        {/* Heading = the workout title */}
        <h3 className="truncate font-marker text-title leading-tight text-ink">
          {workout.name}
        </h3>
        {/* Two lines describing what the workout is */}
        <p className="mt-0.5 truncate text-body-sm text-ink-muted">
          {meta.label} focus · {exerciseLabel}
        </p>
        <p className="truncate font-num font-tabular text-body-sm text-ink-muted">
          {workout.totalSets} sets · {formatVolume(workout.totalVolume)} lbs · {workout.duration} min
        </p>
      </div>
    </div>
  );
}

function RestDay() {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muscle-mobility/15">
        <Moon size={22} className="text-muscle-mobility" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-marker text-title leading-tight text-ink">Rest Day</h3>
        <p className="mt-0.5 text-body-sm text-ink-muted">
          Recovery in progress — your muscles grow on the days off.
        </p>
      </div>
    </div>
  );
}

function NoWorkoutPlanned() {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-dashed border-ink/20 bg-surface-subtle">
        <Plus size={22} className="text-ink-subtle" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-marker text-title leading-tight text-ink">No workout planned</h3>
        <p className="mt-0.5 text-body-sm text-ink-muted">
          Nothing on the board for today. Ready to change that?
        </p>
        <Button asChild variant="primary" size="sm" className="mt-3">
          <Link to="/build">
            <Plus size={16} />
            <span>Build a workout</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
