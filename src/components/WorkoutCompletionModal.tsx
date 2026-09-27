import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useAuth } from '../contexts/AuthContext';
import { endWorkout, setShowCompletionModal } from '../store/slices/workoutSlice';
import { WorkoutStorageService } from '../services/workoutStorageService';
import { sessionsRecorded } from '../store/slices/trackedLiftsSlice';
import { trackedSessionsFromWorkout } from '../lib/trackedLiftProgression';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface WorkoutCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WorkoutCompletionModal: React.FC<WorkoutCompletionModalProps> = ({
  isOpen,
  onClose
}) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { activeWorkout } = useAppSelector((state) => state.workout);
  const trackedLifts = useAppSelector((state) => state.trackedLifts.lifts);
  const { user } = useAuth();
  const [isCompleting, setIsCompleting] = useState(false);
  // Compact clock for the summary: 1:05:09 / 42:07.
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const ss = String(seconds % 60).padStart(2, '0');
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
    }
    return `${minutes}:${ss}`;
  };

  const calculateStats = () => {
    if (!activeWorkout || !activeWorkout.exercises) {
      return { totalSets: 0, completedSets: 0, totalVolume: 0, totalReps: 0 };
    }

    const totalSets = activeWorkout.exercises.reduce((total, ex) => total + (ex.sets?.length || 0), 0);
    const completedSets = activeWorkout.exercises.reduce((total, ex) =>
      total + (ex.sets?.filter(set => set.completed).length || 0), 0
    );
    const totalVolume = activeWorkout.exercises.reduce((total, ex) =>
      total + (ex.sets || [])
        .filter(set => set.completed)
        .reduce((setTotal, set) => setTotal + ((set.weight || 0) * (set.reps || 0)), 0), 0
    );
    const totalReps = activeWorkout.exercises.reduce((total, ex) =>
      total + (ex.sets || [])
        .filter(set => set.completed)
        .reduce((setTotal, set) => setTotal + (set.reps || 0), 0), 0
    );

    return { totalSets, completedSets, totalVolume, totalReps };
  };

  const handleCompleteWorkout = async () => {
    if (!activeWorkout || !user?.uid) {
      console.error('Missing required data for workout completion');
      return;
    }

    setIsCompleting(true);
    try {
      await WorkoutStorageService.saveCompletedWorkout(user.uid, activeWorkout);
      console.log('Workout saved successfully');
      // Tracked lifts: log the sessions, move each cycle, queue new bests.
      dispatch(
        sessionsRecorded({
          date: new Date().toISOString(),
          entries: trackedSessionsFromWorkout(activeWorkout.exercises, trackedLifts),
        }),
      );
      dispatch(endWorkout());
      dispatch(setShowCompletionModal(false));
      navigate('/profile', { state: { showWorkoutComplete: true } });
    } catch (error) {
      console.error('Error saving workout:', error);

      // Show user-friendly error message
      alert('Failed to save workout. Your progress will still be ended. Please check your connection and try again.');

      // Tracked lifts: log the sessions, move each cycle, queue new bests.
      dispatch(
        sessionsRecorded({
          date: new Date().toISOString(),
          entries: trackedSessionsFromWorkout(activeWorkout.exercises, trackedLifts),
        }),
      );
      // Still end the workout even if save fails to prevent user from being stuck
      dispatch(endWorkout());
      dispatch(setShowCompletionModal(false));
      navigate('/profile');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleContinueEditing = () => {
    dispatch(setShowCompletionModal(false));
  };

  const stats = calculateStats();

  if (!activeWorkout) return null;

  const summary = [
    { value: formatTime(activeWorkout.duration), label: 'time' },
    { value: `${stats.completedSets}/${stats.totalSets}`, label: 'sets' },
    { value: stats.totalReps.toLocaleString(), label: 'reps' },
    { value: stats.totalVolume.toLocaleString(), label: 'lb moved' },
  ];

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent className="max-w-md sm:mx-auto">
        <p className="text-body-sm text-accent-2">{activeWorkout.name}</p>
        <SheetTitle className="mt-1 font-display text-display text-ink">Workout complete</SheetTitle>
        <SheetDescription className="sr-only">
          Your session summary. Save it to your history or keep editing.
        </SheetDescription>

        {/* The numbers do the celebrating. */}
        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5">
          {summary.map((s) => (
            <div key={s.label} className="min-w-0">
              <dt className="sr-only">{s.label}</dt>
              <dd className="truncate font-display font-tabular text-display text-ink">{s.value}</dd>
              <dd aria-hidden="true" className="text-body-sm text-ink-muted">{s.label}</dd>
            </div>
          ))}
        </dl>

        {/* Exercises: quiet rows, hairlines between. */}
        <section aria-label="Exercises" className="mt-6">
          <ul className="max-h-40 overflow-y-auto">
            {activeWorkout.exercises.map((exercise) => {
              const completedSets = exercise.sets.filter(set => set.completed).length;
              const allDone = completedSets === exercise.sets.length && completedSets > 0;
              return (
                <li
                  key={exercise.id}
                  className="flex min-h-touch-min items-center justify-between gap-3 border-b border-hairline py-2 last:border-b-0"
                >
                  <span className="min-w-0 truncate text-body-sm text-ink">{exercise.exercise.name}</span>
                  <span className={allDone ? 'shrink-0 text-body-sm text-accent-2' : 'shrink-0 text-body-sm text-ink-muted'}>
                    <span className="font-num font-tabular">{completedSets}/{exercise.sets.length}</span> sets
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="mt-8 flex flex-col gap-2">
          <Button
            size="xl"
            onClick={handleCompleteWorkout}
            disabled={isCompleting}
            aria-busy={isCompleting}
          >
            {isCompleting ? 'Saving…' : 'Save workout'}
          </Button>
          <Button variant="ghost" size="lg" onClick={handleContinueEditing}>
            Keep editing
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
