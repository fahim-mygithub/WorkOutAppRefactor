// WorkoutNextActionBanner — the contextual status line on the active-exercise
// card: "Resting", "Ready for set N", or "Set done". Tempo keeps it a quiet
// muted line with one colored dot (amber = act now, ice = done) instead of a
// boxed banner, and no ambient pulse.
import React from 'react';
import { cn } from '@/lib/utils';

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

function StatusLine({ dot, children }: { dot: string; children: React.ReactNode }) {
  return (
    <p role="status" className="mb-4 flex items-center gap-2 text-body-sm text-ink-muted">
      <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', dot)} />
      <span>{children}</span>
    </p>
  );
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
      <StatusLine dot="bg-accent">
        Resting,{' '}
        <span className="font-num font-tabular font-semibold text-ink">
          {formatClock(restTimeRemaining)}
        </span>{' '}
        left
      </StatusLine>
    );
  }

  if (!currentSetCompleted) {
    return (
      <StatusLine dot="bg-accent">
        Ready for set{' '}
        <span className="font-num font-tabular font-semibold text-ink">{currentSetNumber}</span>
      </StatusLine>
    );
  }

  return (
    <StatusLine dot="bg-accent-2">
      Set done. {hasNextSet ? 'Next set is up.' : 'Next exercise is up.'}
    </StatusLine>
  );
};
