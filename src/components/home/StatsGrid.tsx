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
import { Card, CardBody, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Stack } from '../ui/stack';
import { cn } from '../../lib/utils';

interface StatsGridProps {
  weeklyStats: WeeklyStats;
  monthlyStats: MonthlyStats;
  lastWorkoutStats: LastWorkoutStats | null;
  isLoading: boolean;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

export function StatsGrid({ weeklyStats, monthlyStats, lastWorkoutStats, isLoading }: StatsGridProps) {
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
      <Stack gap={6} className="mb-6" aria-busy="true">
        {/* Last Workout Stats Skeleton */}
        <Card>
          <CardBody className="p-6 pt-6">
            <Skeleton className="mb-4 h-6 w-32" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Stack key={i} gap={2}>
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-8 w-20" />
                </Stack>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Weekly/Monthly Stats Skeleton */}
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardBody className="p-6 pt-6">
                <Skeleton className="mb-4 h-6 w-24" />
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <Stack key={j} gap={2}>
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-6 w-12" />
                    </Stack>
                  ))}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </Stack>
    );
  }

  return (
    <Stack gap={6} className="mb-6">
      {/* Last Workout Stats */}
      {lastWorkoutStats && (
        <Card>
          <CardHeader>
            <Stack direction="row" gap={2} align="center">
              <Activity className="text-accent" size={20} />
              <CardTitle className="text-title">Last Workout</CardTitle>
              <span className="text-body-sm text-ink-subtle">
                {new Date(lastWorkoutStats.date).toLocaleDateString()}
              </span>
            </Stack>
          </CardHeader>
          <CardBody>
            <h4 className="mb-3 text-body font-medium text-ink">{lastWorkoutStats.name}</h4>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
              <div className="mt-4 border-t border-ink/10 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-body-sm text-ink-muted">Average RPE</span>
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-ink font-tabular">{lastWorkoutStats.averageRPE.toFixed(1)}</span>
                    <span className="text-ink-subtle">/10</span>
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Weekly and Monthly Stats */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Weekly Stats */}
        <Card>
          <CardHeader>
            <Stack direction="row" gap={2} align="center">
              <Calendar className="text-accent" size={20} />
              <CardTitle className="text-title">This Week</CardTitle>
            </Stack>
          </CardHeader>
          <CardBody>
            <div className="mb-4 grid grid-cols-2 gap-4">
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
              <div className="border-t border-ink/10 pt-4">
                <div className="mb-2 text-body-sm text-ink-muted">Most Trained</div>
                <div className="flex flex-wrap gap-1">
                  {weeklyStats.mostTrainedMuscles.map((muscle) => (
                    <span
                      key={muscle}
                      className="rounded-full bg-accent/10 px-2 py-1 text-caption text-accent"
                    >
                      {muscle}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Consistency Score */}
            <ConsistencyBar
              value={weeklyStats.consistencyScore}
              className="mt-4 border-t border-ink/10 pt-4"
            />
          </CardBody>
        </Card>

        {/* Monthly Stats */}
        <Card>
          <CardHeader>
            <Stack direction="row" gap={2} align="center">
              <TrendingUp className="text-accent" size={20} />
              <CardTitle className="text-title">This Month</CardTitle>
            </Stack>
          </CardHeader>
          <CardBody>
            <div className="mb-4 grid grid-cols-2 gap-4">
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
              <div className="border-t border-ink/10 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-body-sm text-ink-muted">Volume Trend</span>
                  <div className={cn(
                    'flex items-center gap-1',
                    volumeTrend > 0 ? 'text-success' : 'text-danger',
                  )}>
                    <TrendingUp size={14} className={volumeTrend < 0 ? 'rotate-180' : ''} />
                    <span className="font-medium font-tabular">{Math.abs(volumeTrend).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Consistency Score */}
            <ConsistencyBar
              value={monthlyStats.consistencyScore}
              className="mt-4 border-t border-ink/10 pt-4"
            />
          </CardBody>
        </Card>
      </div>
    </Stack>
  );
}

interface ConsistencyBarProps {
  value: number;
  className?: string;
}

function ConsistencyBar({ value, className }: ConsistencyBarProps) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-body-sm text-ink-muted">Consistency</span>
        <span className="font-medium text-ink font-tabular">{Math.round(value)}%</span>
      </div>
      <div className="h-2 rounded-full bg-surface-subtle">
        <div
          className="h-2 rounded-full bg-accent transition-all duration-smooth"
          style={{ width: `${value}%` }}
        />
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
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-caption text-ink-muted">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn(
        'text-body font-semibold font-tabular',
        highlight ? 'text-accent' : 'text-ink',
      )}>
        {value}
      </div>
    </div>
  );
}
