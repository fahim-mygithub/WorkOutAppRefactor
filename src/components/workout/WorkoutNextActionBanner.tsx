// WorkoutNextActionBanner — the contextual status strip on the active-exercise
// card: "Rest in progress", "Ready to perform set N", or "Set completed!".
// Pure presentation driven by the rest-timer + current-set state. Uses semantic
// state tokens (warning / success / accent) rather than bespoke orange/green/blue.
import React from 'react';

interface WorkoutNextActionBannerProps {
  restActive: boolean;
  restTimeRemaining: number;
  currentSetCompleted: boolean;
  currentSetNumber: number; // 1-based
  hasNextSet: boolean;
}

function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${(seconds % 60)
    .toString()
    .padStart(2, '0')}`;
}

export const WorkoutNextActionBanner: React.FC<WorkoutNextActionBannerProps> = ({
  restActive,
  restTimeRemaining,
  currentSetCompleted,
  currentSetNumber,
  hasNextSet,
}) => {
  if (restActive) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-md border-2 border-warning/50 bg-warning/15 p-3">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-warning" />
        <p className="text-body-sm font-bold text-warning">
          Resting —{' '}
          <span className="font-num font-tabular">
            {formatClock(restTimeRemaining)}
          </span>{' '}
          left
        </p>
      </div>
    );
  }

  if (!currentSetCompleted) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-md border-2 border-success/50 bg-success/15 p-3">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-success" />
        <p className="text-body-sm font-bold text-success">
          Ready for set{' '}
          <span className="font-num font-tabular">{currentSetNumber}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-center gap-2 rounded-md border-2 border-accent/50 bg-accent/15 p-3">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
      <p className="text-body-sm font-bold text-accent">
        Set done!{' '}
        {hasNextSet ? 'Ready for next set' : 'Ready for next exercise'}
      </p>
    </div>
  );
};
