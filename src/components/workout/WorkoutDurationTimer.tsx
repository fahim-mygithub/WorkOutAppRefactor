// WorkoutDurationTimer — the live "Duration: m:ss" readout for the active
// workout, isolated into its own leaf (PWA hardening §5).
//
// WHY THIS EXISTS: the old WorkoutPage ran a 1s `setInterval` that dispatched
// `updateWorkoutDuration` from the page component. Because the page subscribes
// to the whole workout slice, every tick re-rendered the entire workout tree
// (video, set list, exercise list, etc.) once per second — the real perf cost
// called out in §5. Moving the interval AND the duration display into this small
// leaf means the per-second clock work + re-render are scoped to ~one text node.
//
// Behavior is preserved exactly: the interval still computes elapsed seconds
// from `activeWorkout.startTime` and still dispatches `updateWorkoutDuration`
// (so the persisted `duration` stays current for the save-on-end path), it just
// no longer lives in the page component.
import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateWorkoutDuration } from '../../store/slices/workoutSlice';

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds
      .toString()
      .padStart(2, '0')}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export const WorkoutDurationTimer: React.FC = () => {
  const dispatch = useAppDispatch();
  // Subscribe ONLY to the two fields this leaf needs. The page no longer reads
  // `duration`, so the per-second mutation only re-renders this component.
  const startTime = useAppSelector((s) => s.workout.activeWorkout?.startTime);
  const duration = useAppSelector((s) => s.workout.activeWorkout?.duration ?? 0);

  useEffect(() => {
    if (!startTime) return;

    const tick = () => {
      const elapsed = Math.floor(
        (Date.now() - new Date(startTime).getTime()) / 1000,
      );
      dispatch(updateWorkoutDuration(elapsed));
    };

    // Reconcile immediately, then once per second.
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startTime, dispatch]);

  return (
    <p className="text-body-sm text-ink-subtle">
      Duration: {formatDuration(duration)}
    </p>
  );
};
