// RestTimerBar — the rest timer (Tempo). Idle it's one quiet bar at the bottom
// of the player: tap to start the default rest, or the chevron for presets + a
// custom timer. While a rest runs it TAKES OVER the player: a large amber ring
// counting down, -15s / +15s / Skip, and an "Up next" card, so the only thing
// on screen during rest is rest. (The player column must be `relative`.)
//
// This component also OWNS the countdown engine (the 1s tick, background-resume
// reconciliation, beeps, and auto-advance on completion) — ported verbatim from
// the old <RestTimer> widget — so exactly one engine runs on the workout page.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronUp, Plus, Minus, X, Timer } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  updateRestTimer,
  stopRestTimer,
  startRestTimer,
  adjustRestTimer,
  nextSet,
  advanceToNextSupersetRound,
  setShowCompletionModal,
  updateExercise,
} from '../../../store/slices/workoutSlice';
import { remainingSeconds, isElapsed } from '../../../lib/restTimer';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { formatRepRange } from '@/lib/progression/setPrescription';
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
  const reduced = useReducedMotion() ?? false;

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
  const remainingFraction =
    active && restTimer.duration > 0 ? Math.max(0, Math.min(1, remaining / restTimer.duration)) : 1;

  // "Up next" — the set that follows the one just logged. Supersets advance by
  // round (partner first), so the card is omitted there rather than guessed.
  const upNext = (() => {
    if (!activeWorkout || !currentExercise || currentExercise.isSuperset) return null;
    const nextInExercise = currentExercise.sets[activeWorkout.currentSetIndex + 1];
    if (nextInExercise) {
      return {
        name: currentExercise.customTitle || currentExercise.exercise.name,
        setLabel: `set ${activeWorkout.currentSetIndex + 2}`,
        set: nextInExercise,
      };
    }
    const nextExercise = activeWorkout.exercises[activeWorkout.currentExerciseIndex + 1];
    if (!nextExercise || !nextExercise.sets[0]) return null;
    return {
      name: nextExercise.customTitle || nextExercise.exercise.name,
      setLabel: 'set 1',
      set: nextExercise.sets[0],
    };
  })();

  return (
    <>
      {/* Idle: one quiet bar at the bottom of the player. */}
      {!active && (
        <div className="shrink-0 px-3 pb-3 pt-2">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => startDuration(defaultDuration)}
              className="relative flex-1 justify-start pl-5"
            >
              <Timer size={18} aria-hidden="true" className="text-ink-muted" />
              <span>Start rest</span>
              <span className="ml-auto pr-1 font-num font-tabular text-ink-muted">
                {formatTime(defaultDuration)}
              </span>
            </Button>
            <IconButton
              variant="secondary"
              size="lg"
              onClick={() => setSheetOpen(true)}
              aria-label="Rest timer options"
            >
              <ChevronUp size={20} />
            </IconButton>
          </div>
        </div>
      )}

      {/* Resting: the timer takes over the player. */}
      <AnimatePresence>
        {active && (
          <motion.section
            key="rest"
            aria-label="Rest timer"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.12 : 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="absolute inset-0 z-30 flex flex-col items-center bg-surface px-4 pb-4 pt-4"
          >
            <div className="flex w-full items-center justify-between">
              <span className="w-11" aria-hidden="true" />
              <p className="text-body-sm font-semibold text-ink-muted">Rest</p>
              <IconButton
                variant="secondary"
                onClick={() => dispatch(stopRestTimer())}
                aria-label="Stop timer and stay on this set"
              >
                <X size={18} />
              </IconButton>
            </div>

            <div className="relative my-auto aspect-square w-full max-w-[290px]">
              <svg viewBox="0 0 290 290" className="h-full w-full" aria-hidden="true">
                <circle cx="145" cy="145" r={RING_R} fill="none" strokeWidth="14" className="stroke-surface-raised" />
                <circle
                  cx="145"
                  cy="145"
                  r={RING_R}
                  fill="none"
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={RING_C}
                  strokeDashoffset={RING_C * (1 - remainingFraction)}
                  transform="rotate(-90 145 145)"
                  className="stroke-accent"
                  style={{ transition: reduced ? 'none' : 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center" aria-live="off">
                <span
                  role="timer"
                  aria-label={`${formatTime(remaining)} of rest left`}
                  className="font-display font-tabular text-[76px] leading-none text-ink"
                >
                  {formatTime(remaining)}
                </span>
                <span className="mt-2 text-body-sm text-ink-muted">
                  of {formatTime(restTimer.duration)} rest
                </span>
              </div>
            </div>

            <div className="mb-5 flex w-full max-w-[320px] gap-2">
              <Button variant="secondary" size="lg" className="flex-1" onClick={() => dispatch(adjustRestTimer(-15))}>
                −15s
              </Button>
              <Button variant="secondary" size="lg" className="flex-1" onClick={() => dispatch(adjustRestTimer(15))}>
                +15s
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="flex-1 border-2 border-accent text-accent hover:bg-accent/10 hover:text-accent"
                onClick={handleSkip}
              >
                Skip
              </Button>
            </div>

            {upNext && (
              <div className="w-full rounded-3xl bg-surface-subtle p-5">
                <p className="text-caption text-ink-muted">Up next: {upNext.setLabel}</p>
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-body font-bold text-ink">{upNext.name}</p>
                  <p className="shrink-0 font-display font-tabular text-title text-accent-2">
                    {upNext.set.weight ? `${upNext.set.weight} × ` : ''}
                    {formatRepRange(upNext.set) ?? upNext.set.reps}
                  </p>
                </div>
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Presets + custom timer */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="mx-auto max-w-md">
          <SheetTitle>Rest timer</SheetTitle>
          <SheetDescription>Pick a length. It becomes this exercise’s default.</SheetDescription>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {PRESETS.map((p) => {
              const isDefault = currentExercise?.restTime === p.seconds;
              return (
                <button
                  key={p.seconds}
                  type="button"
                  aria-pressed={isDefault}
                  onClick={() => {
                    startDuration(p.seconds);
                    setSheetOpen(false);
                  }}
                  className={cn(
                    'min-h-touch-lg rounded-full font-num font-tabular text-body font-semibold transition-colors duration-snap',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    isDefault
                      ? 'bg-accent-2 text-accent-2-fg'
                      : 'bg-surface-raised text-ink hover:bg-surface-raised/70',
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="mt-6 border-t border-hairline pt-5">
            <p className="mb-3 text-body-sm font-semibold text-ink">Custom</p>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <IconButton variant="secondary" onClick={() => adjustCustom(-1, 0)} aria-label="Minus one minute">
                  <Minus size={16} />
                </IconButton>
                <span className="w-12 text-center font-num font-tabular text-title text-ink">
                  {customMinutes}m
                </span>
                <IconButton variant="secondary" onClick={() => adjustCustom(1, 0)} aria-label="Plus one minute">
                  <Plus size={16} />
                </IconButton>
              </div>
              <div className="flex items-center gap-2">
                <IconButton variant="secondary" onClick={() => adjustCustom(0, -15)} aria-label="Minus fifteen seconds">
                  <Minus size={16} />
                </IconButton>
                <span className="w-12 text-center font-num font-tabular text-title text-ink">
                  {customSeconds}s
                </span>
                <IconButton variant="secondary" onClick={() => adjustCustom(0, 15)} aria-label="Plus fifteen seconds">
                  <Plus size={16} />
                </IconButton>
              </div>
            </div>
            <Button
              size="xl"
              className="mt-5"
              onClick={() => {
                startDuration(customMinutes * 60 + customSeconds);
                setSheetOpen(false);
              }}
            >
              Start {customMinutes}:{customSeconds.toString().padStart(2, '0')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

const RING_R = 130;
const RING_C = 2 * Math.PI * RING_R;
