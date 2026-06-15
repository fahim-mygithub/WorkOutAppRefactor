import React, { useState, useEffect, useMemo } from 'react';
import { ExerciseHistory } from '../../types/exerciseHistory';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { Search, Plus, Calendar, Weight, Trophy, BarChart3, TrendingUp } from 'lucide-react';
import { ExerciseHistoryDetailModal } from './ExerciseHistoryDetailModal';
import { Exercise } from '../../types/exercise';
import { Card, CardBody } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface AllExercisesHistoryProps {
  userId: string;
  limit?: number;
  onManualAddClick?: () => void;
  exercises: Exercise[];
  isLoadingExercises?: boolean;
  refreshTrigger?: number;
}

interface ExerciseGroup {
  exerciseId: string;
  exerciseName: string;
  configuration: string;
  key: string; // exerciseName + configuration
  entries: ExerciseHistory[];
  lastPerformed: string;
  timesPerformed: number;
  maxWeight: number;
  totalVolume: number;
  avgVolume: number;
  hasPersonalRecords: boolean;
}

export const AllExercisesHistory: React.FC<AllExercisesHistoryProps> = ({
  userId,
  limit = 100,
  onManualAddClick,
  exercises,
  isLoadingExercises = false,
  refreshTrigger = 0
}) => {
  const [allHistory, setAllHistory] = useState<ExerciseHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'lastPerformed' | 'timesPerformed' | 'maxWeight' | 'totalVolume'>('lastPerformed');
  const [selectedGroup, setSelectedGroup] = useState<ExerciseGroup | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Load all exercise history
  const loadAllHistory = async () => {
    if (!userId) return;

    try {
      setIsLoading(true);
      const history = await ExerciseHistoryService.getAllExerciseHistory(userId, limit);
      setAllHistory(history);
    } catch (error) {
      console.error('Error loading all exercise history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllHistory();
  }, [userId, limit, refreshTrigger]);

  // Handle clicking on an exercise group to view details
  const handleGroupClick = (group: ExerciseGroup) => {
    setSelectedGroup(group);
    setIsDetailModalOpen(true);
  };

  // Handle refreshing data after edits/deletes
  const handleRefresh = async () => {
    await loadAllHistory();
  };

  // Group exercises by name + configuration
  const exerciseGroups = useMemo(() => {
    const groups = new Map<string, ExerciseGroup>();

    allHistory.forEach((entry) => {
      const key = `${entry.exerciseName}-${entry.configuration}`;

      if (!groups.has(key)) {
        groups.set(key, {
          exerciseId: entry.exerciseId,
          exerciseName: entry.exerciseName,
          configuration: entry.configuration,
          key,
          entries: [],
          lastPerformed: entry.workoutDate,
          timesPerformed: 0,
          maxWeight: 0,
          totalVolume: 0,
          avgVolume: 0,
          hasPersonalRecords: false
        });
      }

      const group = groups.get(key)!;
      group.entries.push(entry);
      group.timesPerformed++;
      group.totalVolume += entry.totalVolume;

      // Update max weight
      const entryMaxWeight = Math.max(...entry.sets.map(s => s.weight));
      if (entryMaxWeight > group.maxWeight) {
        group.maxWeight = entryMaxWeight;
      }

      // Update last performed (entries are already sorted by date desc)
      if (entry.workoutDate > group.lastPerformed) {
        group.lastPerformed = entry.workoutDate;
      }

      // Check for personal records
      if (entry.personalRecords && Object.keys(entry.personalRecords).length > 0) {
        group.hasPersonalRecords = true;
      }
    });

    // Calculate average volume for each group
    groups.forEach((group) => {
      group.avgVolume = Math.round(group.totalVolume / group.timesPerformed);
    });

    return Array.from(groups.values());
  }, [allHistory]);

  // Filter exercises based on search term
  const filteredGroups = useMemo(() => {
    if (!searchTerm) return exerciseGroups;

    const lowerSearchTerm = searchTerm.toLowerCase();
    return exerciseGroups.filter(group =>
      group.exerciseName.toLowerCase().includes(lowerSearchTerm) ||
      group.configuration.toLowerCase().includes(lowerSearchTerm)
    );
  }, [exerciseGroups, searchTerm]);

  // Sort exercises
  const sortedGroups = useMemo(() => {
    const sorted = [...filteredGroups];

    switch (sortBy) {
      case 'lastPerformed':
        return sorted.sort((a, b) => b.lastPerformed.localeCompare(a.lastPerformed));
      case 'timesPerformed':
        return sorted.sort((a, b) => b.timesPerformed - a.timesPerformed);
      case 'maxWeight':
        return sorted.sort((a, b) => b.maxWeight - a.maxWeight);
      case 'totalVolume':
        return sorted.sort((a, b) => b.totalVolume - a.totalVolume);
      default:
        return sorted;
    }
  }, [filteredGroups, sortBy]);

  const formatDate = (dateString: string): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(dateString));
  };

  const formatWeight = (weight: number): string => {
    return `${weight} lbs`;
  };

  if (isLoading) {
    return (
      <Card elevation={1} aria-busy="true">
        <CardBody className="p-6 space-y-4">
          <Skeleton className="h-6 w-1/3" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardBody>
      </Card>
    );
  }

  if (exerciseGroups.length === 0) {
    return (
      <Card elevation={1}>
        <CardBody className="p-6">
          <div className="text-center py-8">
            <BarChart3 className="h-12 w-12 text-ink-subtle mx-auto mb-4" />
            <h3 className="text-body font-medium text-ink mb-2">
              No Exercise History
            </h3>
            <p className="text-ink-muted mb-4">
              This exercise hasn't been performed yet. Start a workout to build your history!
            </p>
            {onManualAddClick && (
              <Button onClick={onManualAddClick}>
                Log Manual Exercise
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card elevation={1}>
      <CardBody className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-body font-semibold text-ink">
          Exercise Performance History
        </h3>
        <div className="flex items-center gap-4">
          <span className="text-body-sm text-ink-muted">
            {exerciseGroups.length} unique exercise{exerciseGroups.length !== 1 ? 's' : ''}
          </span>
          {onManualAddClick && (
            <Button
              size="sm"
              onClick={onManualAddClick}
              disabled={isLoadingExercises}
            >
              {isLoadingExercises ? (
                <div className="w-4 h-4 border-2 border-accent-fg border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {isLoadingExercises ? 'Loading...' : 'Add Exercise'}
            </Button>
          )}
        </div>
      </div>

      {/* Search and Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-subtle z-10" />
          <Input
            type="text"
            placeholder="Search exercises..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-body-sm text-ink-muted shrink-0">Sort by:</span>
          <Select
            value={sortBy}
            onValueChange={(value) => setSortBy(value as typeof sortBy)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lastPerformed">Last Performed</SelectItem>
              <SelectItem value="timesPerformed">Times Performed</SelectItem>
              <SelectItem value="maxWeight">Max Weight</SelectItem>
              <SelectItem value="totalVolume">Total Volume</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Summary */}
      {searchTerm && (
        <div className="mb-4">
          <p className="text-body-sm text-ink-muted">
            Showing {filteredGroups.length} of {exerciseGroups.length} exercises
          </p>
        </div>
      )}

      {/* Exercise Cards Grid */}
      {sortedGroups.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedGroups.map((group) => (
            <div
              key={group.key}
              onClick={() => handleGroupClick(group)}
              className="bg-surface-subtle rounded-md p-4 hover:bg-surface-raised transition-colors duration-snap cursor-pointer"
            >
              {/* Exercise Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-ink truncate">
                    {group.exerciseName}
                  </h4>
                  <p className="text-body-sm text-accent font-medium">
                    {group.configuration}
                  </p>
                </div>
                {group.hasPersonalRecords && (
                  <Trophy className="h-4 w-4 text-warning flex-shrink-0 ml-2" aria-label="Has Personal Records" />
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 text-body-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3 text-ink-subtle" />
                  <div>
                    <div className="text-ink-muted">{formatDate(group.lastPerformed)}</div>
                    <div className="text-caption text-ink-subtle">Last performed</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3 w-3 text-ink-subtle" />
                  <div>
                    <div className="text-ink-muted">{group.timesPerformed}x</div>
                    <div className="text-caption text-ink-subtle">Times performed</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Weight className="h-3 w-3 text-ink-subtle" />
                  <div>
                    <div className="text-ink-muted">{formatWeight(group.maxWeight)}</div>
                    <div className="text-caption text-ink-subtle">Max weight</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <BarChart3 className="h-3 w-3 text-ink-subtle" />
                  <div>
                    <div className="text-ink-muted">{group.totalVolume.toLocaleString()}</div>
                    <div className="text-caption text-ink-subtle">Total volume</div>
                  </div>
                </div>
              </div>

              {/* Click Hint */}
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-caption text-ink-subtle text-center">
                  Click to view detailed history
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Search className="h-8 w-8 text-ink-subtle mx-auto mb-2" />
          <p className="text-ink-muted">No exercises found matching "{searchTerm}"</p>
        </div>
      )}
      </CardBody>

      {/* Exercise Detail Modal */}
      {selectedGroup && (
        <ExerciseHistoryDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedGroup(null);
          }}
          onRefresh={handleRefresh}
          userId={userId}
          exerciseGroup={selectedGroup}
          exercises={exercises}
        />
      )}
    </Card>
  );
};