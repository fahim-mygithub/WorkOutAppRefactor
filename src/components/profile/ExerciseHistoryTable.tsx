import React, { useState, useEffect } from 'react';
import { ExerciseHistory, ExerciseStats } from '../../types/exerciseHistory';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { loadExerciseHistory, loadExerciseStats } from '../../store/slices/exerciseHistorySlice';
import { Trophy, Calendar, Weight, Repeat, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardBody } from '../ui/card';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface ExerciseHistoryTableProps {
  exerciseId?: string;
  exerciseName?: string;
  userId: string;
  limit?: number;
}

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
      <Card elevation={1} aria-busy="true">
        <CardBody className="p-6 space-y-4">
          <Skeleton className="h-6 w-1/3" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </CardBody>
      </Card>
    );
  }

  if (exerciseHistory.length === 0) {
    return (
      <Card elevation={1}>
        <CardBody className="p-6">
          <div className="text-center py-8">
            <BarChart3 className="h-12 w-12 text-ink-subtle mx-auto mb-4" />
            <h3 className="text-body font-medium text-ink mb-2">
              No Exercise History
            </h3>
            <p className="text-ink-muted">
              {exerciseName || 'This exercise'} hasn't been performed yet. Start a workout to build your history!
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card elevation={1}>
      {/* Header with Stats */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-body font-semibold text-ink">
            {exerciseName || 'Exercise History'}
          </h3>
          {stats && (
            <div className="flex items-center gap-4 text-body-sm text-ink-muted">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{stats.totalSessions} sessions</span>
              </div>
              <div className="flex items-center gap-1">
                <Weight className="h-4 w-4" />
                <span>Max: {formatWeight(stats.maxWeight)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Repeat className="h-4 w-4" />
                <span>{stats.totalSets} total sets</span>
              </div>
            </div>
          )}
        </div>

        {/* Configuration Filter */}
        {configurations.length > 1 && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-body-sm text-ink-muted shrink-0">Filter by:</span>
            <Select
              value={selectedConfiguration}
              onValueChange={(value) => setSelectedConfiguration(value)}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Configurations</SelectItem>
                {configurations.map(config => (
                  <SelectItem key={config} value={config}>{config}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-surface-subtle rounded-md">
            <div className="text-center">
              <div className="text-display font-bold text-ink">
                {formatWeight(stats.maxWeight)}
              </div>
              <div className="text-caption text-ink-muted">Max Weight</div>
            </div>
            <div className="text-center">
              <div className="text-display font-bold text-ink">
                {stats.maxReps}
              </div>
              <div className="text-caption text-ink-muted">Max Reps</div>
            </div>
            <div className="text-center">
              <div className="text-display font-bold text-ink">
                {stats.totalVolume.toLocaleString()}
              </div>
              <div className="text-caption text-ink-muted">Total Volume</div>
            </div>
            <div className="text-center">
              <div className="text-display font-bold text-ink">
                {formatDate(stats.lastPerformed)}
              </div>
              <div className="text-caption text-ink-muted">Last Performed</div>
            </div>
          </div>
        )}
      </div>

      {/* History Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-subtle">
            <tr>
              <th className="px-6 py-3 text-left text-caption font-medium text-ink-subtle uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-caption font-medium text-ink-subtle uppercase tracking-wider">
                Workout
              </th>
              <th className="px-6 py-3 text-left text-caption font-medium text-ink-subtle uppercase tracking-wider">
                Sets × Reps
              </th>
              <th className="px-6 py-3 text-left text-caption font-medium text-ink-subtle uppercase tracking-wider">
                Weight Range
              </th>
              <th className="px-6 py-3 text-left text-caption font-medium text-ink-subtle uppercase tracking-wider">
                Volume
              </th>
              <th className="px-6 py-3 text-left text-caption font-medium text-ink-subtle uppercase tracking-wider">
                PRs
              </th>
            </tr>
          </thead>
          <tbody className="bg-surface-raised divide-y divide-border">
            {filteredHistory.slice(0, isExpanded ? filteredHistory.length : limit).map((history) => {
              const weights = history.sets.map(s => s.weight);
              const minWeight = Math.min(...weights);
              const maxWeight = Math.max(...weights);
              const weightRange = minWeight === maxWeight
                ? formatWeight(minWeight, history.sets[0]?.unit)
                : `${formatWeight(minWeight, history.sets[0]?.unit)} - ${formatWeight(maxWeight, history.sets[0]?.unit)}`;

              return (
                <tr key={history.id} className="hover:bg-surface-subtle transition-colors duration-snap">
                  <td className="px-6 py-4 whitespace-nowrap text-body-sm text-ink">
                    {formatDate(history.workoutDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-body-sm text-ink-muted">
                    {history.workoutName || 'Quick Workout'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-body-sm font-medium text-ink">
                    {history.configuration}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-body-sm text-ink">
                    {weightRange}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-body-sm text-ink">
                    {history.totalVolume.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-body-sm">
                    <div className="flex gap-1">
                      {history.personalRecords?.maxWeight && (
                        <Trophy className="h-4 w-4 text-warning" aria-label="Weight PR" />
                      )}
                      {history.personalRecords?.maxReps && (
                        <Trophy className="h-4 w-4 text-accent" aria-label="Reps PR" />
                      )}
                      {history.personalRecords?.maxVolume && (
                        <Trophy className="h-4 w-4 text-success" aria-label="Volume PR" />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Expand/Collapse Button */}
      {filteredHistory.length > limit && (
        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full text-ink-muted"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show More ({filteredHistory.length - limit} more sessions)
              </>
            )}
          </Button>
        </div>
      )}

      {isLoadingHistory && (
        <div className="p-4 text-center text-body-sm text-ink-muted">
          Loading more history...
        </div>
      )}
    </Card>
  );
};