import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateRestTimer, stopRestTimer, startRestTimer, nextSet, advanceToNextSupersetRound, setShowCompletionModal, updateExercise } from '../store/slices/workoutSlice';
import { remainingSeconds, isElapsed } from '../lib/restTimer';
import { Play, Pause, RotateCcw, X, Plus, Minus, Edit3 } from 'lucide-react';

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

  const progress = restTimer.duration > 0 
    ? ((restTimer.duration - restTimer.timeRemaining) / restTimer.duration) * 100 
    : 0;

  if (compact && !restTimer.isActive && restTimer.timeRemaining === 0) {
    return (
      <div className={`grid grid-cols-4 gap-2 ${className}`}>
        <button
          onClick={() => handleSetDuration(30)}
          className={`px-3 py-2 text-white text-sm rounded transition-colors ${
            isPresetActive(30) ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          30s
        </button>
        <button
          onClick={() => handleSetDuration(60)}
          className={`px-3 py-2 text-white text-sm rounded transition-colors ${
            isPresetActive(60) ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          1m
        </button>
        <button
          onClick={() => handleSetDuration(120)}
          className={`px-3 py-2 text-white text-sm rounded transition-colors ${
            isPresetActive(120) ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          2m
        </button>
        <button
          onClick={() => handleSetDuration(180)}
          className={`px-3 py-2 text-white text-sm rounded transition-colors ${
            isPresetActive(180) ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          3m
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Rest Timer</h3>
        {restTimer.isActive && (
          <button
            onClick={handleStop}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Stop timer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Timer Display */}
      <div className="text-center mb-4">
        <div className={`font-mono font-bold transition-all duration-200 ${
          restTimer.timeRemaining <= 3 && restTimer.isActive
            ? 'text-red-400 animate-bounce text-5xl'
            : restTimer.timeRemaining <= 10 && restTimer.isActive
            ? 'text-orange-400 animate-pulse'
            : 'text-white'
        } ${compact ? 'text-2xl' : 'text-4xl'}`}>
          {formatTime(restTimer.timeRemaining)}
        </div>

        {/* Countdown Visual Effect */}
        {restTimer.timeRemaining <= 3 && restTimer.timeRemaining > 0 && restTimer.isActive && (
          <div className="mt-2 text-red-400 font-bold text-lg animate-pulse">
            GET READY!
          </div>
        )}
        
        {/* Progress Bar */}
        {restTimer.duration > 0 && (
          <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full transition-all duration-1000 ${
                restTimer.timeRemaining <= 3 && restTimer.isActive
                  ? 'bg-red-500 animate-pulse'
                  : restTimer.timeRemaining <= 10 && restTimer.isActive
                  ? 'bg-orange-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-center space-x-3">
        {!restTimer.isActive ? (
          <button
            onClick={handleStart}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Play className="w-4 h-4" />
            <span>Start</span>
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            <Pause className="w-4 h-4" />
            <span>Stop</span>
          </button>
        )}

        <button
          onClick={handleReset}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset</span>
        </button>
      </div>

      {/* Duration Presets */}
      {!compact && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-400">Quick Start:</p>
            {currentExercise?.restTime && (
              <p className="text-xs text-green-400">
                Default: {Math.floor(currentExercise.restTime / 60)}:{(currentExercise.restTime % 60).toString().padStart(2, '0')}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <button
              onClick={() => handleSetDuration(30)}
              className={`px-3 py-2 text-white text-sm rounded transition-colors ${
                isPresetActive(30) ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              30s
            </button>
            <button
              onClick={() => handleSetDuration(60)}
              className={`px-3 py-2 text-white text-sm rounded transition-colors ${
                isPresetActive(60) ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              1m
            </button>
            <button
              onClick={() => handleSetDuration(90)}
              className={`px-3 py-2 text-white text-sm rounded transition-colors ${
                isPresetActive(90) ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              1.5m
            </button>
            <button
              onClick={() => handleSetDuration(120)}
              className={`px-3 py-2 text-white text-sm rounded transition-colors ${
                isPresetActive(120) ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              2m
            </button>
            <button
              onClick={() => handleSetDuration(180)}
              className={`px-3 py-2 text-white text-sm rounded transition-colors ${
                isPresetActive(180) ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              3m
            </button>
            <button
              onClick={() => handleSetDuration(300)}
              className={`px-3 py-2 text-white text-sm rounded transition-colors ${
                isPresetActive(300) ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              5m
            </button>
          </div>

          {/* Custom Timer Section */}
          <div className="border-t border-gray-700 pt-3">
            {!showCustomInput ? (
              <button
                onClick={() => setShowCustomInput(true)}
                className="flex items-center space-x-2 mx-auto px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded transition-colors"
              >
                <Edit3 className="w-3 h-3" />
                <span>Custom</span>
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 text-center">Custom Timer</p>
                <div className="flex items-center justify-center space-x-2">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => adjustCustomTime(-1, 0)}
                      className="p-1 bg-gray-700 hover:bg-gray-600 rounded text-white"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center text-white text-sm">{customMinutes}m</span>
                    <button
                      onClick={() => adjustCustomTime(1, 0)}
                      className="p-1 bg-gray-700 hover:bg-gray-600 rounded text-white"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => adjustCustomTime(0, -15)}
                      className="p-1 bg-gray-700 hover:bg-gray-600 rounded text-white"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center text-white text-sm">{customSeconds}s</span>
                    <button
                      onClick={() => adjustCustomTime(0, 15)}
                      className="p-1 bg-gray-700 hover:bg-gray-600 rounded text-white"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="flex justify-center space-x-2">
                  <button
                    onClick={handleCustomTimer}
                    className="px-4 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                  >
                    Start {customMinutes}:{customSeconds.toString().padStart(2, '0')}
                  </button>
                  <button
                    onClick={() => setShowCustomInput(false)}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timer Complete Notification */}
      {restTimer.timeRemaining === 0 && !restTimer.isActive && restTimer.duration > 0 && (
        <div className="mt-4 p-3 bg-green-600 text-white text-center rounded-lg animate-pulse">
          <p className="font-semibold">Rest Complete!</p>
          <p className="text-sm">Auto-advancing to next set...</p>
        </div>
      )}
    </div>
  );
};