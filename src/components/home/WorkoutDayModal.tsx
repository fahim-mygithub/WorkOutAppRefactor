import { Clock, Target, Zap, Play, BarChart3 } from 'lucide-react';
import type { WorkoutCalendarDay } from '../../utils/statsCalculator';
import { getWorkoutIntensity } from '../../utils/workoutColors';
import { getMuscleGroupMeta } from './muscleGroup';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '../ui/sheet';
import { Card, CardBody } from '../ui/card';
import { IconButton } from '../ui/icon-button';
import { Stack } from '../ui/stack';
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

export function WorkoutDayModal({ day, isOpen, onClose }: WorkoutDayModalProps) {
  const hasWorkouts = !!day && day.workouts.length > 0;
  const isToday = day?.isToday ?? false;
  const isPast = day?.isPast ?? false;

  const stateLabel = isToday
    ? 'Today'
    : isPast
      ? 'Past workout'
      : 'Future';

  return (
    <Sheet open={isOpen} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="mx-auto max-w-md">
        {day && (
          <>
            {/* Eyebrow + title */}
            <p className="text-caption font-mono uppercase tracking-wide text-ink-subtle">
              {stateLabel}
            </p>
            <SheetTitle className="text-display font-bold text-ink">
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

            <div className="mt-4">
              {!hasWorkouts ? (
                <RestDayContent />
              ) : (
                <WorkoutDayContent workouts={day.workouts} />
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
    <div className="py-8 text-center">
      <div className="mb-4 text-6xl">😴</div>
      <h3 className="mb-2 text-title font-semibold text-ink">Rest Day</h3>
      <p className="text-body-sm text-ink-muted">
        Recovery is just as important as training. Your muscles grow during rest!
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

  return (
    <Stack gap={6}>
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryStat icon={<Clock size={16} />} label="Duration" value={formatDuration(totalDuration)} />
        <SummaryStat icon={<Target size={16} />} label="Volume" value={`${formatNumber(totalVolume)} lbs`} />
        <SummaryStat icon={<Zap size={16} />} label="Sets" value={`${totalSets}`} />
        <SummaryStat icon={<BarChart3 size={16} />} label="Exercises" value={`${totalExercises}`} />
      </div>

      {/* Individual workouts */}
      <Stack gap={3}>
        <h4 className="text-body-sm font-medium text-ink-muted">
          {workouts.length === 1 ? 'Workout Details' : 'Workouts'}
        </h4>
        {workouts.map((workout, index) => (
          <WorkoutCard key={`${workout.id}-${index}`} workout={workout} />
        ))}
      </Stack>
    </Stack>
  );
}

interface SummaryStatProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function SummaryStat({ icon, label, value }: SummaryStatProps) {
  return (
    <Card elevation={0} className="bg-surface-subtle">
      <CardBody className="p-4 pt-4">
        <div className="mb-1 flex items-center gap-2 text-ink-muted">
          {icon}
          <span className="text-body-sm">{label}</span>
        </div>
        <div className="text-body font-semibold text-ink font-tabular">{value}</div>
      </CardBody>
    </Card>
  );
}

interface WorkoutCardProps {
  workout: WorkoutCalendarDay['workouts'][number];
}

function WorkoutCard({ workout }: WorkoutCardProps) {
  const meta = getMuscleGroupMeta(workout.name);
  const Icon = meta.icon;
  const intensity = getWorkoutIntensity(
    workout.totalVolume,
    workout.duration,
    workout.totalSets,
  );

  const intensityLabel =
    intensity === 'high'
      ? 'High Intensity'
      : intensity === 'medium'
        ? 'Moderate'
        : 'Light';

  return (
    <Card elevation={1}>
      <CardBody className="p-4 pt-4">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-md',
                meta.bgClass,
              )}
            >
              <Icon size={20} className="text-ink-inverse" aria-hidden="true" />
            </div>
            <div>
              <h5 className="text-body font-medium text-ink">{workout.name}</h5>
              <span className={cn('text-caption', meta.textClass)}>
                {intensityLabel}
              </span>
            </div>
          </div>

          <IconButton variant="ghost" size="sm" aria-label={`Start ${workout.name}`}>
            <Play size={16} />
          </IconButton>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="Duration" value={formatDuration(workout.duration)} />
          <MiniStat label="Volume" value={`${formatNumber(workout.totalVolume)} lbs`} />
          <MiniStat label="Sets" value={`${workout.totalSets}`} />
        </div>
      </CardBody>
    </Card>
  );
}

interface MiniStatProps {
  label: string;
  value: string;
}

function MiniStat({ label, value }: MiniStatProps) {
  return (
    <div>
      <div className="text-caption text-ink-subtle">{label}</div>
      <div className="text-body-sm font-medium text-ink font-tabular">{value}</div>
    </div>
  );
}
