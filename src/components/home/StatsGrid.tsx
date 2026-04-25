import { useMemo } from 'react';
import {
  Activity,
  Clock,
  Target,
  TrendingUp,
  Zap,
  Award,
  Calendar,
  Flame
} from 'lucide-react';
import type { WeeklyStats, MonthlyStats, LastWorkoutStats } from '../../hooks/useWorkoutStats';

interface StatsGridProps {
  weeklyStats: WeeklyStats;
  monthlyStats: MonthlyStats;
  lastWorkoutStats: LastWorkoutStats | null;
  isLoading: boolean;
}

export function StatsGrid({ weeklyStats, monthlyStats, lastWorkoutStats, isLoading }: StatsGridProps) {
  // Format numbers for display
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  // Format duration
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Calculate volume trend
  const volumeTrend = useMemo(() => {
    if (monthlyStats.volumeProgression.length < 2) return 0;

    const recentData = monthlyStats.volumeProgression.slice(-7); // Last 7 data points
    const olderData = monthlyStats.volumeProgression.slice(-14, -7); // Previous 7 data points

    if (recentData.length === 0 || olderData.length === 0) return 0;

    const recentAvg = recentData.reduce((sum, d) => sum + d.volume, 0) / recentData.length;
    const olderAvg = olderData.reduce((sum, d) => sum + d.volume, 0) / olderData.length;

    if (olderAvg === 0) return 0;
    return ((recentAvg - olderAvg) / olderAvg) * 100;
  }, [monthlyStats.volumeProgression]);

  if (isLoading) {
    return (
      <div className="space-y-6 mb-6">
        {/* Last Workout Stats Skeleton */}
        <div className="bg-card rounded-2xl p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-muted rounded mb-4 w-32"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-muted rounded w-16"></div>
                  <div className="h-8 bg-muted rounded w-20"></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Weekly/Monthly Stats Skeleton */}
        <div className="grid md:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl p-6">
              <div className="animate-pulse">
                <div className="h-6 bg-muted rounded mb-4 w-24"></div>
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="space-y-2">
                      <div className="h-4 bg-muted rounded w-16"></div>
                      <div className="h-6 bg-muted rounded w-12"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 mb-6">
      {/* Last Workout Stats */}
      {lastWorkoutStats && (
        <div className="bg-card rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="text-primary" size={20} />
            <h3 className="font-semibold">Last Workout</h3>
            <span className="text-sm text-muted-foreground">
              {new Date(lastWorkoutStats.date).toLocaleDateString()}
            </span>
          </div>

          <div className="mb-3">
            <h4 className="font-medium text-lg">{lastWorkoutStats.name}</h4>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatItem
              label="Duration"
              value={formatDuration(lastWorkoutStats.duration)}
              icon={<Clock size={16} />}
            />
            <StatItem
              label="Volume"
              value={`${formatNumber(lastWorkoutStats.totalVolume)} lbs`}
              icon={<Target size={16} />}
            />
            <StatItem
              label="Sets"
              value={lastWorkoutStats.totalSets.toString()}
              icon={<Zap size={16} />}
            />
            <StatItem
              label="PRs"
              value={lastWorkoutStats.personalRecords.toString()}
              icon={<Award size={16} />}
              highlight={lastWorkoutStats.personalRecords > 0}
            />
          </div>

          {lastWorkoutStats.averageRPE && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Average RPE</span>
                <div className="flex items-center gap-1">
                  <span className="font-medium">{lastWorkoutStats.averageRPE.toFixed(1)}</span>
                  <span className="text-muted-foreground">/10</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Weekly and Monthly Stats */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Weekly Stats */}
        <div className="bg-card rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="text-primary" size={20} />
            <h3 className="font-semibold">This Week</h3>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <StatItem
              label="Workouts"
              value={weeklyStats.workoutsCompleted.toString()}
              icon={<Activity size={16} />}
            />
            <StatItem
              label="Volume"
              value={`${formatNumber(weeklyStats.totalVolume)} lbs`}
              icon={<Target size={16} />}
            />
            <StatItem
              label="Time"
              value={formatDuration(weeklyStats.totalDuration)}
              icon={<Clock size={16} />}
            />
            <StatItem
              label="Streak"
              value={`${weeklyStats.streak} days`}
              icon={<Flame size={16} />}
              highlight={weeklyStats.streak >= 3}
            />
          </div>

          {/* Most Trained Muscles */}
          {weeklyStats.mostTrainedMuscles.length > 0 && (
            <div className="pt-4 border-t border-border">
              <div className="text-sm text-muted-foreground mb-2">Most Trained</div>
              <div className="flex flex-wrap gap-1">
                {weeklyStats.mostTrainedMuscles.map((muscle, index) => (
                  <span
                    key={muscle}
                    className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
                  >
                    {muscle}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Consistency Score */}
          <div className="pt-4 border-t border-border mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Consistency</span>
              <span className="font-medium">{Math.round(weeklyStats.consistencyScore)}%</span>
            </div>
            <div className="bg-muted rounded-full h-2">
              <div
                className="bg-primary rounded-full h-2 transition-all duration-300"
                style={{ width: `${weeklyStats.consistencyScore}%` }}
              />
            </div>
          </div>
        </div>

        {/* Monthly Stats */}
        <div className="bg-card rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="text-primary" size={20} />
            <h3 className="font-semibold">This Month</h3>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <StatItem
              label="Workouts"
              value={monthlyStats.workoutsCompleted.toString()}
              icon={<Activity size={16} />}
            />
            <StatItem
              label="Time"
              value={formatDuration(monthlyStats.totalTrainingTime)}
              icon={<Clock size={16} />}
            />
            <StatItem
              label="New Exercises"
              value={monthlyStats.newExercisesTried.toString()}
              icon={<Zap size={16} />}
              highlight={monthlyStats.newExercisesTried > 5}
            />
            <StatItem
              label="PRs"
              value={monthlyStats.personalRecords.toString()}
              icon={<Award size={16} />}
              highlight={monthlyStats.personalRecords > 0}
            />
          </div>

          {/* Volume Trend */}
          {volumeTrend !== 0 && (
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Volume Trend</span>
                <div className={`flex items-center gap-1 ${
                  volumeTrend > 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  <TrendingUp size={14} className={volumeTrend < 0 ? 'rotate-180' : ''} />
                  <span className="font-medium">{Math.abs(volumeTrend).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Consistency Score */}
          <div className="pt-4 border-t border-border mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Consistency</span>
              <span className="font-medium">{Math.round(monthlyStats.consistencyScore)}%</span>
            </div>
            <div className="bg-muted rounded-full h-2">
              <div
                className="bg-primary rounded-full h-2 transition-all duration-300"
                style={{ width: `${monthlyStats.consistencyScore}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatItemProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: boolean;
}

function StatItem({ label, value, icon, highlight = false }: StatItemProps) {
  return (
    <div className={`space-y-1 ${highlight ? 'text-primary' : ''}`}>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`font-semibold text-lg ${highlight ? 'text-primary' : ''}`}>
        {value}
      </div>
    </div>
  );
}