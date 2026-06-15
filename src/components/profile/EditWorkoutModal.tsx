import React, { useState, useEffect } from 'react';
import { WorkoutSummary } from '../../types/exerciseHistory';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { Save, Calendar, Clock, Edit } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Stack } from '../ui/stack';
import { Card, CardBody } from '../ui/card';

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

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent className="max-w-lg mx-auto">
        {/* Header */}
        <Stack direction="row" align="center" gap={2} className="mb-4">
          <Edit className="w-5 h-5 text-accent" />
          <SheetTitle className="text-title">Edit Workout</SheetTitle>
        </Stack>

        {/* Content */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Workout Name */}
          <Stack gap={2}>
            <Label htmlFor="edit-workout-name" required>
              Workout Name
            </Label>
            <Input
              id="edit-workout-name"
              type="text"
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              placeholder="Enter workout name"
              required
            />
          </Stack>

          {/* Start Time */}
          <Stack gap={2}>
            <Label htmlFor="edit-start-time">
              <Calendar className="w-4 h-4" />
              Start Time
            </Label>
            <Input
              id="edit-start-time"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </Stack>

          {/* End Time */}
          <Stack gap={2}>
            <Label htmlFor="edit-end-time">
              <Calendar className="w-4 h-4" />
              End Time
            </Label>
            <Input
              id="edit-end-time"
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </Stack>

          {/* Duration Display */}
          {startTime && endTime && (
            <Card elevation={0} className="bg-surface-subtle">
              <CardBody className="p-3">
                <Stack direction="row" align="center" gap={2} className="text-body-sm text-ink-muted">
                  <Clock className="w-4 h-4" />
                  <span>Duration: {formatDuration(calculateDuration())}</span>
                </Stack>
              </CardBody>
            </Card>
          )}

          {/* Current Stats Display */}
          <Card elevation={0} className="bg-surface-subtle">
            <CardBody className="p-3">
              <h4 className="text-body-sm font-medium text-ink-muted mb-2">Workout Stats</h4>
              <div className="grid grid-cols-3 gap-3 text-center text-body-sm">
                <div>
                  <div className="font-bold text-ink">{workout.totalExercises}</div>
                  <div className="text-ink-muted">Exercises</div>
                </div>
                <div>
                  <div className="font-bold text-ink">{workout.totalSets}</div>
                  <div className="text-ink-muted">Sets</div>
                </div>
                <div>
                  <div className="font-bold text-ink">{workout.totalVolume.toLocaleString()}</div>
                  <div className="text-ink-muted">Volume</div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Notes */}
          <Stack gap={2}>
            <Label htmlFor="edit-notes">Notes (Optional)</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this workout..."
              rows={3}
              className="resize-none"
            />
          </Stack>

          {/* Submit Button */}
          <Stack direction="row" justify="end" gap={3} className="pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !workoutName.trim()}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-accent-fg border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </Stack>
        </form>
      </SheetContent>
    </Sheet>
  );
};
