// WorkoutHeader — workout title, live duration readout (isolated leaf), an
// "End workout" action, and the overall + current-exercise progress bars.
// Extracted from WorkoutPage so the orchestrator stays thin. The live clock is
// delegated to <WorkoutDurationTimer> so the per-second tick does not re-render
// this header's progress math.
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WorkoutDurationTimer } from './WorkoutDurationTimer';

interface WorkoutHeaderProps {
  name: string;
  overallCompletedSets: number;
  overallTotalSets: number;
  overallPercentage: number;
  currentExerciseNumber: number; // 1-based
  totalExercises: number;
  currentExerciseCompletedSets: number;
  currentExerciseTotalSets: number;
  onEndWorkout: () => void;
}

export const WorkoutHeader: React.FC<WorkoutHeaderProps> = ({
  name,
  overallCompletedSets,
  overallTotalSets,
  overallPercentage,
  currentExerciseNumber,
  totalExercises,
  currentExerciseCompletedSets,
  currentExerciseTotalSets,
  onEndWorkout,
}) => {
  const exercisePercentage =
    currentExerciseTotalSets > 0
      ? (currentExerciseCompletedSets / currentExerciseTotalSets) * 100
      : 0;

  return (
    <Card elevation={1} className="mb-6 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body-sm text-ink-muted">
            Exercise{' '}
            <span className="font-num font-tabular text-ink">{currentExerciseNumber}</span>{' '}
            of{' '}
            <span className="font-num font-tabular text-ink">{totalExercises}</span>
          </p>
          <h1 className="mt-1 break-words font-display text-display text-ink">{name}</h1>
          <div className="mt-2">
            <WorkoutDurationTimer />
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onEndWorkout}>
          End workout
        </Button>
      </div>

      {/* Progress: ice fills as sets are done. */}
      <div className="mt-5 space-y-4">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-body-sm text-ink-muted">Workout</span>
            <span className="font-display font-tabular text-title text-ink">
              {overallPercentage}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Workout progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={overallPercentage}
            className="h-2 w-full overflow-hidden rounded-full bg-surface-raised"
          >
            <div
              className="h-full rounded-full bg-accent-2 transition-[width] duration-slow"
              style={{ width: `${overallPercentage}%` }}
            />
          </div>
          <p className="mt-1.5 text-caption text-ink-muted">
            <span className="font-num font-tabular text-ink">{overallCompletedSets}</span> of{' '}
            <span className="font-num font-tabular text-ink">{overallTotalSets}</span> sets done
          </p>
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-body-sm text-ink-muted">
            <span>This exercise</span>
            <span>
              <span className="font-num font-tabular text-ink">{currentExerciseCompletedSets}</span>{' '}
              of{' '}
              <span className="font-num font-tabular text-ink">{currentExerciseTotalSets}</span>{' '}
              sets
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Exercise progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(exercisePercentage)}
            className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised"
          >
            <div
              className="h-full rounded-full bg-accent-2 transition-[width] duration-smooth"
              style={{ width: `${exercisePercentage}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
};
