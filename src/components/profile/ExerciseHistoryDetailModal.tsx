import React, { useState, useEffect } from 'react';
import { ExerciseHistory } from '../../types/exerciseHistory';
import { Exercise } from '../../types/exercise';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { ExerciseHistoryEditModal } from './ExerciseHistoryEditModal';
import { Pencil, Trash2, Trophy } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../ui/sheet';
import { IconButton } from '../ui/icon-button';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../../lib/utils';
import { formatDateTime } from './historyFormat';

interface ExerciseGroup {
  exerciseId: string;
  exerciseName: string;
  configuration: string;
  key: string;
  entries: ExerciseHistory[];
  lastPerformed: string;
  timesPerformed: number;
  maxWeight: number;
  totalVolume: number;
  avgVolume: number;
  hasPersonalRecords: boolean;
}

interface ExerciseHistoryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  userId: string;
  exerciseGroup: ExerciseGroup;
  exercises: Exercise[];
}

/** Which records an entry set, as plain labels ("Weight", "Reps", "Volume"). */
function prLabels(entry: ExerciseHistory): string[] {
  const pr = entry.personalRecords;
  if (!pr) return [];
  return [pr.maxWeight && 'Weight', pr.maxReps && 'Reps', pr.maxVolume && 'Volume'].filter(
    (l): l is string => Boolean(l),
  );
}

/**
 * Per-exercise history (Tempo): the four headline numbers for this exercise
 * and configuration, then every logged session as a hairline-separated row —
 * sets as chips, totals as one muted line, PRs called out in success green.
 * Edit and delete sit on each row; editing opens the entry editor sheet.
 */
export const ExerciseHistoryDetailModal: React.FC<ExerciseHistoryDetailModalProps> = ({
  isOpen,
  onClose,
  onRefresh,
  userId,
  exerciseGroup,
  exercises
}) => {
  const [detailedEntries, setDetailedEntries] = useState<ExerciseHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ExerciseHistory | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Load detailed entries when modal opens
  useEffect(() => {
    if (isOpen && exerciseGroup) {
      loadDetailedEntries();
    }
  }, [isOpen, exerciseGroup, userId]);

  const loadDetailedEntries = async () => {
    setIsLoading(true);
    try {
      const entries = await ExerciseHistoryService.getExerciseHistory(userId, {
        exerciseName: exerciseGroup.exerciseName,
        configuration: exerciseGroup.configuration,
        limit: 50
      });
      setDetailedEntries(entries);
    } catch (error) {
      console.error('Error loading detailed exercise history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (entry: ExerciseHistory) => {
    setEditingEntry(entry);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (entry: ExerciseHistory) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete this ${entry.exerciseName} entry from ${new Date(entry.workoutDate).toLocaleDateString()}?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await ExerciseHistoryService.deleteExerciseHistory(userId, entry.id);

      // Refresh the entries
      await loadDetailedEntries();

      // Refresh the parent component
      onRefresh();

      // If this was the last entry, close the modal
      if (detailedEntries.length <= 1) {
        onClose();
      }
    } catch (error) {
      console.error('Error deleting exercise history:', error);
      alert('Failed to delete exercise entry. Please try again.');
    }
  };

  const handleEditSuccess = async () => {
    setIsEditModalOpen(false);
    setEditingEntry(null);

    // Refresh the entries
    await loadDetailedEntries();

    // Refresh the parent component
    onRefresh();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const summary: { label: string; value: React.ReactNode }[] = [
    { label: 'Sessions', value: exerciseGroup.timesPerformed },
    {
      label: 'Heaviest',
      value: (
        <>
          {exerciseGroup.maxWeight}
          <span className="ml-1 font-sans text-body font-semibold tracking-normal text-ink-muted [font-stretch:100%]">
            lbs
          </span>
        </>
      ),
    },
    { label: 'Total volume', value: exerciseGroup.totalVolume.toLocaleString() },
    { label: 'Avg volume', value: exerciseGroup.avgVolume.toLocaleString() },
  ];

  return (
    <>
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetContent className="mx-auto max-w-lg">
          <SheetTitle className="text-title">{exerciseGroup.exerciseName}</SheetTitle>
          <SheetDescription>{exerciseGroup.configuration}</SheetDescription>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
            {summary.map((s) => (
              <div key={s.label} className="flex min-w-0 flex-col-reverse">
                <dt className="mt-1.5 text-caption text-ink-muted">{s.label}</dt>
                <dd className="truncate font-display font-tabular text-display leading-none text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>

          <section aria-labelledby="exercise-history-entries" className="mt-7">
            <h3 id="exercise-history-entries" className="mb-2 text-body-sm font-semibold text-ink">
              {isLoading
                ? 'Sessions'
                : `${detailedEntries.length} session${detailedEntries.length === 1 ? '' : 's'}`}
            </h3>

            {isLoading ? (
              <div className="flex flex-col gap-2" aria-busy="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-2xl" />
                ))}
              </div>
            ) : detailedEntries.length > 0 ? (
              <ul className="overflow-hidden rounded-2xl bg-surface">
                {detailedEntries.map((entry, index) => {
                  const prs = prLabels(entry);
                  const unit = entry.sets[0]?.unit ?? 'lbs';
                  const topWeight = entry.sets.length ? Math.max(...entry.sets.map((s) => s.weight)) : 0;
                  const totalReps = entry.sets.reduce((total, set) => total + set.actualReps, 0);
                  return (
                    <li key={entry.id} className={cn('px-4 py-3', index > 0 && 'border-t border-hairline')}>
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1 pt-1">
                          <p className="text-body-sm font-semibold text-ink">{formatDateTime(entry.workoutDate)}</p>
                          {entry.workoutName && (
                            <p className="truncate text-caption text-ink-muted">{entry.workoutName}</p>
                          )}
                        </div>
                        <IconButton variant="ghost" aria-label="Edit entry" onClick={() => handleEdit(entry)}>
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                        <IconButton
                          variant="ghost"
                          aria-label="Delete entry"
                          onClick={() => handleDelete(entry)}
                          className="hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                      </div>

                      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Sets">
                        {entry.sets.map((set, setIndex) => (
                          <li
                            key={setIndex}
                            className="rounded-full bg-surface-raised px-3 py-1 font-num font-tabular text-body-sm text-ink"
                          >
                            <span className="sr-only">Set {setIndex + 1}: </span>
                            {set.actualReps} × {set.weight} {set.unit}
                          </li>
                        ))}
                      </ul>

                      <p className="mt-2 font-num font-tabular text-caption text-ink-muted">
                        {totalReps} reps · top {topWeight} {unit} · {entry.totalVolume?.toLocaleString() ?? '0'} volume
                      </p>

                      {prs.length > 0 && (
                        <p className="mt-2 flex items-center gap-1.5 text-body-sm font-semibold text-success">
                          <Trophy className="h-4 w-4" aria-hidden="true" />
                          {prs.join(', ')} PR
                        </p>
                      )}

                      {entry.notes && <p className="mt-2 text-body-sm text-ink-muted">{entry.notes}</p>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-2xl bg-surface px-4 py-6 text-center text-body-sm text-ink-muted">
                No sessions logged for this configuration yet.
              </p>
            )}
          </section>
        </SheetContent>
      </Sheet>

      {/* Edit Modal */}
      {editingEntry && (
        <ExerciseHistoryEditModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingEntry(null);
          }}
          onSuccess={handleEditSuccess}
          userId={userId}
          exerciseHistory={editingEntry}
          exercises={exercises}
        />
      )}
    </>
  );
};
