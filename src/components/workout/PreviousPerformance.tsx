import React from 'react';
import { WorkoutExercise, WorkoutSet } from '../../types/exercise';
import { ExerciseHistory, PerformedSet } from '../../types/exerciseHistory';
import { TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react';

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
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-300">
            Previous Performance
          </h3>
          <div className="animate-pulse bg-gray-600 h-4 w-16 rounded"></div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-600 h-8 w-full rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!previousPerformance) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-medium text-blue-200">
            First Time Performing This Exercise
          </h3>
        </div>
        <p className="text-xs text-blue-300">
          No previous performance data available. Time to set your baseline!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-300">
            Previous Performance
          </h3>
          {previousPerformance.personalRecords && (
            <div className="flex gap-1">
              {previousPerformance.personalRecords.maxWeight && (
                <Trophy className="h-3 w-3 text-yellow-500" aria-label="Weight PR" />
              )}
              {previousPerformance.personalRecords.maxReps && (
                <Trophy className="h-3 w-3 text-blue-500" aria-label="Reps PR" />
              )}
              {previousPerformance.personalRecords.maxVolume && (
                <Trophy className="h-3 w-3 text-green-500" aria-label="Volume PR" />
              )}
            </div>
          )}
        </div>
        <div className="text-xs text-gray-400">
          {new Date(previousPerformance.workoutDate).toLocaleDateString()}
        </div>
      </div>

      {matchingSets ? (
        // Show exact matching configuration
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-400 border-b border-gray-600 pb-1">
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
              <div key={currentSet.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-400 w-8">
                  {index + 1}
                </span>

                <div className="flex-1 text-center">
                  {previousSet ? (
                    <span className="text-gray-300">
                      {previousSet.actualReps} × {previousSet.weight}
                      {previousSet.unit === 'kg' ? 'kg' : 'lbs'}
                    </span>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </div>

                <div className="flex-1 text-center">
                  <span className="text-gray-300">
                    {currentSet.reps} × {currentWeight}
                    {currentSet.unit === 'kg' ? 'kg' : 'lbs'}
                  </span>
                </div>

                <div className="w-16 flex justify-center">
                  {previousSet && (
                    <>
                      {comparison === 'up' && (
                        <div className="flex items-center gap-1 text-green-400">
                          <TrendingUp className="h-3 w-3" />
                          <span className="text-xs">+{currentWeight - previousWeight}</span>
                        </div>
                      )}
                      {comparison === 'down' && (
                        <div className="flex items-center gap-1 text-red-400">
                          <TrendingDown className="h-3 w-3" />
                          <span className="text-xs">-{previousWeight - currentWeight}</span>
                        </div>
                      )}
                      {comparison === 'same' && (
                        <div className="flex items-center gap-1 text-gray-400">
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
          <div className="text-xs text-amber-400 mb-2">
            Configuration doesn't match. Last performed: {previousPerformance.configuration}
          </div>

          <div className="bg-gray-700 rounded p-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Sets × Reps:</span>
                <span className="ml-2 font-medium text-gray-200">
                  {previousPerformance.configuration}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Weight Range:</span>
                <span className="ml-2 font-medium text-gray-200">
                  {Math.min(...previousPerformance.sets.map(s => s.weight))} - {Math.max(...previousPerformance.sets.map(s => s.weight))}
                  {previousPerformance.sets[0]?.unit === 'kg' ? 'kg' : 'lbs'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Total Volume:</span>
                <span className="ml-2 font-medium text-gray-200">
                  {previousPerformance.totalVolume.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Workout:</span>
                <span className="ml-2 font-medium text-gray-200">
                  {previousPerformance.workoutName || 'Quick Workout'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {previousPerformance.notes && (
        <div className="mt-3 p-2 bg-gray-700 rounded text-xs">
          <span className="text-gray-400">Notes: </span>
          <span className="text-gray-300">{previousPerformance.notes}</span>
        </div>
      )}
    </div>
  );
};