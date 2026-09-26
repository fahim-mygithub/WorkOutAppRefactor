import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../store/hooks';
import { WorkoutSummary } from '../../types/exerciseHistory';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { EditWorkoutModal } from './EditWorkoutModal';
import { startWorkout } from '../../store/slices/workoutSlice';
import { convertWorkoutHistoryToExercises, sanitizeWorkoutExercisesForRedux } from '../../utils/workoutConversion';
import { useExercises } from '../../hooks/useExercises';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { formatDateTime, formatDuration, formatShortDate } from './historyFormat';

interface CompletedWorkoutCardProps {
  workout: WorkoutSummary;
  className?: string;
  onWorkoutUpdated?: () => void;
  onWorkoutDeleted?: () => void;
  userId: string;
}

const timeOnly = (date: Date | string): string => {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(d);
};

/**
 * One completed session in the History list (Tempo).
 *
 * The row is the glance: name, when, how long, and the session volume in the
 * number voice. Everything else (the stat block, per-exercise breakdown,
 * notes, and the Start again / Edit / Delete actions) lives one tap away in a
 * detail sheet. Renders an `<li>`: the parent supplies the `<ul>` card and the
 * hairline dividers.
 */
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
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingStart, setIsLoadingStart] = useState(false);

  const formatDate = formatDateTime;

  const handleEdit = () => {
    // Close the detail sheet first so two dialogs never fight over focus.
    setIsDetailOpen(false);
    setIsEditModalOpen(true);
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the workout "${workout.name}" from ${formatDate(workout.endTime)}?\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    try {
      await ExerciseHistoryService.deleteWorkoutHistory(userId, workout.id);
      setIsDetailOpen(false);
      onWorkoutDeleted?.();
    } catch (error) {
      console.error('Error deleting workout:', error);
      alert('Failed to delete workout. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    onWorkoutUpdated?.();
  };

  const handleStartWorkout = async () => {
    if (isLoadingExercises || !exerciseDatabase.length) {
      alert('Exercise database is still loading. Please wait a moment and try again.');
      return;
    }

    setIsLoadingStart(true);

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

  const stats: { label: string; value: string }[] = [
    { label: 'Sets', value: workout.totalSets.toLocaleString() },
    { label: 'Reps', value: workout.totalReps.toLocaleString() },
    { label: 'Volume', value: workout.totalVolume.toLocaleString() },
    { label: 'Duration', value: formatDuration(workout.duration) },
  ];

  return (
    <li className={className}>
      <button
        type="button"
        onClick={() => setIsDetailOpen(true)}
        aria-haspopup="dialog"
        className="flex min-h-[64px] w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-snap hover:bg-surface-raised/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-body font-semibold text-ink">{workout.name}</span>
            {workout.templateId && (
              <span className="shrink-0 rounded-full bg-surface-raised px-2 text-caption text-ink-muted">
                Template
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-body-sm text-ink-muted">
            {formatShortDate(workout.endTime)} · {formatDuration(workout.duration)} · {workout.totalSets} sets
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-num font-tabular font-wide text-title font-bold text-ink">
            {workout.totalVolume.toLocaleString()}
          </span>
          <span className="block text-caption text-ink-muted">volume</span>
        </span>
      </button>

      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="mx-auto max-w-lg">
          <SheetTitle className="text-title">{workout.name}</SheetTitle>
          <SheetDescription>
            {formatShortDate(workout.startTime)} · {timeOnly(workout.startTime)} to {timeOnly(workout.endTime)}
          </SheetDescription>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
            {stats.map((s) => (
              <div key={s.label} className="flex min-w-0 flex-col-reverse">
                <dt className="mt-1.5 text-caption text-ink-muted">{s.label}</dt>
                <dd className="truncate font-display font-tabular text-display leading-none text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>

          {workout.exercisesSummary.length > 0 && (
            <section aria-label="Exercises" className="mt-6">
              <h3 className="mb-2 text-body-sm font-semibold text-ink">
                {workout.totalExercises} exercise{workout.totalExercises === 1 ? '' : 's'}
              </h3>
              <ul className="overflow-hidden rounded-2xl bg-surface">
                {workout.exercisesSummary.map((exercise, index) => (
                  <li
                    key={`${exercise.exerciseId}-${index}`}
                    className={cn('flex items-center gap-4 px-4 py-3', index > 0 && 'border-t border-hairline')}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-sm font-semibold text-ink">{exercise.exerciseName}</span>
                      <span className="block text-caption text-ink-muted">
                        {exercise.sets} sets · {Math.round(exercise.reps / exercise.sets)} reps avg
                      </span>
                    </span>
                    <span className="shrink-0 font-num font-tabular text-body font-semibold text-ink">
                      {exercise.volume.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {workout.notes && (
            <section aria-label="Notes" className="mt-6">
              <h3 className="mb-1 text-body-sm font-semibold text-ink">Notes</h3>
              <p className="text-body-sm text-ink-muted">{workout.notes}</p>
            </section>
          )}

          <div className="mt-6 flex flex-col gap-2">
            <Button size="xl" onClick={handleStartWorkout} disabled={isLoadingStart}>
              {isLoadingStart ? 'Loading…' : 'Start again'}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={handleEdit}>
                Edit
              </Button>
              <Button
                variant="ghost"
                className="text-danger hover:text-danger"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {isEditModalOpen && (
        <EditWorkoutModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={handleEditSuccess}
          userId={userId}
          workout={workout}
        />
      )}
    </li>
  );
};
