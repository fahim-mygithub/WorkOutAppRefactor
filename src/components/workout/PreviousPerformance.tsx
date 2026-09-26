import React from 'react';
import { WorkoutExercise, WorkoutSet } from '../../types/exercise';
import { ExerciseHistory, PerformedSet } from '../../types/exerciseHistory';
import { TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react';
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
      <section aria-label="Last time" aria-busy="true" className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-body-sm font-semibold text-ink-muted">Last time</h3>
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </section>
    );
  }

  if (!previousPerformance) {
    return (
      <section aria-label="Last time" className="mb-4 flex items-start gap-2">
        <TrendingUp aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent-2" />
        <div>
          <h3 className="text-body-sm font-semibold text-ink">First time doing this exercise</h3>
          <p className="text-caption text-ink-muted">
            No history yet. Today sets your baseline.
          </p>
        </div>
      </section>
    );
  }

  const unitOf = (u?: string) => (u === 'kg' ? 'kg' : 'lb');

  return (
    <section aria-label="Last time" className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-body-sm font-semibold text-ink-muted">Last time</h3>
          {previousPerformance.personalRecords && (
            <div className="flex gap-1 text-success">
              {previousPerformance.personalRecords.maxWeight && (
                <Trophy className="h-3 w-3" aria-label="Weight PR" />
              )}
              {previousPerformance.personalRecords.maxReps && (
                <Trophy className="h-3 w-3" aria-label="Reps PR" />
              )}
              {previousPerformance.personalRecords.maxVolume && (
                <Trophy className="h-3 w-3" aria-label="Volume PR" />
              )}
            </div>
          )}
        </div>
        <p className="font-num font-tabular text-caption text-ink-subtle">
          {new Date(previousPerformance.workoutDate).toLocaleDateString()}
        </p>
      </div>

      {matchingSets ? (
        // Exact matching configuration: one row per set, last time vs. today.
        <div>
          <div
            aria-hidden="true"
            className="grid grid-cols-[2rem_1fr_1fr_3.5rem] gap-2 pb-1 text-caption text-ink-subtle"
          >
            <span>Set</span>
            <span>Last time</span>
            <span>Today</span>
            <span className="text-right">Change</span>
          </div>

          <ul className="divide-y divide-hairline">
            {currentExercise.sets.map((currentSet, index) => {
              const previousSet = matchingSets[index];
              const currentWeight = currentSet.weight || 0;
              const previousWeight = previousSet?.weight || 0;
              const comparison = previousSet ? getWeightComparison(currentWeight, previousWeight) : 'same';

              return (
                <li
                  key={currentSet.id}
                  className="grid min-h-10 grid-cols-[2rem_1fr_1fr_3.5rem] items-center gap-2 font-num font-tabular text-body-sm"
                >
                  <span className="text-ink-subtle">{index + 1}</span>
                  <span className="text-ink-muted">
                    {previousSet ? (
                      <>
                        {previousSet.actualReps} × {previousSet.weight} {unitOf(previousSet.unit)}
                      </>
                    ) : (
                      <span className="text-ink-subtle">–</span>
                    )}
                  </span>
                  <span className="text-ink">
                    {currentSet.reps} × {currentWeight} {unitOf(currentSet.unit)}
                  </span>
                  <span className="flex justify-end">
                    {previousSet && (
                      <>
                        {comparison === 'up' && (
                          <span className="flex items-center gap-1 text-accent-2">
                            <TrendingUp className="h-3 w-3" aria-hidden="true" />
                            <span className="text-caption">+{currentWeight - previousWeight}</span>
                          </span>
                        )}
                        {comparison === 'down' && (
                          <span className="flex items-center gap-1 text-ink-muted">
                            <TrendingDown className="h-3 w-3" aria-hidden="true" />
                            <span className="text-caption">-{previousWeight - currentWeight}</span>
                          </span>
                        )}
                        {comparison === 'same' && (
                          <Minus className="h-3 w-3 text-ink-subtle" aria-label="Same weight" />
                        )}
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        // Configuration differs: summarize last time instead of comparing rows.
        <div>
          <p className="mb-3 text-caption text-ink-muted">
            Different setup last time ({previousPerformance.configuration}).
          </p>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="flex flex-col-reverse">
              <dt className="text-caption text-ink-muted">Sets × reps</dt>
              <dd className="font-display font-tabular text-title text-ink">
                {previousPerformance.configuration}
              </dd>
            </div>
            <div className="flex flex-col-reverse">
              <dt className="text-caption text-ink-muted">Weight range</dt>
              <dd className="font-display font-tabular text-title text-ink">
                {Math.min(...previousPerformance.sets.map(s => s.weight))}–{Math.max(...previousPerformance.sets.map(s => s.weight))}
                <span className="ml-1 text-body-sm font-semibold text-ink-muted">
                  {unitOf(previousPerformance.sets[0]?.unit)}
                </span>
              </dd>
            </div>
            <div className="flex flex-col-reverse">
              <dt className="text-caption text-ink-muted">Total volume</dt>
              <dd className="font-display font-tabular text-title text-ink">
                {previousPerformance.totalVolume.toLocaleString()}
              </dd>
            </div>
            <div className="flex flex-col-reverse">
              <dt className="text-caption text-ink-muted">Workout</dt>
              <dd className="truncate text-body font-semibold text-ink">
                {previousPerformance.workoutName || 'Quick workout'}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {previousPerformance.notes && (
        <p className="mt-3 text-caption text-ink-muted">
          <span className="text-ink-subtle">Notes: </span>
          {previousPerformance.notes}
        </p>
      )}
    </section>
  );
};
