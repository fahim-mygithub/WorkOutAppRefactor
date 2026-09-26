import React, { useState, useEffect, useMemo } from 'react';
import { ExerciseHistory } from '../../types/exerciseHistory';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { Search, Plus, Trophy } from 'lucide-react';
import { ExerciseHistoryDetailModal } from './ExerciseHistoryDetailModal';
import { Exercise } from '../../types/exercise';
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
import { cn } from '../../lib/utils';
import { formatShortDate, toIsoString } from './historyFormat';

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

/**
 * Every exercise the user has logged, grouped by name + configuration (Tempo).
 *
 * A search pill and a sort select, then one subtle card of hairline rows: the
 * name with its configuration and last date muted underneath, and the heaviest
 * weight in the number voice on the right. Tapping a row opens the per-exercise
 * detail sheet.
 */
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
      const entryDate = toIsoString(entry.workoutDate);

      if (!groups.has(key)) {
        groups.set(key, {
          exerciseId: entry.exerciseId,
          exerciseName: entry.exerciseName,
          configuration: entry.configuration,
          key,
          entries: [],
          lastPerformed: entryDate,
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
      if (entryDate > group.lastPerformed) {
        group.lastPerformed = entryDate;
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

  const logButton = onManualAddClick && (
    <Button variant="secondary" size="sm" onClick={onManualAddClick} disabled={isLoadingExercises}>
      <Plus className="h-4 w-4" aria-hidden="true" />
      {isLoadingExercises ? 'Loading…' : 'Log exercise'}
    </Button>
  );

  const header = (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 id="exercise-history-heading" className="font-wide text-title font-bold text-ink">
          Exercises
        </h2>
        {!isLoading && exerciseGroups.length > 0 && (
          <p className="text-body-sm text-ink-muted">
            {exerciseGroups.length} logged exercise{exerciseGroups.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
      {logButton}
    </div>
  );

  if (isLoading) {
    return (
      <section aria-labelledby="exercise-history-heading" aria-busy="true">
        {header}
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      </section>
    );
  }

  if (exerciseGroups.length === 0) {
    return (
      <section aria-labelledby="exercise-history-heading">
        {header}
        <div className="rounded-[20px] bg-surface-subtle px-5 py-6">
          <p className="text-body font-semibold text-ink">No exercises logged yet</p>
          <p className="mt-1 text-body-sm text-ink-muted">
            Finish a workout, or log an exercise you did on your own.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="exercise-history-heading">
      {header}

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Search exercises"
            placeholder="Search exercises"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-full pl-11 font-sans"
          />
        </div>
        <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
          <SelectTrigger aria-label="Sort by" className="rounded-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lastPerformed">Most recent</SelectItem>
            <SelectItem value="timesPerformed">Most sessions</SelectItem>
            <SelectItem value="maxWeight">Heaviest</SelectItem>
            <SelectItem value="totalVolume">Most volume</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {searchTerm && (
        <p className="mb-2 px-1 text-body-sm text-ink-muted" aria-live="polite">
          Showing {filteredGroups.length} of {exerciseGroups.length}
        </p>
      )}

      {sortedGroups.length > 0 ? (
        <ul className="overflow-hidden rounded-[20px] bg-surface-subtle">
          {sortedGroups.map((group, i) => (
            <li key={group.key} className={cn(i > 0 && 'border-t border-hairline')}>
              <button
                type="button"
                onClick={() => handleGroupClick(group)}
                aria-haspopup="dialog"
                className="flex min-h-[64px] w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-snap hover:bg-surface-raised/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-body font-semibold text-ink">{group.exerciseName}</span>
                    {group.hasPersonalRecords && (
                      <Trophy className="h-4 w-4 shrink-0 text-success" aria-label="Has personal records" />
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-body-sm text-ink-muted">
                    {group.configuration} · {formatShortDate(group.lastPerformed)} · {group.timesPerformed}×
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-num font-tabular font-wide text-title font-bold text-ink">
                    {group.maxWeight}
                  </span>
                  <span className="block text-caption text-ink-muted">lbs top</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[20px] bg-surface-subtle px-5 py-6 text-body-sm text-ink-muted">
          No exercises match "{searchTerm}".
        </p>
      )}

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
    </section>
  );
};
