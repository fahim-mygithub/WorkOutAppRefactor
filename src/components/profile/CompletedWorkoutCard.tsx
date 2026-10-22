import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Calendar } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { WorkoutSummary } from '../../types/exerciseHistory';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { EditWorkoutModal } from './EditWorkoutModal';
import { startWorkout } from '../../store/slices/workoutSlice';
import { planAdded } from '../../store/slices/plannedWorkoutsSlice';
import { sanitizeWorkoutExercisesForRedux } from '../../utils/workoutConversion';
import { useExercises } from '../../hooks/useExercises';
import { reuseWorkoutExercises, preparePlannedWorkoutForExecution } from '../../lib/planWorkout';
import { toDateKey, addDaysKey } from '../../lib/dateKey';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../Toast';
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
 * notes, and the Use again / Edit / Delete actions) lives one tap away in a
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
  const trackedLifts = useAppSelector((state) => state.trackedLifts.lifts);
  const goal = useAppSelector((state) => state.trackedLifts.lastGoal) ?? 'volume';
  const { toasts, removeToast, showError, showInfo } = useToast();

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isUseAgainOpen, setIsUseAgainOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingStart, setIsLoadingStart] = useState(false);

  const tomorrowKey = addDaysKey(toDateKey(new Date()), 1);
  const [pickedDateKey, setPickedDateKey] = useState<string>(tomorrowKey);

  const formatDate = formatDateTime;

  const handleEdit = () => {
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
      showError('Failed to delete workout. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    onWorkoutUpdated?.();
  };

  const loadExercisesFromHistory = async () => {
    const workoutIdToQuery = workout.workoutId || workout.id;
    const histories = await ExerciseHistoryService.getExerciseHistoryByWorkoutId(
      userId,
      workoutIdToQuery
    );

    if (!histories.length) {
      showError("This workout has no exercise details, so it can't be reused.");
      return null;
    }

    const exercises = reuseWorkoutExercises(histories, exerciseDatabase, trackedLifts);
    if (exercises.length === 0) {
      showError('No valid exercises found in this workout.');
      return null;
    }
    return exercises;
  };

  const handleStartToday = async () => {
    if (isLoadingExercises || !exerciseDatabase.length) {
      showInfo('Exercise database is still loading. Please wait a moment and try again.');
      return;
    }

    setIsLoadingStart(true);
    try {
      const exercises = await loadExercisesFromHistory();
      if (!exercises) return;

      const readyExercises = preparePlannedWorkoutForExecution(
        {
          id: 'temp',
          dateKey: toDateKey(new Date()),
          name: workout.name,
          exercises,
          status: 'planned',
          createdAt: new Date().toISOString(),
        },
        trackedLifts,
        goal,
      );

      const sanitizedExercises = sanitizeWorkoutExercisesForRedux(readyExercises);
      dispatch(startWorkout({
        name: workout.name,
        exercises: sanitizedExercises,
      }));

      setIsUseAgainOpen(false);
      setIsDetailOpen(false);
      navigate('/workout');
    } catch (error) {
      console.error('Error starting workout from history:', error);
      showError('Failed to start workout. Please try again.');
    } finally {
      setIsLoadingStart(false);
    }
  };

  const handlePlanForDate = async () => {
    const today = toDateKey(new Date());
    if (!pickedDateKey || pickedDateKey < today) return;
    if (isLoadingExercises || !exerciseDatabase.length) {
      showInfo('Exercise database is still loading. Please wait a moment and try again.');
      return;
    }

    setIsLoadingStart(true);
    try {
      const exercises = await loadExercisesFromHistory();
      if (!exercises) return;

      const sanitizedExercises = sanitizeWorkoutExercisesForRedux(exercises);
      dispatch(
        planAdded({
          name: workout.name,
          dateKey: pickedDateKey,
          exercises: sanitizedExercises,
          source: { historyId: workout.id },
        }),
      );

      setIsUseAgainOpen(false);
      setIsDetailOpen(false);
      navigate('/');
    } catch (error) {
      console.error('Error planning workout from history:', error);
      showError('Failed to plan workout. Please try again.');
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

      {/* Main workout detail sheet */}
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
            <Button size="xl" onClick={() => setIsUseAgainOpen(true)} disabled={isLoadingStart}>
              Use again
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

      {/* "Use again" sheet */}
      <Sheet open={isUseAgainOpen} onOpenChange={setIsUseAgainOpen}>
        <SheetContent className="mx-auto max-w-lg">
          <SheetTitle>Use again</SheetTitle>
          <SheetDescription>
            Repeat &ldquo;{workout.name}&rdquo; today or schedule it for another day.
          </SheetDescription>

          <div className="mt-6 flex flex-col gap-5">
            <Button
              size="xl"
              variant="primary"
              onClick={handleStartToday}
              disabled={isLoadingStart}
              className="w-full"
            >
              <Play className="h-5 w-5" fill="currentColor" aria-hidden="true" />
              {isLoadingStart ? 'Loading…' : 'Today (start workout now)'}
            </Button>

            <div className="space-y-3 border-t border-hairline pt-4">
              <label htmlFor={`pick-date-${workout.id}`} className="block text-body-sm font-semibold text-ink">
                Or pick a date
              </label>
              <div className="flex gap-2">
                <Input
                  id={`pick-date-${workout.id}`}
                  type="date"
                  min={toDateKey(new Date())}
                  value={pickedDateKey}
                  onChange={(e) => setPickedDateKey(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="secondary"
                  onClick={handlePlanForDate}
                  disabled={!pickedDateKey || pickedDateKey < toDateKey(new Date()) || isLoadingStart}
                >
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  Save plan
                </Button>
              </div>
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
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </li>
  );
};
