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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title font-bold text-ink">{name}</h1>
          <WorkoutDurationTimer />
        </div>
        <Button variant="danger" onClick={onEndWorkout}>
          End Workout
        </Button>
      </div>

      {/* Progress */}
      <div className="mt-4">
        {/* Overall workout progress */}
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-body-sm text-ink-subtle">
            <span>Overall Progress</span>
            <span>{overallPercentage}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-surface-subtle">
            <div
              className="h-3 rounded-full bg-accent transition-all duration-slow"
              style={{ width: `${overallPercentage}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-caption text-ink-subtle">
            <span>{overallCompletedSets} sets completed</span>
            <span>{overallTotalSets} total sets</span>
          </div>
        </div>

        {/* Current exercise progress */}
        <div className="mb-1 flex justify-between text-body-sm text-ink-subtle">
          <span>
            Exercise {currentExerciseNumber} of {totalExercises}
          </span>
          <span>
            {currentExerciseCompletedSets} / {currentExerciseTotalSets} sets
            completed
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
