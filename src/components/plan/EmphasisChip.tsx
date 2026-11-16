import React from 'react';
import type { ExerciseEmphasis } from '../../types/exercise';
import { cn } from '../../lib/utils';

interface EmphasisChipProps {
  emphasis?: ExerciseEmphasis | null;
  className?: string;
}

export const EmphasisChip: React.FC<EmphasisChipProps> = ({ emphasis, className }) => {
  if (emphasis !== 'volume' && emphasis !== 'strength') return null;
  const label = emphasis === 'volume' ? 'Volume' : 'Strength';
  return (
    <span
      data-testid="emphasis-chip"
      className={cn(
        'inline-flex shrink-0 items-center rounded-full bg-surface-raised px-2 py-0.5 text-caption font-semibold text-accent-2',
        className,
      )}
    >
      {label}
    </span>
  );
};
