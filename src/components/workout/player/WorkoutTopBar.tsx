// WorkoutTopBar — the slim header for the no-scroll player (Tempo). Session name
// + live time on one row, a Cards/List mode toggle, a quiet End pill, and one segment
// per exercise below (ice = done, amber = current) so position reads without any numbers.
import React from 'react';
import { Button } from '@/components/ui/button';
import { WorkoutDurationTimer } from '../WorkoutDurationTimer';
import { cn } from '@/lib/utils';

export type ExerciseSegmentState = 'done' | 'current' | 'todo';
export type WorkoutViewMode = 'cards' | 'list';

export interface WorkoutTopBarProps {
  name: string;
  overallCompletedSets: number;
  overallTotalSets: number;
  overallPercentage: number;
  currentExerciseNumber: number; // 1-based
  totalExercises: number;
  /** One entry per exercise, in order. Falls back to a single progress line. */
  segments?: ExerciseSegmentState[];
  onEndWorkout: () => void;
  viewMode?: WorkoutViewMode;
  onViewModeChange?: (mode: WorkoutViewMode) => void;
  onSelectExercise?: (exerciseIndex: number) => void;
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
  viewMode = 'cards',
  onViewModeChange,
  onSelectExercise,
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
        <div className="flex shrink-0 items-center gap-2">
          {onViewModeChange && (
            <div
              className="inline-flex items-center rounded-full bg-surface-raised p-0.5"
              role="group"
              aria-label="Workout view mode"
            >
              <button
                type="button"
                aria-pressed={viewMode === 'cards'}
                onClick={() => onViewModeChange('cards')}
                className={cn(
                  'rounded-full px-2.5 py-1 text-caption font-semibold transition-colors duration-snap',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  viewMode === 'cards'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                Cards
              </button>
              <button
                type="button"
                aria-pressed={viewMode === 'list'}
                onClick={() => onViewModeChange('list')}
                className={cn(
                  'rounded-full px-2.5 py-1 text-caption font-semibold transition-colors duration-snap',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  viewMode === 'list'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                List
              </button>
            </div>
          )}
          <Button variant="secondary" size="sm" onClick={onEndWorkout} className="shrink-0">
            End
          </Button>
        </div>
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
            {segments.map((state, i) =>
              onSelectExercise ? (
                <button
                  key={i}
                  type="button"
                  aria-label={`Jump to exercise ${i + 1}`}
                  onClick={() => onSelectExercise(i)}
                  className="group relative -my-1 flex h-3.5 flex-1 items-center py-1 rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                >
                  <span
                    className={cn(
                      'h-1.5 w-full rounded-full transition-colors duration-smooth',
                      state === 'done'
                        ? 'bg-accent-2'
                        : state === 'current'
                          ? 'bg-accent'
                          : 'bg-surface-raised',
                    )}
                  />
                </button>
              ) : (
                <span
                  key={i}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-colors duration-smooth',
                    state === 'done'
                      ? 'bg-accent-2'
                      : state === 'current'
                        ? 'bg-accent'
                        : 'bg-surface-raised',
                  )}
                />
              )
            )}
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
