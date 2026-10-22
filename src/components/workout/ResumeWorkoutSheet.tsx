import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { endWorkout, resumeAcknowledged } from '../../store/slices/workoutSlice';
import { useFinishWorkout, useIsAnonymousWorkoutUser } from '../../hooks/useFinishWorkout';
import {
  loadWorkoutSnapshot,
  clearWorkoutSnapshot,
  clearStoredPlanContext,
} from '../../lib/workoutSession';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';

export function formatTimeAgo(timestamp: string | number | Date, now: number = Date.now()): string {
  const time = typeof timestamp === 'string' || typeof timestamp === 'number'
    ? new Date(timestamp).getTime()
    : timestamp.getTime();
  if (isNaN(time)) return 'recently';
  const diffMs = Math.max(0, now - time);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45) return 'just now';
  if (diffSec < 90) return '1 minute ago';
  if (diffMin < 60) return `${diffMin} minutes ago`;
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

/**
 * ResumeWorkoutSheet — when an in-progress workout was restored from storage
 * and the user is elsewhere in the app (not on /workout), offer three actions:
 *   - Resume: navigate to /workout
 *   - Finish & save: close out the session via the same shared path as Save & end
 *   - Discard: end workout + clear snapshot (with confirmation prompt)
 */
export function ResumeWorkoutSheet() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeWorkout = useAppSelector((state) => state.workout.activeWorkout);
  const restoredFromSnapshot = useAppSelector((state) => state.workout.restoredFromSnapshot);
  const { finishWorkout } = useFinishWorkout();
  const isAnonymousUser = useIsAnonymousWorkoutUser();

  const [dismissed, setDismissed] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // Reset dismissed state whenever activeWorkout ID changes
  useEffect(() => {
    setDismissed(false);
    setConfirmDiscard(false);
  }, [activeWorkout?.id]);

  const onWorkoutPage = pathname.startsWith('/workout');
  const hasValidWorkout = Boolean(activeWorkout && activeWorkout.exercises && activeWorkout.exercises.length > 0);
  // Only a workout restored from storage at launch is offered for resume; a live
  // workout the user is running and merely navigated away from is not.
  const open = restoredFromSnapshot && hasValidWorkout && !onWorkoutPage && !dismissed;

  // Landing on /workout (by any route) counts as resuming.
  useEffect(() => {
    if (restoredFromSnapshot && onWorkoutPage) dispatch(resumeAcknowledged());
  }, [restoredFromSnapshot, onWorkoutPage, dispatch]);

  // Read the stored save time once per workout rather than on every render.
  const workoutId = activeWorkout?.id;
  const savedTime = useMemo(
    () => loadWorkoutSnapshot()?.savedAt ?? activeWorkout?.startTime,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workoutId],
  );

  if (!activeWorkout || !hasValidWorkout) return null;

  const totalSets = activeWorkout.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
  const completedSets = activeWorkout.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
    0,
  );

  const timeAgo = formatTimeAgo(savedTime ?? activeWorkout.startTime);

  const handleResume = () => {
    dispatch(resumeAcknowledged());
    navigate('/workout');
  };

  const handleFinish = async () => {
    setIsFinishing(true);
    try {
      await finishWorkout({ isAnonymousUser });
    } finally {
      setIsFinishing(false);
    }
  };

  const handleConfirmDiscard = () => {
    clearWorkoutSnapshot();
    clearStoredPlanContext();
    dispatch(endWorkout());
    setConfirmDiscard(false);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => (!o ? setDismissed(true) : undefined)}>
      <SheetContent className="mx-auto max-w-md">
        <SheetTitle className="text-title font-bold text-ink">In-progress workout</SheetTitle>
        <SheetDescription className="text-body-sm text-ink-muted">
          You have an active workout in progress.
        </SheetDescription>

        <div className="mt-4 rounded-[20px] bg-surface-raised p-4">
          <p className="text-body font-semibold text-ink">{activeWorkout.name}</p>
          <p className="mt-1 font-display font-tabular text-title text-accent">
            {completedSets} of {totalSets} sets logged
          </p>
          <p className="mt-0.5 text-body-sm text-ink-muted">Saved {timeAgo}</p>
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleResume}
            disabled={isFinishing}
          >
            Resume
          </Button>

          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={handleFinish}
            disabled={isFinishing || completedSets === 0}
          >
            {isFinishing ? 'Saving...' : 'Finish & save'}
          </Button>

          {confirmDiscard ? (
            <div className="mt-1 flex flex-col gap-2 rounded-[16px] bg-surface-raised p-3">
              <p className="text-body-sm text-ink-muted">
                Discard this workout? This cannot be undone.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="danger"
                  size="md"
                  onClick={handleConfirmDiscard}
                  disabled={isFinishing}
                >
                  Confirm discard
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setConfirmDiscard(false)}
                  disabled={isFinishing}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="md"
              className="w-full text-danger hover:text-danger hover:bg-danger/10"
              onClick={() => setConfirmDiscard(true)}
              disabled={isFinishing}
            >
              Discard
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
