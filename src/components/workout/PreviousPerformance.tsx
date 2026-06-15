import React from 'react';
import { WorkoutExercise, WorkoutSet } from '../../types/exercise';
import { ExerciseHistory, PerformedSet } from '../../types/exerciseHistory';
import { TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface PreviousPerformanceProps {
  currentExercise: WorkoutExercise;
  previousPerformance: ExerciseHistory | null;
  isLoading?: boolean;
}

// Helper function to generate configuration string
const generateConfigurationString = (sets: WorkoutSet[]): string => {
  if (sets.length === 0) return '';

  const repGroups = sets.reduce((groups, set) => {
    const reps = set.reps;
    if (!groups[reps]) groups[reps] = 0;
    groups[reps]++;
    return groups;
  }, {} as Record<number, number>);

  if (Object.keys(repGroups).length === 1) {
    const reps = Object.keys(repGroups)[0];
    return `${sets.length}x${reps}`;
  } else {
    const ranges = Object.entries(repGroups)
      .map(([reps, count]) => `${count}x${reps}`)
      .join(', ');
    return ranges;
  }
};

// Helper function to match previous performance by configuration
const findMatchingConfiguration = (
  previousPerformance: ExerciseHistory,
  currentConfiguration: string
): PerformedSet[] | null => {
  if (previousPerformance.configuration === currentConfiguration) {
    return previousPerformance.sets;
  }
  return null;
};

// Helper function to get comparison indicator
const getWeightComparison = (current: number, previous: number): 'up' | 'down' | 'same' => {
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'same';
};

export const PreviousPerformance: React.FC<PreviousPerformanceProps> = ({
  currentExercise,
  previousPerformance,
  isLoading = false
}) => {
  const currentConfiguration = generateConfigurationString(currentExercise.sets);
  const matchingSets = previousPerformance
    ? findMatchingConfiguration(previousPerformance, currentConfiguration)
    : null;

  if (isLoading) {
    return (
      <Card className="p-4 mb-4" aria-busy="true">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-body-sm font-medium text-ink-muted">
            Previous Performance
          </h3>
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (!previousPerformance) {
    return (
      <Card className="p-4 mb-4 border border-accent/30 bg-accent/10">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-accent" />
          <h3 className="text-body-sm font-medium text-ink">
            First Time Performing This Exercise
          </h3>
        </div>
        <p className="text-caption text-ink-muted">
          No previous performance data available. Time to set your baseline!
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4 mb-4 border border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-body-sm font-medium text-ink-muted">
            Previous Performance
          </h3>
          {previousPerformance.personalRecords && (
            <div className="flex gap-1">
              {previousPerformance.personalRecords.maxWeight && (
                <Trophy className="h-3 w-3 text-warning" aria-label="Weight PR" />
              )}
              {previousPerformance.personalRecords.maxReps && (
                <Trophy className="h-3 w-3 text-accent" aria-label="Reps PR" />
              )}
              {previousPerformance.personalRecords.maxVolume && (
                <Trophy className="h-3 w-3 text-success" aria-label="Volume PR" />
              )}
            </div>
          )}
        </div>
        <div className="text-caption text-ink-subtle">
          {new Date(previousPerformance.workoutDate).toLocaleDateString()}
        </div>
      </div>

      {matchingSets ? (
        // Show exact matching configuration
        <div className="space-y-2">
          <div className="flex items-center justify-between text-caption text-ink-subtle border-b border-border pb-1">
            <span>Set</span>
            <span>Previous</span>
            <span>Current</span>
            <span>Comparison</span>
          </div>

          {currentExercise.sets.map((currentSet, index) => {
            const previousSet = matchingSets[index];
            const currentWeight = currentSet.weight || 0;
            const previousWeight = previousSet?.weight || 0;
            const comparison = previousSet ? getWeightComparison(currentWeight, previousWeight) : 'same';

            return (
              <div key={currentSet.id} className="flex items-center justify-between text-body-sm">
                <span className="text-ink-subtle w-8">
                  {index + 1}
                </span>

                <div className="flex-1 text-center">
                  {previousSet ? (
                    <span className="text-ink-muted font-tabular">
                      {previousSet.actualReps} × {previousSet.weight}
                      {previousSet.unit === 'kg' ? 'kg' : 'lbs'}
                    </span>
                  ) : (
                    <span className="text-ink-subtle">-</span>
                  )}
                </div>

                <div className="flex-1 text-center">
                  <span className="text-ink-muted font-tabular">
                    {currentSet.reps} × {currentWeight}
                    {currentSet.unit === 'kg' ? 'kg' : 'lbs'}
                  </span>
                </div>

                <div className="w-16 flex justify-center">
                  {previousSet && (
                    <>
                      {comparison === 'up' && (
                        <div className="flex items-center gap-1 text-success">
                          <TrendingUp className="h-3 w-3" />
                          <span className="text-caption">+{currentWeight - previousWeight}</span>
                        </div>
                      )}
                      {comparison === 'down' && (
                        <div className="flex items-center gap-1 text-danger">
                          <TrendingDown className="h-3 w-3" />
                          <span className="text-caption">-{previousWeight - currentWeight}</span>
                        </div>
                      )}
                      {comparison === 'same' && (
                        <div className="flex items-center gap-1 text-ink-subtle">
                          <Minus className="h-3 w-3" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Show general previous performance when configuration doesn't match
        <div className="space-y-2">
          <div className="text-caption text-warning mb-2">
            Configuration doesn't match. Last performed: {previousPerformance.configuration}
          </div>

          <div className="bg-surface-subtle rounded-md p-3">
            <div className="grid grid-cols-2 gap-4 text-body-sm">
              <div>
                <span className="text-ink-subtle">Sets × Reps:</span>
                <span className="ml-2 font-medium text-ink">
                  {previousPerformance.configuration}
                </span>
              </div>
              <div>
                <span className="text-ink-subtle">Weight Range:</span>
                <span className="ml-2 font-medium text-ink font-tabular">
                  {Math.min(...previousPerformance.sets.map(s => s.weight))} - {Math.max(...previousPerformance.sets.map(s => s.weight))}
                  {previousPerformance.sets[0]?.unit === 'kg' ? 'kg' : 'lbs'}
                </span>
              </div>
              <div>
                <span className="text-ink-subtle">Total Volume:</span>
                <span className="ml-2 font-medium text-ink font-tabular">
                  {previousPerformance.totalVolume.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-ink-subtle">Workout:</span>
                <span className="ml-2 font-medium text-ink">
                  {previousPerformance.workoutName || 'Quick Workout'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {previousPerformance.notes && (
        <div className="mt-3 p-2 bg-surface-subtle rounded-md text-caption">
          <span className="text-ink-subtle">Notes: </span>
          <span className="text-ink-muted">{previousPerformance.notes}</span>
        </div>
      )}
    </Card>
  );
};
