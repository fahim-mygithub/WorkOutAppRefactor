import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../store/hooks';
import { WorkoutSummary } from '../../types/exerciseHistory';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { EditWorkoutModal } from './EditWorkoutModal';
import { startWorkout } from '../../store/slices/workoutSlice';
import { convertWorkoutHistoryToExercises, sanitizeWorkoutExercisesForRedux } from '../../utils/workoutConversion';
import { useExercises } from '../../hooks/useExercises';
import {
  Calendar,
  Clock,
  Target,
  TrendingUp,
  Weight,
  ChevronDown,
  ChevronUp,
  Trophy,
  Hash,
  Edit,
  Trash2,
  MoreVertical,
  Play
} from 'lucide-react';

interface CompletedWorkoutCardProps {
  workout: WorkoutSummary;
  className?: string;
  onWorkoutUpdated?: () => void;
  onWorkoutDeleted?: () => void;
  userId: string;
}

export const CompletedWorkoutCard: React.FC<CompletedWorkoutCardProps> = ({
  workout,
  className = '',
  onWorkoutUpdated,
  onWorkoutDeleted,
  userId
}) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { exercises: exerciseDatabase, isLoading: isLoadingExercises } = useExercises();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingStart, setIsLoadingStart] = useState(false);

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return 'N/A';

    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      if (isNaN(dateObj.getTime())) return 'Invalid Date';

      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(dateObj);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
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

  const handleToggleExpand = (e: React.MouseEvent) => {
    // Don't expand if clicking on action buttons
    if ((e.target as Element).closest('.action-button')) {
      return;
    }
    setIsExpanded(!isExpanded);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditModalOpen(true);
    setShowActions(false);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      `Are you sure you want to delete the workout "${workout.name}" from ${formatDate(workout.endTime)}?\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      setShowActions(false);
      return;
    }

    setIsDeleting(true);
    try {
      await ExerciseHistoryService.deleteWorkoutHistory(userId, workout.id);
      onWorkoutDeleted?.();
    } catch (error) {
      console.error('Error deleting workout:', error);
      alert('Failed to delete workout. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowActions(false);
    }
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    onWorkoutUpdated?.();
  };

  const handleStartWorkout = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isLoadingExercises || !exerciseDatabase.length) {
      alert('Exercise database is still loading. Please wait a moment and try again.');
      return;
    }

    setIsLoadingStart(true);
    setShowActions(false);

    try {
      // Get the exercise history for this workout
      // Use the original workoutId if available, otherwise fall back to the document ID
      const workoutIdToQuery = workout.workoutId || workout.id;
      const exerciseHistories = await ExerciseHistoryService.getExerciseHistoryByWorkoutId(
        userId,
        workoutIdToQuery
      );

      if (!exerciseHistories.length) {
        // If no detailed exercises, try to reconstruct from workout summary
        alert('Unable to load workout details. The workout may not have detailed exercise information.');
        return;
      }

      // Convert to workout exercises
      const { exercises, workoutName } = convertWorkoutHistoryToExercises(
        exerciseHistories,
        exerciseDatabase,
        workout
      );

      if (exercises.length === 0) {
        alert('No valid exercises found in this workout.');
        return;
      }

      // Sanitize exercises for Redux
      const sanitizedExercises = sanitizeWorkoutExercisesForRedux(exercises);

      // Start the workout
      dispatch(startWorkout({
        name: workoutName,
        exercises: sanitizedExercises,
      }));

      // Navigate to workout page
      navigate('/workout');
    } catch (error) {
      console.error('Error starting workout from history:', error);
      alert('Failed to start workout. Please try again.');
    } finally {
      setIsLoadingStart(false);
    }
  };

  return (
    <div className={`bg-gray-800 rounded-lg overflow-hidden transition-all duration-200 hover:bg-gray-750 ${className}`}>
      {/* Header - Always Visible */}
      <div
        className="p-4 cursor-pointer"
        onClick={handleToggleExpand}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-white">{workout.name}</h3>
              {workout.templateId && (
                <span className="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded">
                  Template
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(workout.endTime)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{formatDuration(workout.duration)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Target className="w-4 h-4" />
                <span>{workout.totalSets} sets</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Stats */}
            <div className="text-right">
              <div className="text-lg font-bold text-white">{workout.totalVolume.toLocaleString()}</div>
              <div className="text-xs text-gray-400">lbs volume</div>
            </div>

            {/* Actions Menu */}
            <div className="relative action-button">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowActions(!showActions);
                }}
                className="p-1 text-gray-400 hover:text-white transition-colors"
                disabled={isDeleting}
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {showActions && (
                <div className="absolute right-0 top-8 bg-gray-700 border border-gray-600 rounded-lg shadow-lg z-10 min-w-40">
                  <button
                    onClick={handleStartWorkout}
                    disabled={isLoadingStart}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-600 flex items-center gap-2 rounded-t-lg disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    {isLoadingStart ? 'Loading...' : 'Start Workout'}
                  </button>
                  <button
                    onClick={handleEdit}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-600 flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-600 flex items-center gap-2 rounded-b-lg disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              )}
            </div>

            {/* Expand Icon */}
            <button className="p-1 text-gray-400 hover:text-white transition-colors action-button">
              {isExpanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{workout.totalExercises} exercises</span>
            <span>{workout.totalReps.toLocaleString()} reps</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full"
              style={{ width: '100%' }} // All completed workouts are 100% complete
            />
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-700">
          {/* Detailed Stats */}
          <div className="p-4 bg-gray-750">
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Target className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-lg font-bold text-white">{workout.totalSets}</div>
                <div className="text-xs text-gray-400">Sets</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Hash className="w-4 h-4 text-green-400" />
                </div>
                <div className="text-lg font-bold text-white">{workout.totalReps.toLocaleString()}</div>
                <div className="text-xs text-gray-400">Reps</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Weight className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-lg font-bold text-white">{workout.totalVolume.toLocaleString()}</div>
                <div className="text-xs text-gray-400">Volume</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <TrendingUp className="w-4 h-4 text-yellow-400" />
                </div>
                <div className="text-lg font-bold text-white">{Math.round(workout.totalVolume / workout.duration)}</div>
                <div className="text-xs text-gray-400">Vol/Min</div>
              </div>
            </div>

            {/* Exercise Breakdown */}
            <div>
              <h4 className="text-sm font-medium text-white mb-3">Exercise Breakdown</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {workout.exercisesSummary.map((exercise, index) => (
                  <div
                    key={`${exercise.exerciseId}-${index}`}
                    className="flex items-center justify-between bg-gray-700 rounded p-3"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-white text-sm">{exercise.exerciseName}</div>
                      <div className="text-xs text-gray-400">
                        {exercise.sets} sets × {Math.round(exercise.reps / exercise.sets)} avg reps
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-white">{exercise.volume.toLocaleString()}</div>
                      <div className="text-xs text-gray-400">lbs</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Workout Notes */}
            {workout.notes && (
              <div className="mt-4 p-3 bg-gray-700 rounded">
                <h4 className="text-sm font-medium text-white mb-2">Notes</h4>
                <p className="text-sm text-gray-300">{workout.notes}</p>
              </div>
            )}

            {/* Workout Timeline */}
            <div className="mt-4 pt-3 border-t border-gray-600">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Started: {formatDate(workout.startTime)}</span>
                <span>•</span>
                <span>Completed: {formatDate(workout.endTime)}</span>
                <span>•</span>
                <span>Duration: {formatDuration(workout.duration)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <EditWorkoutModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={handleEditSuccess}
          userId={userId}
          workout={workout}
        />
      )}

      {/* Click outside to close actions menu */}
      {showActions && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowActions(false)}
        />
      )}
    </div>
  );
};