// WorkoutHeader — workout title, live duration readout (isolated leaf), an
// "End Workout" action, and the overall + current-exercise progress bars.
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
    <Card elevation={1} className="mb-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Workout name in the marker hand, swiped with a hand-drawn underline */}
          <h1 className="text-display font-marker leading-none text-ink">
            <span className="marker-underline">{name}</span>
          </h1>
          <div className="mt-3">
            <WorkoutDurationTimer />
          </div>
        </div>
        <Button variant="danger" size="sm" onClick={onEndWorkout}>
          End
        </Button>
      </div>

      {/* Progress */}
      <div className="mt-5">
        {/* Overall workout progress */}
        <div className="mb-3">
          <div className="mb-1 flex items-end justify-between">
            <span className="font-marker text-body-sm uppercase tracking-wide text-ink-muted">
              Overall
            </span>
            <span className="font-num font-tabular text-title font-bold text-accent">
              {overallPercentage}%
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-surface-subtle sketch-border">
            <div
              className="h-3 rounded-full bg-accent transition-all duration-slow"
              style={{ width: `${overallPercentage}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-caption text-ink-subtle">
            <span>
              <span className="font-num font-tabular">{overallCompletedSets}</span>{' '}
              done
            </span>
            <span>
              <span className="font-num font-tabular">{overallTotalSets}</span>{' '}
              total sets
            </span>
          </div>
        </div>

        {/* Current exercise progress */}
        <div className="mb-1 flex justify-between text-body-sm text-ink-subtle">
          <span>
            Exercise{' '}
            <span className="font-num font-tabular text-ink">
              {currentExerciseNumber}
            </span>{' '}
            of{' '}
            <span className="font-num font-tabular text-ink">
              {totalExercises}
            </span>
          </span>
          <span>
            <span className="font-num font-tabular">
              {currentExerciseCompletedSets}
            </span>{' '}
            /{' '}
            <span className="font-num font-tabular">
              {currentExerciseTotalSets}
            </span>{' '}
            sets
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-surface-subtle">
          <div
            className="h-2 rounded-full bg-accent transition-all duration-smooth"
            style={{ width: `${exercisePercentage}%` }}
          />
        </div>
      </div>
    </Card>
  );
};
