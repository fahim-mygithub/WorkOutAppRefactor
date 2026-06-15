import React, { useState, useEffect } from 'react';
import { ExerciseHistory } from '../../types/exerciseHistory';
import { Exercise } from '../../types/exercise';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { ExerciseHistoryEditModal } from './ExerciseHistoryEditModal';
import { Edit, Trash2, Calendar, BarChart3, Trophy } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '../ui/sheet';
import { IconButton } from '../ui/icon-button';
import { Skeleton } from '../ui/skeleton';
import { Card, CardBody } from '../ui/card';
import { Stack } from '../ui/stack';

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

  const formatDate = (dateString: string): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  const formatWeight = (weight: number, unit: string = 'lbs'): string => {
    return `${weight} ${unit}`;
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetContent className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-4">
            <SheetTitle className="text-title">{exerciseGroup.exerciseName}</SheetTitle>
            <p className="text-accent font-medium">{exerciseGroup.configuration}</p>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-6 mb-6 border-b border-border">
            <div className="text-center">
              <div className="text-display font-bold text-accent">{exerciseGroup.timesPerformed}</div>
              <div className="text-ink-muted text-body-sm">Times Performed</div>
            </div>
            <div className="text-center">
              <div className="text-display font-bold text-success">{formatWeight(exerciseGroup.maxWeight)}</div>
              <div className="text-ink-muted text-body-sm">Max Weight</div>
            </div>
            <div className="text-center">
              <div className="text-display font-bold text-muscle-core">{exerciseGroup.totalVolume.toLocaleString()}</div>
              <div className="text-ink-muted text-body-sm">Total Volume</div>
            </div>
            <div className="text-center">
              <div className="text-display font-bold text-muscle-legs">{exerciseGroup.avgVolume.toLocaleString()}</div>
              <div className="text-ink-muted text-body-sm">Avg Volume</div>
            </div>
          </div>

          {/* Content */}
          <div>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            ) : detailedEntries.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-body font-semibold text-ink">
                    Performance History ({detailedEntries.length} entries)
                  </h3>
                </div>

                {detailedEntries.map((entry) => (
                  <Card key={entry.id} elevation={0} className="bg-surface-subtle">
                    <CardBody className="p-4">
                      {/* Entry Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-ink-subtle" />
                              <span className="font-medium text-ink">
                                {formatDate(entry.workoutDate)}
                              </span>
                              {entry.personalRecords && Object.keys(entry.personalRecords).length > 0 && (
                                <Trophy className="h-4 w-4 text-warning" aria-label="Personal Record" />
                              )}
                            </div>
                            {entry.workoutName && (
                              <div className="text-body-sm text-ink-muted">
                                Workout: {entry.workoutName}
                              </div>
                            )}
                          </div>
                        </div>

                        <Stack direction="row" align="center" gap={2}>
                          <IconButton
                            variant="ghost"
                            size="sm"
                            aria-label="Edit entry"
                            onClick={() => handleEdit(entry)}
                            className="text-accent"
                          >
                            <Edit className="w-4 h-4" />
                          </IconButton>
                          <IconButton
                            variant="ghost"
                            size="sm"
                            aria-label="Delete entry"
                            onClick={() => handleDelete(entry)}
                            className="text-danger"
                          >
                            <Trash2 className="w-4 h-4" />
                          </IconButton>
                        </Stack>
                      </div>

                      {/* Sets Information */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                        <div>
                          <h4 className="text-body-sm font-medium text-ink-muted mb-2">Sets & Reps</h4>
                          <div className="space-y-1">
                            {entry.sets.map((set, setIndex) => (
                              <div key={setIndex} className="flex items-center justify-between text-body-sm">
                                <span className="text-ink-subtle">Set {setIndex + 1}:</span>
                                <span className="text-ink">
                                  {set.actualReps} reps × {formatWeight(set.weight, set.unit)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-body-sm">
                            <span className="text-ink-subtle">Total Volume:</span>
                            <span className="text-ink">{entry.totalVolume?.toLocaleString() ?? '0'}</span>
                          </div>
                          <div className="flex items-center justify-between text-body-sm">
                            <span className="text-ink-subtle">Max Weight:</span>
                            <span className="text-ink">
                              {formatWeight(Math.max(...entry.sets.map(s => s.weight)), entry.sets[0]?.unit)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-body-sm">
                            <span className="text-ink-subtle">Total Reps:</span>
                            <span className="text-ink">
                              {entry.sets.reduce((total, set) => total + set.actualReps, 0)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      {entry.notes && (
                        <div className="mt-3 p-2 bg-surface-raised rounded text-body-sm">
                          <span className="text-ink-subtle">Notes: </span>
                          <span className="text-ink-muted">{entry.notes}</span>
                        </div>
                      )}

                      {/* Personal Records */}
                      {entry.personalRecords && Object.keys(entry.personalRecords).length > 0 && (
                        <div className="mt-3 p-2 bg-warning/10 border border-warning/30 rounded">
                          <div className="flex items-center gap-2 mb-1">
                            <Trophy className="h-4 w-4 text-warning" />
                            <span className="text-body-sm font-medium text-warning">Personal Records</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-caption">
                            {entry.personalRecords?.maxWeight && (
                              <div className="text-warning">
                                Weight PR: {formatWeight(entry.personalRecords.maxWeight.weight ?? 0)}
                              </div>
                            )}
                            {entry.personalRecords?.maxReps && (
                              <div className="text-accent">
                                Reps PR: {entry.personalRecords.maxReps.reps ?? 0} reps
                              </div>
                            )}
                            {entry.personalRecords?.maxVolume && (
                              <div className="text-success">
                                Volume PR: {entry.personalRecords.maxVolume.volume?.toLocaleString() ?? '0'}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 text-ink-subtle mx-auto mb-4" />
                <h3 className="text-body font-medium text-ink-muted mb-2">
                  No entries found
                </h3>
                <p className="text-ink-muted">
                  No performance history available for this exercise configuration.
                </p>
              </div>
            )}
          </div>
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
