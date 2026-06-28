// RestTimerBar — the rest timer as a single thin bar that lives at the bottom of
// the player (above the bottom nav). Collapsed it's just a button: tap to start
// the default rest, or tap the chevron to open quick presets + a custom timer.
// While a rest runs, the bar becomes the countdown (its background fills as a
// progress bar) and tapping it skips ahead.
//
// This component also OWNS the countdown engine (the 1s tick, background-resume
// reconciliation, beeps, and auto-advance on completion) — ported verbatim from
// the old <RestTimer> widget — so exactly one engine runs on the workout page.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronUp, Pause, Play, Plus, Minus, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  updateRestTimer,
  stopRestTimer,
  startRestTimer,
  nextSet,
  advanceToNextSupersetRound,
  setShowCompletionModal,
  updateExercise,
} from '../../../store/slices/workoutSlice';
import { remainingSeconds, isElapsed } from '../../../lib/restTimer';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const PRESETS: Array<{ label: string; seconds: number }> = [
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
  { label: '1.5m', seconds: 90 },
  { label: '2m', seconds: 120 },
  { label: '3m', seconds: 180 },
  { label: '5m', seconds: 300 },
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// --- sound helpers (ported from RestTimer) ---
function playBeep() {
  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);
}
function playCompletionSound() {
  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  [523, 659, 784].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.2);
    osc.start(ctx.currentTime + i * 0.15);
    osc.stop(ctx.currentTime + i * 0.15 + 0.2);
  });
}

