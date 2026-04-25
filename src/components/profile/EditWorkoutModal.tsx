import React, { useState, useEffect } from 'react';
import { WorkoutSummary } from '../../types/exerciseHistory';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { X, Save, Calendar, Clock, Edit } from 'lucide-react';

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

  const handleClose = () => {
    if (!isLoading) {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Edit Workout</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Workout Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Workout Name *
            </label>
            <input
              type="text"
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              placeholder="Enter workout name"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Start Time
            </label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Time */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              End Time
            </label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Duration Display */}
          {startTime && endTime && (
            <div className="p-3 bg-gray-700 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Clock className="w-4 h-4" />
                <span>Duration: {formatDuration(calculateDuration())}</span>
              </div>
            </div>
          )}

          {/* Current Stats Display */}
          <div className="p-3 bg-gray-700 rounded-lg">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Workout Stats</h4>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div>
                <div className="font-bold text-white">{workout.totalExercises}</div>
                <div className="text-gray-400">Exercises</div>
              </div>
              <div>
                <div className="font-bold text-white">{workout.totalSets}</div>
                <div className="text-gray-400">Sets</div>
              </div>
              <div>
                <div className="font-bold text-white">{workout.totalVolume.toLocaleString()}</div>
                <div className="text-gray-400">Volume</div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this workout..."
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !workoutName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};