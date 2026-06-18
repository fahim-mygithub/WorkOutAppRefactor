import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useAuth } from '../contexts/AuthContext';
import { endWorkout, setShowCompletionModal } from '../store/slices/workoutSlice';
import { WorkoutStorageService } from '../services/workoutStorageService';
import { Trophy, Clock, Target, TrendingUp, Check, Edit3 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Stack } from '@/components/ui/stack';

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
  const { user } = useAuth();
  const [isCompleting, setIsCompleting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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
      console.log('✅ Workout saved successfully');
      dispatch(endWorkout());
      dispatch(setShowCompletionModal(false));
      navigate('/profile', { state: { showWorkoutComplete: true } });
    } catch (error) {
      console.error('❌ Error saving workout:', error);

      // Show user-friendly error message
      alert('Failed to save workout. Your progress will still be ended. Please check your connection and try again.');

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

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent className="max-w-md overflow-hidden sm:mx-auto">
        {/* Confetti Effect */}
        {showConfetti && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={i}
                className="absolute h-2 w-2 animate-bounce rounded bg-accent"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${1 + Math.random() * 2}s`
                }}
              />
            ))}
          </div>
        )}

        {/* Header */}
        <div className="mb-6 text-center">
          <Trophy className="mx-auto mb-2 h-16 w-16 animate-pulse text-warning" aria-hidden="true" />
          <SheetTitle className="text-title font-marker"><span className="marker-underline">Workout Complete!</span></SheetTitle>
          <SheetDescription>
            Congratulations on finishing your workout
          </SheetDescription>
        </div>

        {/* Workout Summary */}
        <h3 className="mb-4 text-body font-bold text-ink font-marker">{activeWorkout.name}</h3>

        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-surface-subtle p-4 text-center">
            <Clock className="mx-auto mb-2 h-6 w-6 text-accent" aria-hidden="true" />
            <div className="text-body-sm text-ink-subtle font-marker">Duration</div>
            <div className="text-body font-bold text-ink font-num font-tabular">{formatTime(activeWorkout.duration)}</div>
          </div>

          <div className="rounded-lg bg-surface-subtle p-4 text-center">
            <Target className="mx-auto mb-2 h-6 w-6 text-success" aria-hidden="true" />
            <div className="text-body-sm text-ink-subtle font-marker">Sets Completed</div>
            <div className="text-body font-bold text-ink font-num font-tabular">{stats.completedSets}/{stats.totalSets}</div>
          </div>

          <div className="rounded-lg bg-surface-subtle p-4 text-center">
            <TrendingUp className="mx-auto mb-2 h-6 w-6 text-accent" aria-hidden="true" />
            <div className="text-body-sm text-ink-subtle font-marker">Total Reps</div>
            <div className="text-body font-bold text-ink font-num font-tabular">{stats.totalReps.toLocaleString()}</div>
          </div>

          <div className="rounded-lg bg-surface-subtle p-4 text-center">
            <Trophy className="mx-auto mb-2 h-6 w-6 text-warning" aria-hidden="true" />
            <div className="text-body-sm text-ink-subtle font-marker">Volume</div>
            <div className="text-body font-bold text-ink"><span className="font-num font-tabular">{stats.totalVolume.toLocaleString()}</span> lbs</div>
          </div>
        </div>

        {/* Exercises Summary */}
        <div className="mb-6">
          <h4 className="mb-3 text-body font-semibold text-ink font-marker">Exercises Completed</h4>
          <div className="max-h-32 space-y-2 overflow-y-auto">
            {activeWorkout.exercises.map((exercise) => {
              const completedSets = exercise.sets.filter(set => set.completed).length;
              return (
                <Stack
                  key={exercise.id}
                  direction="row"
                  align="center"
                  justify="between"
                  className="rounded bg-surface-subtle p-2"
                >
                  <span className="text-body-sm text-ink">{exercise.exercise.name}</span>
                  <span className="text-caption text-ink-subtle"><span className="font-num font-tabular">{completedSets}/{exercise.sets.length}</span> sets</span>
                </Stack>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <Stack direction="row" gap={3}>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={handleContinueEditing}
          >
            <Edit3 className="h-5 w-5" aria-hidden="true" />
            <span>Continue Editing</span>
          </Button>

          <Button
            className="flex-1 bg-success hover:bg-success/90 text-ink-inverse"
            onClick={handleCompleteWorkout}
            disabled={isCompleting}
          >
            {isCompleting ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink-inverse border-t-transparent" />
            ) : (
              <Check className="h-5 w-5" aria-hidden="true" />
            )}
            <span>{isCompleting ? 'Saving...' : 'Complete Workout'}</span>
          </Button>
        </Stack>
      </SheetContent>
    </Sheet>
  );
};
