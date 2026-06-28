// WorkoutTopBar — the slim header for the no-scroll player. Everything the old
// oversized header card showed (name, live time, End, overall progress, current
// exercise position) packed into two tight rows so it costs as little vertical
// space as possible.
import React from 'react';
import { Button } from '@/components/ui/button';
import { WorkoutDurationTimer } from '../WorkoutDurationTimer';

interface WorkoutTopBarProps {
  name: string;
  overallCompletedSets: number;
  overallTotalSets: number;
  overallPercentage: number;
  currentExerciseNumber: number; // 1-based
  totalExercises: number;
  onEndWorkout: () => void;
}

export const WorkoutTopBar: React.FC<WorkoutTopBarProps> = ({
  name,
  overallCompletedSets,
  overallTotalSets,
  overallPercentage,
  currentExerciseNumber,
  totalExercises,
  onEndWorkout,
}) => {
  // Split "Push · Volume Dumbbell" into a bold day + quieter variant.
  const [title, ...rest] = name.split(' · ');
  const variant = rest.join(' · ');

  return (
    <header className="shrink-0 border-b border-board-line/20 bg-surface-raised px-4 pb-2 pt-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-marker text-title leading-none text-ink">
            {title}
            {variant && (
              <span className="ml-1.5 text-body-sm font-normal text-ink-muted">
                {variant}
              </span>
            )}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <WorkoutDurationTimer />
          <Button variant="danger" size="sm" onClick={onEndWorkout}>
            End
          </Button>
        </div>
      </div>

      {/* One thin progress line: overall fill + position readouts. */}
      <div className="mt-2 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-subtle">
          <div
            className="h-full rounded-full bg-accent transition-all duration-slow"
            style={{ width: `${overallPercentage}%` }}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2 font-num font-tabular text-caption text-ink-subtle">
          <span className="font-bold text-accent">{overallPercentage}%</span>
          <span aria-hidden="true" className="text-ink-subtle/50">·</span>
          <span>
            Ex {currentExerciseNumber}/{totalExercises}
          </span>
          <span aria-hidden="true" className="text-ink-subtle/50">·</span>
          <span>
            {overallCompletedSets}/{overallTotalSets} sets
          </span>
        </div>
      </div>
    </header>
  );
};
