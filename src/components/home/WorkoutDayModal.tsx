import type { MouseEvent } from 'react';
import { Pencil, Play } from 'lucide-react';
import type { WorkoutCalendarDay } from '../../utils/statsCalculator';
import { getWorkoutIntensity } from '../../utils/workoutColors';
import { getMuscleGroupMeta } from './muscleGroup';
import { usePlannedSchedule } from '../../hooks/usePlannedSchedule';
import { useStartPlannedWorkout } from '../../hooks/useStartPlannedWorkout';
import { useAppSelector } from '../../store/hooks';
import { selectPlansByDateKey, type PlannedWorkout } from '../../store/slices/plannedWorkoutsSlice';
import { toDateKey } from '../../lib/dateKey';
import { effectiveEmphasis } from '../../types/exercise';
import { PlannedDayCard } from './PlannedDayCard';
import { EmphasisChip } from '../plan/EmphasisChip';
import { useEditPlannedWorkout } from '../plan/useEditPlannedWorkout';
import { Button } from '../ui/button';
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
 * labels, then one hairline row per workout. Custom planned workouts from
 * `plannedWorkoutsSlice` show here with Start + Edit (opening the Builder);
 * Charlie-Split template days hand off to `PlannedDayCard`.
 */
export function WorkoutDayModal({ day, isOpen, onClose }: WorkoutDayModalProps) {
  const { plannedByDate } = usePlannedSchedule();
  const startPlannedWorkout = useStartPlannedWorkout();
  const plannedWorkoutsState = useAppSelector((s) => s.plannedWorkouts);
  const { requestEditPlan, handlePlanCardClick, replaceDraftDialog } = useEditPlannedWorkout();

  const hasWorkouts = !!day && day.workouts.length > 0;
  const isToday = day?.isToday ?? false;
  const isPast = day?.isPast ?? false;

  const dayPlans: PlannedWorkout[] =
    day && plannedWorkoutsState
      ? selectPlansByDateKey({ plannedWorkouts: plannedWorkoutsState }, toDateKey(day.date)).filter(
          (p) => p.status === 'planned',
        )
      : [];
  const hasCustomPlans = dayPlans.length > 0;

  // Read the LIVE planned day (so a re-roll updates the preview in place).
  const planned = day?.planned ? plannedByDate.get(day.planned.dateKey) ?? day.planned : null;
  const showPlanned = !hasWorkouts && !hasCustomPlans && planned != null && planned.status === 'planned';

  // Charlie-Split template days get a bespoke centered card; custom plans & logged/rest keep the bottom sheet.
  if (day && showPlanned && planned) {
    return <PlannedDayCard day={day} planned={planned} isOpen={isOpen} onClose={onClose} />;
  }

  const stateLabel = hasWorkouts
    ? isToday
      ? 'Done today'
      : 'Logged'
    : hasCustomPlans
      ? isToday
        ? 'Planned for today'
        : 'Planned'
      : isToday
        ? 'Today'
        : isPast
          ? 'Nothing logged'
          : 'Nothing planned';

  return (
    <>
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

              <div className="mt-5 flex flex-col gap-6">
                {hasWorkouts && <WorkoutDayContent workouts={day.workouts} />}
                {hasCustomPlans && (
                  <PlannedWorkoutsForDay
                    plans={dayPlans}
                    onStart={(plan) => {
                      startPlannedWorkout(plan);
                      onClose();
                    }}
                    onEdit={(plan) => requestEditPlan(plan, { onProceed: onClose })}
                    onCardClick={(e, plan) => handlePlanCardClick(e, plan, { onProceed: onClose })}
                  />
                )}
                {!hasWorkouts && !hasCustomPlans && <RestDayContent />}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      {replaceDraftDialog}
    </>
  );
}

function PlannedWorkoutsForDay({
  plans,
  onStart,
  onEdit,
  onCardClick,
}: {
  plans: PlannedWorkout[];
  onStart: (plan: PlannedWorkout) => void;
  onEdit: (plan: PlannedWorkout) => void;
  onCardClick: (e: MouseEvent, plan: PlannedWorkout) => void;
}) {
  return (
    <section aria-label={plans.length === 1 ? 'Planned workout' : 'Planned workouts'} className="space-y-3">
      <div className="flex flex-col gap-3">
        {plans.map((plan) => {
          const flagged = plan.exercises.filter((ex) => effectiveEmphasis(ex));
          return (
            <div
              key={plan.id}
              onClick={(e) => onCardClick(e, plan)}
              className="cursor-pointer rounded-2xl border border-hairline bg-surface p-4"
            >
              <h3 className="break-words text-title font-semibold text-ink">{plan.name}</h3>
              <p className="mt-0.5 text-body-sm text-ink-muted">
                {plan.exercises.length} exercise{plan.exercises.length === 1 ? '' : 's'}
              </p>
              {flagged.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {flagged.map((ex) => (
                    <span
                      key={ex.id}
                      className="inline-flex max-w-full items-center gap-1 text-caption text-ink-muted"
                    >
                      <span className="truncate">{ex.customTitle || ex.exercise.name}</span>
                      <EmphasisChip emphasis={effectiveEmphasis(ex)} />
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button variant="primary" size="md" onClick={() => onStart(plan)}>
                  <Play className="h-4 w-4" fill="currentColor" aria-hidden="true" />
                  Start
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => onEdit(plan)}
                  aria-label={`Edit ${plan.name}`}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Edit
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
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
