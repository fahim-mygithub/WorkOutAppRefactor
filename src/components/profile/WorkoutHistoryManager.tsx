import React, { useState, useEffect } from 'react';
import { WorkoutSummary } from '../../types/exerciseHistory';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { Check } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { cn } from '../../lib/utils';

interface WorkoutHistoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onHistoryUpdated: () => void;
  userId: string;
  initialWorkouts: WorkoutSummary[];
}

/**
 * Bulk history tools in a bottom sheet (Tempo): an optional date range, the
 * sessions as selectable hairline rows (ice check when selected), then the
 * actions: export, delete selected, and the two sweeping deletes as quiet
 * danger text. Every delete goes through a confirmation step in the same sheet.
 */
export const WorkoutHistoryManager: React.FC<WorkoutHistoryManagerProps> = ({
  isOpen,
  onClose,
  onHistoryUpdated,
  userId,
  initialWorkouts
}) => {
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>(initialWorkouts);
  const [selectedWorkouts, setSelectedWorkouts] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationStep, setConfirmationStep] = useState<'none' | 'bulk' | 'all' | 'range'>('none');
  const [confirmationText, setConfirmationText] = useState('');

  useEffect(() => {
    setWorkouts(initialWorkouts);
    setSelectedWorkouts(new Set());
  }, [initialWorkouts]);

  const formatDate = (date: Date | string): string => {
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }).format(dateObj);
    } catch {
      return 'Invalid Date';
    }
  };

  const handleSelectAll = () => {
    if (selectedWorkouts.size === workouts.length) {
      setSelectedWorkouts(new Set());
    } else {
      setSelectedWorkouts(new Set(workouts.map(w => w.id)));
    }
  };

  const handleSelectWorkout = (workoutId: string) => {
    const newSelected = new Set(selectedWorkouts);
    if (newSelected.has(workoutId)) {
      newSelected.delete(workoutId);
    } else {
      newSelected.add(workoutId);
    }
    setSelectedWorkouts(newSelected);
  };

  const filterWorkoutsByDateRange = (): WorkoutSummary[] => {
    if (!startDate && !endDate) return workouts;

    return workouts.filter(workout => {
      const workoutDate = new Date(workout.endTime);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if (start && workoutDate < start) return false;
      if (end && workoutDate > end) return false;
      return true;
    });
  };

  const handleBulkDelete = () => {
    if (selectedWorkouts.size === 0) return;
    setConfirmationStep('bulk');
  };

  const handleDeleteAll = () => {
    setConfirmationStep('all');
  };

  const handleDeleteByDateRange = () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }
    setConfirmationStep('range');
  };

  const executeDelete = async (type: 'bulk' | 'all' | 'range') => {
    setIsLoading(true);
    try {
      switch (type) {
        case 'bulk':
          if (selectedWorkouts.size === 0) return;
          await ExerciseHistoryService.deleteMultipleWorkouts(userId, Array.from(selectedWorkouts));
          break;

        case 'all':
          if (confirmationText !== 'DELETE ALL WORKOUTS') {
            alert('Please type "DELETE ALL WORKOUTS" to confirm');
            return;
          }
          await ExerciseHistoryService.clearAllWorkoutHistory(userId);
          break;

        case 'range':
          if (!startDate || !endDate) return;
          await ExerciseHistoryService.clearWorkoutHistoryByDateRange(
            userId,
            new Date(startDate),
            new Date(endDate)
          );
          break;
      }

      setConfirmationStep('none');
      setConfirmationText('');
      setSelectedWorkouts(new Set());
      onHistoryUpdated();
      onClose();
    } catch (error) {
      console.error('Error deleting workouts:', error);
      alert('Failed to delete workouts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const exportWorkouts = () => {
    const dataToExport = selectedWorkouts.size > 0
      ? workouts.filter(w => selectedWorkouts.has(w.id))
      : workouts;

    const exportData = {
      exportDate: new Date().toISOString(),
      totalWorkouts: dataToExport.length,
      workouts: dataToExport.map(workout => ({
        name: workout.name,
        date: workout.endTime,
        duration: workout.duration,
        exercises: workout.totalExercises,
        sets: workout.totalSets,
        reps: workout.totalReps,
        volume: workout.totalVolume,
        notes: workout.notes,
        exerciseBreakdown: workout.exercisesSummary
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workout-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredWorkouts = filterWorkoutsByDateRange();
  const allShownSelected = filteredWorkouts.length > 0 && selectedWorkouts.size === filteredWorkouts.length;

  const handleOpenChange = (open: boolean) => {
    if (!open && !isLoading) {
      onClose();
    }
  };

  const cancelConfirmation = () => {
    setConfirmationStep('none');
    setConfirmationText('');
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent className="mx-auto max-w-lg">
        {confirmationStep === 'none' ? (
          <>
            <SheetTitle className="text-title">Manage history</SheetTitle>
            <SheetDescription>Export sessions, or clear out the ones you don’t need.</SheetDescription>

            {/* Date range filter */}
            <div role="group" aria-labelledby="manager-range-heading" className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <span id="manager-range-heading" className="text-body-sm font-semibold text-ink">
                  Date range
                </span>
                {(startDate || endDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Label htmlFor="manager-start-date" size="sm" className="text-ink-muted">
                    From
                  </Label>
                  <Input
                    id="manager-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="min-w-0 px-3"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Label htmlFor="manager-end-date" size="sm" className="text-ink-muted">
                    To
                  </Label>
                  <Input
                    id="manager-end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="min-w-0 px-3"
                  />
                </div>
              </div>
            </div>

            {/* Sessions */}
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  aria-pressed={allShownSelected}
                  className="flex min-h-touch-min items-center gap-2 rounded-full pr-2 text-body-sm font-semibold text-ink-muted transition-colors duration-snap hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <CheckMark checked={allShownSelected} />
                  Select all
                </button>
                <span className="text-body-sm text-ink-muted">
                  {filteredWorkouts.length} session{filteredWorkouts.length !== 1 ? 's' : ''}
                </span>
              </div>

              <ul className="overflow-hidden rounded-2xl bg-surface">
                {filteredWorkouts.map((workout, i) => {
                  const checked = selectedWorkouts.has(workout.id);
                  return (
                    <li key={workout.id} className={cn(i > 0 && 'border-t border-hairline')}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => handleSelectWorkout(workout.id)}
                        className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-snap hover:bg-surface-raised/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                      >
                        <CheckMark checked={checked} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body-sm font-semibold text-ink">{workout.name}</span>
                          <span className="block truncate text-caption text-ink-muted">
                            {formatDate(workout.endTime)} · {workout.totalSets} sets · {workout.totalVolume.toLocaleString()} lbs
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
                {filteredWorkouts.length === 0 && (
                  <li className="px-4 py-5 text-body-sm text-ink-muted">No sessions in this range.</li>
                )}
              </ul>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={exportWorkouts}>
                  Export {selectedWorkouts.size > 0 ? `(${selectedWorkouts.size})` : 'all'}
                </Button>
                <Button variant="danger" onClick={handleBulkDelete} disabled={selectedWorkouts.size === 0}>
                  Delete ({selectedWorkouts.size})
                </Button>
              </div>
              <Button
                variant="ghost"
                className="text-danger hover:text-danger"
                onClick={handleDeleteByDateRange}
                disabled={!startDate || !endDate}
              >
                Delete everything in the date range
              </Button>
              <Button variant="ghost" className="text-danger hover:text-danger" onClick={handleDeleteAll}>
                Delete all history
              </Button>
            </div>
          </>
        ) : (
          /* Confirmation step */
          <>
            <SheetTitle className="text-title">
              {confirmationStep === 'bulk' &&
                `Delete ${selectedWorkouts.size} session${selectedWorkouts.size !== 1 ? 's' : ''}?`}
              {confirmationStep === 'all' && 'Delete all history?'}
              {confirmationStep === 'range' && 'Delete this date range?'}
            </SheetTitle>
            <SheetDescription>
              {confirmationStep === 'bulk' &&
                `This permanently deletes ${selectedWorkouts.size} selected session${selectedWorkouts.size !== 1 ? 's' : ''}. `}
              {confirmationStep === 'range' &&
                `This permanently deletes every session between ${formatDate(startDate)} and ${formatDate(endDate)}. `}
              {confirmationStep === 'all' &&
                `This permanently deletes all ${workouts.length} session${workouts.length !== 1 ? 's' : ''} in your history. `}
              It can’t be undone.
            </SheetDescription>

            {confirmationStep === 'all' && (
              <div className="mt-5 flex flex-col gap-1.5">
                <Label htmlFor="manager-confirm-all" className="text-ink-muted">
                  Type DELETE ALL WORKOUTS to confirm
                </Label>
                <Input
                  id="manager-confirm-all"
                  type="text"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder="DELETE ALL WORKOUTS"
                  autoComplete="off"
                  className="font-sans"
                />
              </div>
            )}

            <div className="mt-6 flex flex-col gap-2">
              <Button
                variant="danger"
                size="lg"
                onClick={() => executeDelete(confirmationStep)}
                disabled={isLoading || (confirmationStep === 'all' && confirmationText !== 'DELETE ALL WORKOUTS')}
              >
                {isLoading ? 'Deleting…' : 'Delete permanently'}
              </Button>
              <Button variant="ghost" onClick={cancelConfirmation} disabled={isLoading}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

/** Round selection mark: ice fill + check when on, a raised ring when off. */
function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-snap',
        checked ? 'bg-accent-2 text-accent-2-fg' : 'ring-2 ring-inset ring-surface-raised',
      )}
    >
      {checked && <Check className="h-4 w-4" strokeWidth={3} />}
    </span>
  );
}
