import React, { useState } from 'react';
import { Clock, Target, TrendingUp, Trophy, AlertTriangle, Save, X, ArrowLeft } from 'lucide-react';
import { ActiveWorkout } from '../types/exercise';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Stack } from '@/components/ui/stack';

interface EndWorkoutModalProps {
  isOpen: boolean;
  activeWorkout: ActiveWorkout;
  onClose: () => void;
  onEndWithoutSaving: () => void;
  onSaveAndEnd: () => void;
  isAnonymousUser?: boolean;
  isSharedWorkout?: boolean;
}

export const EndWorkoutModal: React.FC<EndWorkoutModalProps> = ({
  isOpen,
  activeWorkout,
  onClose,
  onEndWithoutSaving,
  onSaveAndEnd,
  isAnonymousUser = false,
  isSharedWorkout = false
}) => {
  const [isEnding, setIsEnding] = useState(false);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  };

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

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent className="max-w-md sm:mx-auto">
        {/* Header */}
        <div className="mb-6">
          <SheetTitle className="text-title font-marker"><span className="marker-underline">End Workout</span></SheetTitle>
          <SheetDescription>
            Choose how you'd like to finish your workout
          </SheetDescription>
        </div>

        {/* Workout Summary */}
        <h3 className="mb-4 text-body font-semibold text-ink font-marker">
          {activeWorkout.name}
        </h3>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-surface-subtle p-3 text-center">
            <Clock className="mx-auto mb-1 h-5 w-5 text-accent" aria-hidden="true" />
            <div className="text-caption text-ink-subtle font-marker">Duration</div>
            <div className="text-body-sm font-bold text-ink font-num font-tabular">{formatTime(activeWorkout.duration)}</div>
          </div>

          <div className="rounded-lg bg-surface-subtle p-3 text-center">
            <Target className="mx-auto mb-1 h-5 w-5 text-success" aria-hidden="true" />
            <div className="text-caption text-ink-subtle font-marker">Sets Complete</div>
            <div className="text-body-sm font-bold text-ink font-num font-tabular">{stats.completedSets}/{stats.totalSets}</div>
          </div>

          <div className="rounded-lg bg-surface-subtle p-3 text-center">
            <TrendingUp className="mx-auto mb-1 h-5 w-5 text-accent" aria-hidden="true" />
            <div className="text-caption text-ink-subtle font-marker">Total Reps</div>
            <div className="text-body-sm font-bold text-ink font-num font-tabular">{stats.totalReps.toLocaleString()}</div>
          </div>

          <div className="rounded-lg bg-surface-subtle p-3 text-center">
            <Trophy className="mx-auto mb-1 h-5 w-5 text-warning" aria-hidden="true" />
            <div className="text-caption text-ink-subtle font-marker">Volume</div>
            <div className="text-body-sm font-bold text-ink"><span className="font-num font-tabular">{stats.totalVolume.toLocaleString()}</span> lbs</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <Stack direction="row" justify="between" className="mb-2">
            <span className="text-body-sm text-ink-subtle font-marker">Workout Progress</span>
            <span className="text-body-sm text-ink-subtle"><span className="font-num font-tabular">{stats.completionPercentage}</span>%</span>
          </Stack>
          <div className="h-2 w-full rounded-full bg-surface-subtle">
            <div
              className="h-2 rounded-full bg-accent transition-all duration-smooth"
              style={{ width: `${stats.completionPercentage}%` }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {isAnonymousUser ? (
            // Anonymous user buttons
            <>
              {/* End Session (only option for anonymous users) */}
              <Button
                className="w-full"
                onClick={handleEndWithoutSaving}
                disabled={isEnding}
              >
                <X className="h-5 w-5" aria-hidden="true" />
                <span>End Session</span>
              </Button>

              {/* Anonymous user notice */}
              <div className="rounded-lg border border-warning bg-warning/10 p-3">
                <p className="text-center text-caption text-ink-muted">
                  💡 Sign up to save your workout progress and track your fitness journey!
                </p>
              </div>

              {/* Continue Workout */}
              <Button
                variant="secondary"
                className="w-full"
                onClick={onClose}
                disabled={isEnding}
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                <span>Continue Workout</span>
              </Button>
            </>
          ) : (
            // Authenticated user buttons
            <>
              {/* Save and End */}
              <Button
                className="w-full bg-success hover:bg-success/90 text-ink-inverse"
                onClick={handleSaveAndEnd}
                disabled={isEnding}
              >
                {isEnding ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink-inverse border-t-transparent" />
                ) : (
                  <Save className="h-5 w-5" aria-hidden="true" />
                )}
                <span>{isEnding ? 'Saving...' : 'Save to Profile'}</span>
              </Button>

              {/* End Without Saving */}
              <Button
                variant="danger"
                className="w-full"
                onClick={handleEndWithoutSaving}
                disabled={isEnding}
              >
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                <span>End Without Saving</span>
              </Button>

              {/* Warning text for end without saving */}
              <p className="text-center text-caption text-ink-subtle">
                ⚠️ Ending without saving will lose all workout progress
              </p>

              {/* Continue Workout */}
              <Button
                variant="secondary"
                className="w-full"
                onClick={onClose}
                disabled={isEnding}
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                <span>Continue Workout</span>
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
