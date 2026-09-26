// WorkoutTopBar — the slim header for the no-scroll player (Tempo). Session name
// + live time on one row, a quiet End pill, and one segment per exercise below
// (ice = done, amber = current) so position reads without any numbers.
import React from 'react';
import { Button } from '@/components/ui/button';
import { WorkoutDurationTimer } from '../WorkoutDurationTimer';
import { cn } from '@/lib/utils';

export type ExerciseSegmentState = 'done' | 'current' | 'todo';

interface WorkoutTopBarProps {
  name: string;
  overallCompletedSets: number;
  overallTotalSets: number;
  overallPercentage: number;
  currentExerciseNumber: number; // 1-based
  totalExercises: number;
  /** One entry per exercise, in order. Falls back to a single progress line. */
  segments?: ExerciseSegmentState[];
  onEndWorkout: () => void;
}

export const WorkoutTopBar: React.FC<WorkoutTopBarProps> = ({
  name,
  overallCompletedSets,
  overallTotalSets,
  overallPercentage,
  currentExerciseNumber,
  totalExercises,
  segments,
  onEndWorkout,
}) => {
  // Split "Push · Volume Dumbbell" into the day + a quieter variant.
  const [title, ...rest] = name.split(' · ');
  const variant = rest.join(' · ');

  return (
    <header className="shrink-0 px-4 pb-3 pt-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-body font-bold text-ink">{title}</h1>
          <p className="truncate text-body-sm text-ink-muted">
            {variant ? `${variant}, ` : ''}
            <span className="font-num font-tabular">
              <WorkoutDurationTimer />
            </span>
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onEndWorkout} className="shrink-0">
          End
        </Button>
      </div>

      <div
        className="mt-3"
        role="progressbar"
        aria-label={`Exercise ${currentExerciseNumber} of ${totalExercises}, ${overallCompletedSets} of ${overallTotalSets} sets done`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={overallPercentage}
      >
        {segments && segments.length > 0 && segments.length <= 16 ? (
          <div className="flex gap-1">
            {segments.map((state, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors duration-smooth',
                  state === 'done' ? 'bg-accent-2' : state === 'current' ? 'bg-accent' : 'bg-surface-raised',
                )}
              />
            ))}
          </div>
        ) : (
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
            <div
              className="h-full rounded-full bg-accent-2 transition-all duration-slow"
              style={{ width: `${overallPercentage}%` }}
            />
          </div>
        )}
      </div>
    </header>
  );
};
