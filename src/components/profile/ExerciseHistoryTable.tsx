import React, { useState, useEffect } from 'react';
import { ExerciseHistory, ExerciseStats } from '../../types/exerciseHistory';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { loadExerciseHistory, loadExerciseStats } from '../../store/slices/exerciseHistorySlice';
import { Trophy, TrendingUp, Calendar, Weight, Repeat, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';

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
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-1/3"></div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-300 dark:bg-gray-600 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (exerciseHistory.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="text-center py-8">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No Exercise History
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {exerciseName || 'This exercise'} hasn't been performed yet. Start a workout to build your history!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header with Stats */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {exerciseName || 'Exercise History'}
          </h3>
          {stats && (
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
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
            <span className="text-sm text-gray-600 dark:text-gray-400">Filter by:</span>
            <select
              value={selectedConfiguration}
              onChange={(e) => setSelectedConfiguration(e.target.value)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Configurations</option>
              {configurations.map(config => (
                <option key={config} value={config}>{config}</option>
              ))}
            </select>
          </div>
        )}

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatWeight(stats.maxWeight)}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Max Weight</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.maxReps}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Max Reps</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.totalVolume.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Total Volume</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatDate(stats.lastPerformed)}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Last Performed</div>
            </div>
          </div>
        )}
      </div>

      {/* History Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Workout
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Sets × Reps
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Weight Range
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Volume
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                PRs
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredHistory.slice(0, isExpanded ? filteredHistory.length : limit).map((history) => {
              const weights = history.sets.map(s => s.weight);
              const minWeight = Math.min(...weights);
              const maxWeight = Math.max(...weights);
              const weightRange = minWeight === maxWeight
                ? formatWeight(minWeight, history.sets[0]?.unit)
                : `${formatWeight(minWeight, history.sets[0]?.unit)} - ${formatWeight(maxWeight, history.sets[0]?.unit)}`;

              return (
                <tr key={history.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {formatDate(history.workoutDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {history.workoutName || 'Quick Workout'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {history.configuration}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {weightRange}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {history.totalVolume.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-1">
                      {history.personalRecords?.maxWeight && (
                        <Trophy className="h-4 w-4 text-yellow-500" aria-label="Weight PR" />
                      )}
                      {history.personalRecords?.maxReps && (
                        <Trophy className="h-4 w-4 text-blue-500" aria-label="Reps PR" />
                      )}
                      {history.personalRecords?.maxVolume && (
                        <Trophy className="h-4 w-4 text-green-500" aria-label="Volume PR" />
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
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
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
          </button>
        </div>
      )}

      {isLoadingHistory && (
        <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Loading more history...
        </div>
      )}
    </div>
  );
};