import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateRestTimer, stopRestTimer, startRestTimer, adjustRestTimer, nextSet, advanceToNextSupersetRound, setShowCompletionModal, updateExercise } from '../store/slices/workoutSlice';
import { remainingSeconds, isElapsed } from '../lib/restTimer';
import { Play, RotateCcw, X, Plus, Minus } from 'lucide-react';
import { Button } from './ui/button';
import { IconButton } from './ui/icon-button';
import { cn } from '@/lib/utils';

interface RestTimerProps {
  className?: string;
  compact?: boolean;
}

export const RestTimer: React.FC<RestTimerProps> = ({
  className = '',
  compact = false
}) => {
  const dispatch = useAppDispatch();
  const { restTimer, activeWorkout } = useAppSelector((state) => state.workout);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(2);
  const [customSeconds, setCustomSeconds] = useState(0);

  // Get current exercise for rest time preference
  const currentExercise = activeWorkout?.exercises[activeWorkout.currentExerciseIndex];

  // Keep the latest activeWorkout reachable from stable callbacks (the
  // visibilitychange listener and the completion handler) without re-subscribing
  // listeners on every render.
  const activeWorkoutRef = useRef(activeWorkout);
  activeWorkoutRef.current = activeWorkout;

  // Guards completion from firing more than once for a single countdown. Keyed
  // on the targetEndTime so a new timer (new anchor) re-arms it.
  const completedForRef = useRef<number | null>(null);

  // Tracks the last whole-second we played a countdown beep for, so resuming
  // from background (which jumps several seconds at once) doesn't spam beeps.
  const lastBeepSecondRef = useRef<number | null>(null);

  // Advance the workout when the rest period elapses. Reads the workout through
  // a ref so it stays referentially stable for listeners.
  const handleCompletion = useCallback(() => {
    playCompletionSound();

    // Small delay for better UX (matches the prior behavior).
    setTimeout(() => {
      const workout = activeWorkoutRef.current;
      if (workout) {
        const currentExercise = workout.exercises[workout.currentExerciseIndex];
        const isLastExercise = workout.currentExerciseIndex === workout.exercises.length - 1;
        const isLastSet = workout.currentSetIndex === currentExercise.sets.length - 1;

        const totalSets = workout.exercises.reduce((total, ex) => total + ex.sets.length, 0);
        const completedSets = workout.exercises.reduce((total, ex) =>
          total + ex.sets.filter(set => set.completed).length, 0
        );

        if (isLastExercise && isLastSet && completedSets === totalSets) {
          dispatch(setShowCompletionModal(true));
        } else if (currentExercise.isSuperset && currentExercise.supersetId) {
          dispatch(advanceToNextSupersetRound());
        } else {
          dispatch(nextSet());
        }
      } else {
        dispatch(nextSet());
      }
    }, 1000);
  }, [dispatch]);

  // Single sync function: derive the remaining time from the absolute
  // targetEndTime against the current clock, push it to the store, fire the
  // countdown beeps, and trigger completion if the anchor has elapsed. Called on
  // each 1s tick AND on visibilitychange/resume, so returning to a backgrounded
  // tab immediately shows the correct time (or completes if already elapsed).
  const syncFromTargetEndTime = useCallback(() => {
    const { isActive, targetEndTime } = restTimerRef.current;
    if (!isActive || targetEndTime == null) return;

    const now = Date.now();
    const remaining = remainingSeconds(targetEndTime, now);
    dispatch(updateRestTimer(remaining));

    // Countdown beeps for the final 3 seconds, once per second, and never when
    // we jumped past them during a background gap.
    if (remaining <= 3 && remaining > 0 && lastBeepSecondRef.current !== remaining) {
      lastBeepSecondRef.current = remaining;
      playBeep();
    }

    if (isElapsed(targetEndTime, now)) {
      if (completedForRef.current !== targetEndTime) {
        completedForRef.current = targetEndTime;
        handleCompletion();
      }
    }
  }, [dispatch, handleCompletion]);

  // Hold the latest restTimer slice so the stable sync callback reads current
  // values without being re-created (which would thrash the interval/listener).
  const restTimerRef = useRef(restTimer);
  restTimerRef.current = restTimer;

  useEffect(() => {
    if (!restTimer.isActive || restTimer.targetEndTime == null) {
      // Re-arm guards for the next countdown.
      lastBeepSecondRef.current = null;
      return;
    }

    // Immediately reconcile (covers the start tick and any anchor change).
    syncFromTargetEndTime();

    const interval = setInterval(syncFromTargetEndTime, 1000);

    // Recompute the instant the tab/app returns to the foreground. Background
    // timers throttle or freeze, so this is what makes the displayed time
    // correct on resume — and fires completion if the rest already elapsed
    // while we were away.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncFromTargetEndTime();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [restTimer.isActive, restTimer.targetEndTime, syncFromTargetEndTime]);

  const playBeep = () => {
    // Create a short beep sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  };

  const playCompletionSound = () => {
    // Create a completion sound sequence
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    [523, 659, 784].forEach((freq, index) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + index * 0.15);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + index * 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + index * 0.15 + 0.2);

      oscillator.start(audioContext.currentTime + index * 0.15);
      oscillator.stop(audioContext.currentTime + index * 0.15 + 0.2);
    });
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    if (restTimer.timeRemaining === 0) {
      dispatch(startRestTimer({ duration: restTimer.duration }));
    } else {
      dispatch(startRestTimer({ duration: restTimer.timeRemaining }));
    }
  };

  const handleStop = () => {
    dispatch(stopRestTimer());
    // Auto-advance to next set when stopping the timer (skip rest)
    // Check if we're in a superset and need special handling
    if (activeWorkout) {
      const currentExercise = activeWorkout.exercises[activeWorkout.currentExerciseIndex];
      if (currentExercise.isSuperset && currentExercise.supersetId) {
        dispatch(advanceToNextSupersetRound());
      } else {
        dispatch(nextSet());
      }
    } else {
      dispatch(nextSet());
    }
  };

  const handleReset = () => {
    dispatch(startRestTimer({ duration: restTimer.duration }));
  };

  const handleSetDuration = (duration: number, saveAsDefault: boolean = true) => {
    dispatch(startRestTimer({ duration }));

    // Save this duration as the exercise's default rest time
    if (saveAsDefault && currentExercise && activeWorkout) {
      dispatch(updateExercise({
        exerciseId: currentExercise.id,
        sets: currentExercise.sets,
        restTime: duration
      }));
    }
  };

  const handleCustomTimer = () => {
    const duration = customMinutes * 60 + customSeconds;
    handleSetDuration(duration, true);
    setShowCustomInput(false);
  };

  const adjustCustomTime = (minutes: number, seconds: number) => {
    const newMinutes = Math.max(0, customMinutes + minutes);
    const newSeconds = Math.max(0, Math.min(59, customSeconds + seconds));
    setCustomMinutes(newMinutes);
    setCustomSeconds(newSeconds);
  };

  const isPresetActive = (duration: number) => {
    return currentExercise?.restTime === duration;
  };

  const remainingFraction = restTimer.duration > 0
    ? Math.max(0, Math.min(1, restTimer.timeRemaining / restTimer.duration))
    : 1;

  const presetClass = (duration: number) => cn(
    'min-h-touch-min rounded-full font-num font-tabular text-body-sm font-semibold transition-colors duration-snap',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle',
    isPresetActive(duration)
      ? 'bg-accent-2 text-accent-2-fg'
      : 'bg-surface-raised text-ink hover:bg-surface-raised/70',
  );

  if (compact && !restTimer.isActive && restTimer.timeRemaining === 0) {
    return (
      <div role="group" aria-label="Start rest" className={cn('grid grid-cols-4 gap-2', className)}>
        {COMPACT_PRESETS.map((p) => (
          <button
            key={p.seconds}
            type="button"
            aria-pressed={isPresetActive(p.seconds)}
            onClick={() => handleSetDuration(p.seconds)}
            className={presetClass(p.seconds)}
          >
            {p.label}
          </button>
        ))}
      </div>
    );
  }

  const ringSize = compact ? 160 : 220;
  const ringR = ringSize / 2 - 10;
  const ringC = 2 * Math.PI * ringR;

  return (
    <section aria-label="Rest timer" className={cn('rounded-3xl bg-surface-subtle p-5', className)}>
      <div className="flex min-h-touch-min items-center justify-between">
        <p className="text-body-sm font-semibold text-ink-muted">Rest</p>
        {restTimer.isActive && (
          <IconButton variant="secondary" onClick={handleStop} aria-label="Stop timer">
            <X size={18} />
          </IconButton>
        )}
      </div>

      {/* Countdown ring: amber drains as the rest runs down. */}
      <div className="relative mx-auto my-2 aspect-square" style={{ width: ringSize }}>
        <svg viewBox={`0 0 ${ringSize} ${ringSize}`} className="h-full w-full" aria-hidden="true">
          <circle cx={ringSize / 2} cy={ringSize / 2} r={ringR} fill="none" strokeWidth="12" className="stroke-surface-raised" />
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={ringR}
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={ringC}
            strokeDashoffset={ringC * (1 - remainingFraction)}
            transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
            className="stroke-accent"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            role="timer"
            aria-label={`${formatTime(restTimer.timeRemaining)} of rest left`}
            className={cn(
              'font-display font-tabular leading-none text-ink',
              compact ? 'text-display' : 'text-metric',
            )}
          >
            {formatTime(restTimer.timeRemaining)}
          </span>
          {restTimer.duration > 0 && (
            <span className="mt-2 text-body-sm text-ink-muted">
              of {formatTime(restTimer.duration)}
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      {restTimer.isActive ? (
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" size="lg" className="flex-1 px-3" onClick={() => dispatch(adjustRestTimer(-15))}>
            −15s
          </Button>
          <Button variant="secondary" size="lg" className="flex-1 px-3" onClick={() => dispatch(adjustRestTimer(15))}>
            +15s
          </Button>
          <Button variant="primary" size="lg" className="flex-1 px-3" onClick={handleStop}>
            Skip
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button variant="primary" size="lg" className="flex-1" onClick={handleStart}>
            <Play size={18} fill="currentColor" aria-hidden="true" />
            <span>Start</span>
          </Button>
          <Button variant="secondary" size="lg" className="flex-1" onClick={handleReset}>
            <RotateCcw size={18} aria-hidden="true" />
            <span>Reset</span>
          </Button>
        </div>
      )}

      {/* Duration presets */}
      {!compact && (
        <div className="mt-5">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-body-sm text-ink-muted">Quick start</p>
            {currentExercise?.restTime && (
              <p className="text-caption text-accent-2">
                Default{' '}
                <span className="font-num font-tabular">{formatTime(currentExercise.restTime)}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.seconds}
                type="button"
                aria-pressed={isPresetActive(p.seconds)}
                onClick={() => handleSetDuration(p.seconds)}
                className={presetClass(p.seconds)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom length, one tap away */}
          <div className="mt-4">
            {!showCustomInput ? (
              <Button variant="ghost" className="w-full" onClick={() => setShowCustomInput(true)}>
                Custom length
              </Button>
            ) : (
              <div className="rounded-2xl bg-surface-raised/50 p-4">
                <p className="mb-3 text-body-sm font-semibold text-ink">Custom length</p>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <IconButton variant="secondary" onClick={() => adjustCustomTime(-1, 0)} aria-label="Minus one minute">
                      <Minus size={16} />
                    </IconButton>
                    <span className="w-10 text-center font-num font-tabular text-body font-semibold text-ink">{customMinutes}m</span>
                    <IconButton variant="secondary" onClick={() => adjustCustomTime(1, 0)} aria-label="Plus one minute">
                      <Plus size={16} />
                    </IconButton>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <IconButton variant="secondary" onClick={() => adjustCustomTime(0, -15)} aria-label="Minus fifteen seconds">
                      <Minus size={16} />
                    </IconButton>
                    <span className="w-10 text-center font-num font-tabular text-body font-semibold text-ink">{customSeconds}s</span>
                    <IconButton variant="secondary" onClick={() => adjustCustomTime(0, 15)} aria-label="Plus fifteen seconds">
                      <Plus size={16} />
                    </IconButton>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={handleCustomTimer}>
                    Start {customMinutes}:{customSeconds.toString().padStart(2, '0')}
                  </Button>
                  <Button variant="ghost" onClick={() => setShowCustomInput(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rest complete */}
      {restTimer.timeRemaining === 0 && !restTimer.isActive && restTimer.duration > 0 && (
        <p role="status" className="mt-4 text-center text-body-sm text-accent-2">
          Rest complete. Moving to the next set.
        </p>
      )}
    </section>
  );
};

const PRESETS: Array<{ label: string; seconds: number }> = [
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
  { label: '1.5m', seconds: 90 },
  { label: '2m', seconds: 120 },
  { label: '3m', seconds: 180 },
  { label: '5m', seconds: 300 },
];

const COMPACT_PRESETS: Array<{ label: string; seconds: number }> = [
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
  { label: '2m', seconds: 120 },
  { label: '3m', seconds: 180 },
];
