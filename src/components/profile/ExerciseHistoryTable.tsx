import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { loadExerciseHistory, loadExerciseStats } from '../../store/slices/exerciseHistorySlice';
import { Trophy } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { cn } from '../../lib/utils';

interface ExerciseHistoryTableProps {
  exerciseId?: string;
  exerciseName?: string;
  userId: string;
  limit?: number;
}

/**
 * One exercise's history (Tempo): three headline numbers, an optional
 * configuration filter, then sessions as hairline rows with the volume in the
 * number voice. Shows `limit` rows until expanded.
 */
export const ExerciseHistoryTable: React.FC<ExerciseHistoryTableProps> = ({
  exerciseId,
  exerciseName,
  userId,
  limit = 10
}) => {
  const dispatch = useAppDispatch();
  const { currentExerciseHistory, exerciseStats, isLoadingHistory, isLoadingStats } = useAppSelector(
    (state) => state.exerciseHistory
  );

  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedConfiguration, setSelectedConfiguration] = useState<string>('all');

  const exerciseHistory = exerciseId ? currentExerciseHistory[exerciseId] || [] : [];
  const stats = exerciseId ? exerciseStats[exerciseId] : null;

  useEffect(() => {
    if ((exerciseId || exerciseName) && userId) {
      const filter = {
        ...(exerciseId && { exerciseId }),
        ...(exerciseName && { exerciseName }),
        limit: isExpanded ? 50 : limit
      };

      dispatch(loadExerciseHistory({ userId, filter }));

      if (exerciseId) {
        dispatch(loadExerciseStats({ userId, exerciseId }));
      }
    }
  }, [dispatch, exerciseId, exerciseName, userId, limit, isExpanded]);

  // Get unique configurations from history
  const configurations = [...new Set(exerciseHistory.map(h => h.configuration))];

  // Filter history by selected configuration
  const filteredHistory = selectedConfiguration === 'all'
    ? exerciseHistory
    : exerciseHistory.filter(h => h.configuration === selectedConfiguration);

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(date));
  };

  const formatWeight = (weight: number, unit: string = 'lbs'): string => {
    return `${weight}${unit === 'kg' ? 'kg' : 'lbs'}`;
  };

  if (isLoadingHistory && exerciseHistory.length === 0) {
    return (
      <section aria-busy="true" className="flex flex-col gap-2">
        <Skeleton className="h-6 w-1/3" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-2xl" />
        ))}
      </section>
    );
  }

  if (exerciseHistory.length === 0) {
    return (
      <div className="rounded-[20px] bg-surface-subtle px-5 py-6">
        <p className="text-body font-semibold text-ink">No history yet</p>
        <p className="mt-1 text-body-sm text-ink-muted">
          {exerciseName || 'This exercise'} hasn’t been logged yet. Finish a workout with it to start its history.
        </p>
      </div>
    );
  }

  const visibleHistory = filteredHistory.slice(0, isExpanded ? filteredHistory.length : limit);

  return (
    <section aria-label={exerciseName || 'Exercise history'}>
      <h3 className="font-wide text-title font-bold text-ink">{exerciseName || 'Exercise history'}</h3>
      {stats && (
        <p className="mt-0.5 text-body-sm text-ink-muted">
          {stats.totalSessions} sessions · {stats.totalSets} sets · last {formatDate(stats.lastPerformed)}
        </p>
      )}

      {stats && (
        <dl className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Heaviest', value: stats.maxWeight, unit: 'lbs' },
            { label: 'Most reps', value: stats.maxReps },
            { label: 'Volume', value: stats.totalVolume.toLocaleString() },
          ].map((s) => (
            <div key={s.label} className="flex min-w-0 flex-col-reverse">
              <dt className="mt-1.5 text-caption text-ink-muted">{s.label}</dt>
              <dd className="truncate font-display font-tabular text-title leading-none text-ink">
                {s.value}
                {s.unit && (
                  <span className="ml-1 font-sans text-body-sm font-semibold tracking-normal text-ink-muted [font-stretch:100%]">
                    {s.unit}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {configurations.length > 1 && (
        <div className="mt-4">
          <Select value={selectedConfiguration} onValueChange={(value) => setSelectedConfiguration(value)}>
            <SelectTrigger aria-label="Filter by configuration" className="rounded-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All configurations</SelectItem>
              {configurations.map(config => (
                <SelectItem key={config} value={config}>{config}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <ul className="mt-4 overflow-hidden rounded-[20px] bg-surface-subtle">
        {visibleHistory.map((history, i) => {
          const weights = history.sets.map(s => s.weight);
          const minWeight = Math.min(...weights);
          const maxWeight = Math.max(...weights);
          const weightRange = minWeight === maxWeight
            ? formatWeight(minWeight, history.sets[0]?.unit)
            : `${formatWeight(minWeight, history.sets[0]?.unit)} to ${formatWeight(maxWeight, history.sets[0]?.unit)}`;
          const prs = [
            history.personalRecords?.maxWeight && 'weight',
            history.personalRecords?.maxReps && 'reps',
            history.personalRecords?.maxVolume && 'volume',
          ].filter(Boolean);

          return (
            <li key={history.id} className={cn('flex items-center gap-4 px-4 py-3', i > 0 && 'border-t border-hairline')}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-sm font-semibold text-ink">
                  {formatDate(history.workoutDate)} · {history.configuration}
                </span>
                <span className="block truncate text-caption text-ink-muted">
                  {history.workoutName || 'Quick workout'} · {weightRange}
                </span>
                {prs.length > 0 && (
                  <span className="mt-0.5 flex items-center gap-1 text-caption font-semibold text-success">
                    <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                    PR: {prs.join(', ')}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-num font-tabular text-body font-semibold text-ink">
                  {history.totalVolume.toLocaleString()}
                </span>
                <span className="block text-caption text-ink-muted">volume</span>
              </span>
            </li>
          );
        })}
      </ul>

      {filteredHistory.length > limit && (
        <Button variant="ghost" onClick={() => setIsExpanded(!isExpanded)} className="mt-2 w-full">
          {isExpanded ? 'Show less' : `Show ${filteredHistory.length - limit} more`}
        </Button>
      )}

      {isLoadingHistory && (
        <p className="mt-2 text-center text-body-sm text-ink-muted" aria-live="polite">
          Loading more history…
        </p>
      )}
    </section>
  );
};
