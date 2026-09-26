import type { WorkoutCalendarDay } from '../../utils/statsCalculator';
import { getWorkoutIntensity } from '../../utils/workoutColors';
import { getMuscleGroupMeta } from './muscleGroup';
import { usePlannedSchedule } from '../../hooks/usePlannedSchedule';
import { PlannedDayCard } from './PlannedDayCard';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '../ui/sheet';
import { cn } from '../../lib/utils';

interface WorkoutDayModalProps {
  day: WorkoutCalendarDay | null;
  isOpen: boolean;
  onClose: () => void;
}

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

/**
 * Day detail sheet (Tempo). A logged day reads as a muted context line, the
 * date as a display title, the day's totals as display numbers with muted
 * labels, then one hairline row per workout. Nothing to act on here, so there
 * is no amber action; planned days hand off to PlannedDayCard, which has one.
 */
export function WorkoutDayModal({ day, isOpen, onClose }: WorkoutDayModalProps) {
  const { plannedByDate } = usePlannedSchedule();
  const hasWorkouts = !!day && day.workouts.length > 0;
  const isToday = day?.isToday ?? false;
  const isPast = day?.isPast ?? false;
  // Read the LIVE planned day (so a re-roll updates the preview in place).
  const planned = day?.planned ? plannedByDate.get(day.planned.dateKey) ?? day.planned : null;
  const showPlanned = !hasWorkouts && planned != null && planned.status === 'planned';

  // Planned days get a bespoke centered card; completed/rest keep the bottom sheet.
  if (day && showPlanned && planned) {
    return <PlannedDayCard day={day} planned={planned} isOpen={isOpen} onClose={onClose} />;
  }

  const stateLabel = hasWorkouts
    ? isToday
      ? 'Done today'
      : 'Logged'
    : isToday
      ? 'Today'
      : isPast
        ? 'Nothing logged'
        : 'Nothing planned';

  return (
    <Sheet open={isOpen} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="mx-auto max-w-md">
        {day && (
          <>
            <p className={cn('text-body-sm', hasWorkouts ? 'text-accent-2' : 'text-ink-muted')}>
              {stateLabel}
            </p>
            <SheetTitle className="mt-1 text-display">
              {day.date.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Workout details for{' '}
              {day.date.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </SheetDescription>

            <div className="mt-5">
              {hasWorkouts ? (
                <WorkoutDayContent workouts={day.workouts} />
              ) : (
                <RestDayContent />
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function RestDayContent() {
  return (
    <div className="pb-2">
      <p className="text-title text-ink">Rest day</p>
      <p className="mt-2 max-w-[34ch] text-body text-ink-muted">
        Recovery is part of training. Muscles grow on the days off.
      </p>
    </div>
  );
}

interface WorkoutDayContentProps {
  workouts: WorkoutCalendarDay['workouts'];
}

function WorkoutDayContent({ workouts }: WorkoutDayContentProps) {
  const totalDuration = workouts.reduce((sum, w) => sum + w.duration, 0);
  const totalVolume = workouts.reduce((sum, w) => sum + w.totalVolume, 0);
  const totalSets = workouts.reduce((sum, w) => sum + w.totalSets, 0);
  const totalExercises = workouts.reduce((sum, w) => sum + w.exerciseCount, 0);

  const stats = [
    { value: formatDuration(totalDuration), label: 'duration' },
    { value: formatNumber(totalVolume), label: 'lb moved' },
    { value: String(totalSets), label: 'sets' },
    { value: String(totalExercises), label: 'exercises' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-4">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="sr-only">{s.label}</dt>
            <dd className="font-display font-tabular text-display text-ink">{s.value}</dd>
            <dd aria-hidden="true" className="text-body-sm text-ink-muted">{s.label}</dd>
          </div>
        ))}
      </dl>

      <section aria-label={workouts.length === 1 ? 'Workout' : 'Workouts'}>
        <h3 className="text-body-sm text-ink-muted">
          {workouts.length === 1 ? 'Workout' : `${workouts.length} workouts`}
        </h3>
        <ul className="mt-1 divide-y divide-hairline">
          {workouts.map((workout, index) => (
            <WorkoutRow key={`${workout.id}-${index}`} workout={workout} />
          ))}
        </ul>
      </section>
    </div>
  );
}

interface WorkoutRowProps {
  workout: WorkoutCalendarDay['workouts'][number];
}

function WorkoutRow({ workout }: WorkoutRowProps) {
  const meta = getMuscleGroupMeta(workout.name);
  const intensity = getWorkoutIntensity(
    workout.totalVolume,
    workout.duration,
    workout.totalSets,
  );

  const intensityLabel =
    intensity === 'high' ? 'High intensity' : intensity === 'medium' ? 'Moderate' : 'Light';

  return (
    <li className="flex items-center gap-3 py-3">
      <span aria-hidden="true" className={cn('h-2.5 w-2.5 shrink-0 rounded-full', meta.bgClass)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-semibold text-ink">{workout.name}</p>
        <p className="text-body-sm text-ink-muted">
          {intensityLabel}, {meta.label.toLowerCase()}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-num font-tabular text-body font-semibold text-ink">
          {workout.totalSets} sets
        </p>
        <p className="font-num font-tabular text-body-sm text-ink-muted">
          {formatDuration(workout.duration)}, {formatNumber(workout.totalVolume)} lb
        </p>
      </div>
    </li>
  );
}
