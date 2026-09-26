import React, { useState } from 'react';
import { ActiveWorkout } from '../types/exercise';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface EndWorkoutModalProps {
  isOpen: boolean;
  activeWorkout: ActiveWorkout;
  onClose: () => void;
  onEndWithoutSaving: () => void;
  onSaveAndEnd: () => void;
  isAnonymousUser?: boolean;
  isSharedWorkout?: boolean;
}

// Compact clock for the summary: 1:05:09 / 42:07.
const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const ss = String(remainingSeconds).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  }
  return `${minutes}:${ss}`;
};

/**
 * End-workout sheet (Tempo). Part of the live flow, so it stays calm and fast:
 * the workout name, three quiet numbers, and one amber action. "End without
 * saving" is the only destructive outcome and is the only thing in danger red.
 */
export const EndWorkoutModal: React.FC<EndWorkoutModalProps> = ({
  isOpen,
  activeWorkout,
  onClose,
  onEndWithoutSaving,
  onSaveAndEnd,
  isAnonymousUser = false,
}) => {
  const [isEnding, setIsEnding] = useState(false);

  const calculateStats = () => {
    if (!activeWorkout || !activeWorkout.exercises) {
      return { totalSets: 0, completedSets: 0, totalVolume: 0, totalReps: 0, completionPercentage: 0 };
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
    const completionPercentage = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

    return { totalSets, completedSets, totalVolume, totalReps, completionPercentage };
  };

  const handleEndWithoutSaving = async () => {
    setIsEnding(true);
    try {
      await onEndWithoutSaving();
    } finally {
      setIsEnding(false);
    }
  };

  const handleSaveAndEnd = async () => {
    setIsEnding(true);
    try {
      await onSaveAndEnd();
    } finally {
      setIsEnding(false);
    }
  };

  const stats = calculateStats();
  const summary = [
    { value: formatTime(activeWorkout.duration), label: 'time' },
    { value: `${stats.completedSets}/${stats.totalSets}`, label: 'sets done' },
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
        <p className="text-body-sm text-ink-muted">{activeWorkout.name}</p>
        <SheetTitle className="mt-1 font-display text-display text-ink">End workout?</SheetTitle>
        <SheetDescription className="sr-only">
          Save this workout to your history or end it without saving.
        </SheetDescription>

        <dl className="mt-6 grid grid-cols-3 gap-3">
          {summary.map((s) => (
            <div key={s.label} className="min-w-0">
              <dt className="sr-only">{s.label}</dt>
              <dd className="truncate font-display font-tabular text-title text-ink">{s.value}</dd>
              <dd aria-hidden="true" className="text-body-sm text-ink-muted">{s.label}</dd>
            </div>
          ))}
        </dl>

        <div
          role="progressbar"
          aria-label="Sets completed"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={stats.completionPercentage}
          className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-surface-raised"
        >
          <div
            className="h-full rounded-full bg-accent-2 transition-[width] duration-smooth"
            style={{ width: `${stats.completionPercentage}%` }}
          />
        </div>

        <div className="mt-8 flex flex-col gap-2">
          {isAnonymousUser ? (
            <>
              <p className="mb-2 text-body-sm text-ink-muted">
                Sign up to keep your workouts and see your progress over time.
              </p>
              <Button size="xl" onClick={handleEndWithoutSaving} disabled={isEnding}>
                End workout
              </Button>
              <Button variant="ghost" size="lg" onClick={onClose} disabled={isEnding}>
                Keep training
              </Button>
            </>
          ) : (
            <>
              <Button size="xl" onClick={handleSaveAndEnd} disabled={isEnding} aria-busy={isEnding}>
                {isEnding ? 'Saving…' : 'Save and end'}
              </Button>
              <Button variant="ghost" size="lg" onClick={onClose} disabled={isEnding}>
                Keep training
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="text-danger hover:text-danger"
                onClick={handleEndWithoutSaving}
                disabled={isEnding}
                aria-describedby="end-without-saving-hint"
              >
                End without saving
              </Button>
              <p id="end-without-saving-hint" className="text-center text-caption text-ink-subtle">
                Ending without saving discards this session.
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
