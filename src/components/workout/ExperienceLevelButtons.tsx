import React from 'react';
import type { ExperienceLevel } from '../../types/progression';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ExperienceLevelButtonsProps {
  currentLevel: ExperienceLevel;
  onChange: (level: ExperienceLevel) => void;
  compact?: boolean;
}

const LEVELS: {
  value: ExperienceLevel;
  label: string;
  description: string;
  increment: string;
}[] = [
  { value: 'aggressive', label: 'Aggressive', description: 'Beginner', increment: '+10' },
  { value: 'standard', label: 'Standard', description: 'Intermediate', increment: '+5' },
  { value: 'conservative', label: 'Conservative', description: 'Advanced', increment: '+2.5' },
];

/**
 * Progression-rate picker (Tempo): a pill segmented control. Selection is a
 * surface step (ink pill on raised), not a hue — the level isn't an outcome.
 * The full variant adds the upper-body increment as a tabular number.
 */
export const ExperienceLevelButtons: React.FC<ExperienceLevelButtonsProps> = ({
  currentLevel,
  onChange,
  compact = false,
}) => {
  if (compact) {
    return (
      <div role="radiogroup" aria-label="Progression rate" className="flex gap-1.5">
        {LEVELS.map((level) => {
          const checked = currentLevel === level.value;
          return (
            <button
              key={level.value}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(level.value)}
              className={cn(
                'min-h-9 rounded-full px-4 text-body-sm font-semibold transition-colors duration-snap',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                checked ? 'bg-ink text-ink-inverse' : 'bg-surface-raised text-ink-muted hover:text-ink',
              )}
            >
              {level.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="text-body-sm font-semibold text-ink">Progression rate</h3>
      <p className="mt-0.5 text-caption text-ink-muted">How fast the weight goes up</p>

      <div role="radiogroup" aria-label="Progression rate" className="mt-3 grid grid-cols-3 gap-2">
        {LEVELS.map((level) => {
          const checked = currentLevel === level.value;
          return (
            <button
              key={level.value}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(level.value)}
              className={cn(
                'flex min-h-touch-lg flex-col items-center gap-0.5 rounded-2xl px-2 py-3 text-center transition-colors duration-snap',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle',
                checked ? 'bg-ink text-ink-inverse' : 'bg-surface-raised text-ink hover:bg-surface-raised/80',
              )}
            >
              <span className="font-display font-tabular text-title">{level.increment}</span>
              <span className={cn('text-caption', checked ? 'text-ink-inverse/70' : 'text-ink-muted')}>
                lb per step
              </span>
              <span className="mt-1 text-body-sm font-semibold">{level.label}</span>
              <span className={cn('text-caption', checked ? 'text-ink-inverse/70' : 'text-ink-muted')}>
                {level.description}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
};

export default ExperienceLevelButtons;
