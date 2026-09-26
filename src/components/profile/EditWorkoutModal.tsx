import React, { useState, useEffect } from 'react';
import { WorkoutSummary } from '../../types/exerciseHistory';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { formatDuration } from './historyFormat';

interface EditWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  workout: WorkoutSummary;
}

export const EditWorkoutModal: React.FC<EditWorkoutModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userId,
  workout
}) => {
  const [workoutName, setWorkoutName] = useState(workout.name);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState(workout.notes || '');
  const [isLoading, setIsLoading] = useState(false);

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen && workout) {
      setWorkoutName(workout.name);

      // Convert dates to datetime-local format
      const startDate = new Date(workout.startTime);
      const endDate = new Date(workout.endTime);

      if (!isNaN(startDate.getTime())) {
        setStartTime(formatDateTimeLocal(startDate));
      }

      if (!isNaN(endDate.getTime())) {
        setEndTime(formatDateTimeLocal(endDate));
      }

      setNotes(workout.notes || '');
    }
  }, [isOpen, workout]);

  // Helper function to format date for datetime-local input
  const formatDateTimeLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Calculate duration based on start and end times
  const calculateDuration = (): number => {
    if (!startTime || !endTime) return workout.duration;

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return workout.duration;
    }

    const durationMs = end.getTime() - start.getTime();
    return Math.max(1, Math.round(durationMs / (1000 * 60))); // Convert to minutes, minimum 1 minute
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!workoutName.trim() || !userId) {
      return;
    }

    // Validate that end time is after start time
    if (startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);

      if (end <= start) {
        alert('End time must be after start time');
        return;
      }
    }

    setIsLoading(true);

    try {
      const updateData: any = {
        name: workoutName.trim(),
        notes: notes.trim() || undefined
      };

      if (startTime) {
        updateData.startTime = new Date(startTime).toISOString();
      }

      if (endTime) {
        updateData.endTime = new Date(endTime).toISOString();
      }

      // Update duration if times changed
      if (startTime && endTime) {
        updateData.duration = calculateDuration();
      }

      await ExerciseHistoryService.updateWorkoutHistory(userId, workout.id, updateData);

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating workout:', error);
      alert('Failed to update workout. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !isLoading) {
      onClose();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent className="mx-auto max-w-lg">
        <SheetTitle className="text-title">Edit workout</SheetTitle>
        <SheetDescription>
          {workout.totalExercises} exercises · {workout.totalSets} sets · {workout.totalVolume.toLocaleString()} volume
        </SheetDescription>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-workout-name" required className="text-ink-muted">
              Name
            </Label>
            <Input
              id="edit-workout-name"
              type="text"
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              placeholder="e.g. Push day"
              className="font-sans"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="edit-start-time" className="text-ink-muted">
                Started
              </Label>
              <Input
                id="edit-start-time"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="edit-end-time" className="text-ink-muted">
                Finished
              </Label>
              <Input
                id="edit-end-time"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {startTime && endTime && (
            <p className="-mt-2 text-body-sm text-ink-muted" aria-live="polite">
              Duration{' '}
              <span className="font-num font-tabular font-semibold text-ink">
                {formatDuration(calculateDuration())}
              </span>
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-notes" className="text-ink-muted">
              Notes (optional)
            </Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this workout"
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <Button type="submit" size="xl" disabled={isLoading || !workoutName.trim()}>
              {isLoading ? 'Saving…' : 'Save changes'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};