export const RestTimerBar: React.FC = () => {
  const dispatch = useAppDispatch();
  const { restTimer, activeWorkout } = useAppSelector((s) => s.workout);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(2);
  const [customSeconds, setCustomSeconds] = useState(0);

  const currentExercise = activeWorkout?.exercises[activeWorkout.currentExerciseIndex];
  const defaultDuration = currentExercise?.restTime || 120;

  // --- countdown engine (ported from RestTimer) ---
  const activeWorkoutRef = useRef(activeWorkout);
  activeWorkoutRef.current = activeWorkout;
  const restTimerRef = useRef(restTimer);
  restTimerRef.current = restTimer;
  const completedForRef = useRef<number | null>(null);
  const lastBeepSecondRef = useRef<number | null>(null);

  const handleCompletion = useCallback(() => {
    playCompletionSound();
    setTimeout(() => {
      const workout = activeWorkoutRef.current;
      if (workout) {
        const exercise = workout.exercises[workout.currentExerciseIndex];
        const isLastExercise = workout.currentExerciseIndex === workout.exercises.length - 1;
        const isLastSet = workout.currentSetIndex === exercise.sets.length - 1;
        const totalSets = workout.exercises.reduce((t, ex) => t + ex.sets.length, 0);
        const completedSets = workout.exercises.reduce(
          (t, ex) => t + ex.sets.filter((set) => set.completed).length,
          0,
        );
        if (isLastExercise && isLastSet && completedSets === totalSets) {
          dispatch(setShowCompletionModal(true));
        } else if (exercise.isSuperset && exercise.supersetId) {
          dispatch(advanceToNextSupersetRound());
        } else {
          dispatch(nextSet());
        }
      } else {
        dispatch(nextSet());
      }
    }, 1000);
  }, [dispatch]);

  const syncFromTargetEndTime = useCallback(() => {
    const { isActive, targetEndTime } = restTimerRef.current;
    if (!isActive || targetEndTime == null) return;
    const now = Date.now();
    const remaining = remainingSeconds(targetEndTime, now);
    dispatch(updateRestTimer(remaining));
    if (remaining <= 3 && remaining > 0 && lastBeepSecondRef.current !== remaining) {
      lastBeepSecondRef.current = remaining;
      playBeep();
    }
    if (isElapsed(targetEndTime, now) && completedForRef.current !== targetEndTime) {
      completedForRef.current = targetEndTime;
      handleCompletion();
    }
  }, [dispatch, handleCompletion]);

  useEffect(() => {
    if (!restTimer.isActive || restTimer.targetEndTime == null) {
      lastBeepSecondRef.current = null;
      return;
    }
    syncFromTargetEndTime();
    const interval = setInterval(syncFromTargetEndTime, 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncFromTargetEndTime();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [restTimer.isActive, restTimer.targetEndTime, syncFromTargetEndTime]);

  // --- controls ---
  const startDuration = useCallback(
    (duration: number, saveDefault = true) => {
      dispatch(startRestTimer({ duration }));
      if (saveDefault && currentExercise && activeWorkout) {
        dispatch(
          updateExercise({
            exerciseId: currentExercise.id,
            sets: currentExercise.sets,
            restTime: duration,
          }),
        );
      }
    },
    [dispatch, currentExercise, activeWorkout],
  );

  const handleSkip = useCallback(() => {
    dispatch(stopRestTimer());
    const workout = activeWorkoutRef.current;
    if (workout) {
      const exercise = workout.exercises[workout.currentExerciseIndex];
      if (exercise.isSuperset && exercise.supersetId) dispatch(advanceToNextSupersetRound());
      else dispatch(nextSet());
    } else {
      dispatch(nextSet());
    }
  }, [dispatch]);

  const adjustCustom = (dm: number, ds: number) => {
    setCustomMinutes((m) => Math.max(0, m + dm));
    setCustomSeconds((s) => Math.max(0, Math.min(59, s + ds)));
  };

  const active = restTimer.isActive;
  const remaining = restTimer.timeRemaining;
  const progress = active && restTimer.duration > 0
    ? ((restTimer.duration - remaining) / restTimer.duration) * 100
    : 0;
  const timeTone =
    active && remaining <= 3 ? 'text-danger' : active && remaining <= 10 ? 'text-warning' : 'text-ink';

  return (
    <>
      <div
        className="relative shrink-0 overflow-hidden border-t border-board-line/25 bg-surface-raised pb-[env(safe-area-inset-bottom)]"
      >
        {/* progress fill behind the bar while resting */}
        {active && (
          <div
            className={cn(
              'absolute inset-y-0 left-0 transition-all duration-1000',
              remaining <= 3 ? 'bg-danger/20' : remaining <= 10 ? 'bg-warning/20' : 'bg-accent/15',
            )}
            style={{ width: `${progress}%` }}
            aria-hidden="true"
          />
        )}

        <div className="relative flex items-stretch">
          {/* Chevron — open presets/custom */}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Rest timer options"
            className="flex shrink-0 items-center px-3 text-ink-muted transition-colors hover:text-ink"
          >
            <ChevronUp size={20} />
          </button>

          {/* Main button — start default, or show countdown + skip while active */}
          <button
            type="button"
            onClick={active ? handleSkip : () => startDuration(defaultDuration)}
            className="flex min-h-touch flex-1 items-center justify-center gap-2 py-2 pr-3"
          >
            {active ? (
              <>
                <span className={cn('font-num font-tabular text-xl font-bold tabular-nums', timeTone)}>
                  {formatTime(remaining)}
                </span>
                <span className="text-caption text-ink-subtle">rest · tap to skip</span>
                <Pause size={15} className="text-ink-subtle" />
              </>
            ) : (
              <>
                <Play size={16} className="text-success" />
                <span className="font-marker text-body text-ink">Start rest</span>
                <span className="font-num font-tabular text-caption text-ink-subtle">
                  {formatTime(defaultDuration)}
                </span>
              </>
            )}
          </button>

          {active && (
            <button
              type="button"
              onClick={() => dispatch(stopRestTimer())}
              aria-label="Cancel rest"
              className="flex shrink-0 items-center px-3 text-ink-muted transition-colors hover:text-danger"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Presets + custom timer */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="mx-auto max-w-md">
          <SheetTitle className="font-marker text-title text-ink">Rest timer</SheetTitle>
          <SheetDescription className="sr-only">
            Choose a rest duration or set a custom timer.
          </SheetDescription>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {PRESETS.map((p) => {
              const isDefault = currentExercise?.restTime === p.seconds;
              return (
                <button
                  key={p.seconds}
                  type="button"
                  onClick={() => {
                    startDuration(p.seconds);
                    setSheetOpen(false);
                  }}
                  className={cn(
                    'rounded-lg py-3 font-num font-tabular text-body-sm transition-colors',
                    isDefault
                      ? 'bg-accent text-accent-fg'
                      : 'bg-surface-subtle text-ink hover:bg-surface-subtle/70',
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 border-t border-board-line/20 pt-4">
            <p className="mb-2 text-center text-caption uppercase tracking-wide text-ink-subtle">
              Custom
            </p>
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustCustom(-1, 0)}
                  className="rounded-md bg-surface-subtle p-2 text-ink hover:bg-surface-subtle/70"
                  aria-label="Minus one minute"
                >
                  <Minus size={14} />
                </button>
                <span className="w-10 text-center font-num font-tabular text-body text-ink">
                  {customMinutes}m
                </span>
                <button
                  type="button"
                  onClick={() => adjustCustom(1, 0)}
                  className="rounded-md bg-surface-subtle p-2 text-ink hover:bg-surface-subtle/70"
                  aria-label="Plus one minute"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustCustom(0, -15)}
                  className="rounded-md bg-surface-subtle p-2 text-ink hover:bg-surface-subtle/70"
                  aria-label="Minus fifteen seconds"
                >
                  <Minus size={14} />
                </button>
                <span className="w-10 text-center font-num font-tabular text-body text-ink">
                  {customSeconds}s
                </span>
                <button
                  type="button"
                  onClick={() => adjustCustom(0, 15)}
                  className="rounded-md bg-surface-subtle p-2 text-ink hover:bg-surface-subtle/70"
                  aria-label="Plus fifteen seconds"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                startDuration(customMinutes * 60 + customSeconds);
                setSheetOpen(false);
              }}
              className="mt-4 w-full rounded-lg bg-success py-3 font-marker text-body text-ink-inverse transition-colors hover:bg-success/90"
            >
              Start {customMinutes}:{customSeconds.toString().padStart(2, '0')}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
