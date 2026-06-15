import React from 'react';
import type { ExperienceLevel } from '../../types/progression';
import { Card } from '@/components/ui/card';

interface ExperienceLevelButtonsProps {
  currentLevel: ExperienceLevel;
  onChange: (level: ExperienceLevel) => void;
  compact?: boolean;
}

type LevelTone = 'success' | 'accent' | 'core';

const toneSelected: Record<LevelTone, string> = {
  success: 'bg-success text-ink-inverse',
  accent: 'bg-accent text-accent-fg',
  core: 'bg-muscle-core text-ink-inverse',
};

const toneSelectedFull: Record<LevelTone, string> = {
  success: 'border-success bg-success/10',
  accent: 'border-accent bg-accent/10',
  core: 'border-muscle-core bg-muscle-core/10',
};

const toneAccentText: Record<LevelTone, string> = {
  success: 'text-success',
  accent: 'text-accent',
  core: 'text-muscle-core',
};

export const ExperienceLevelButtons: React.FC<ExperienceLevelButtonsProps> = ({
  currentLevel,
  onChange,
  compact = false
}) => {
  const levels: {
    value: ExperienceLevel;
    label: string;
    description: string;
    increment: string;
    tone: LevelTone;
  }[] = [
    {
      value: 'aggressive',
      label: 'Aggressive',
      description: 'Beginners',
      increment: '+10 lbs',
      tone: 'success'
    },
    {
      value: 'standard',
      label: 'Standard',
      description: 'Intermediate',
      increment: '+5 lbs',
      tone: 'accent'
    },
    {
      value: 'conservative',
      label: 'Conservative',
      description: 'Advanced',
      increment: '+2.5 lbs',
      tone: 'core'
    }
  ];

  if (compact) {
    // Compact version - just buttons
    return (
      <div className="flex gap-2">
        {levels.map((level) => (
          <button
            key={level.value}
            type="button"
            onClick={() => onChange(level.value)}
            className={`px-3 py-1 rounded-md text-caption font-medium transition-colors duration-snap ${
              currentLevel === level.value
                ? toneSelected[level.tone]
                : 'bg-surface-subtle text-ink-subtle hover:bg-surface-raised'
            }`}
          >
            {level.label}
          </button>
        ))}
      </div>
    );
  }

  // Full version with descriptions
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-body-sm font-medium text-ink-muted">Progression Rate</h3>
        <span className="text-caption text-ink-subtle">Select your experience level</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {levels.map((level) => {
          const selected = currentLevel === level.value;
          return (
            <button
              key={level.value}
              type="button"
              onClick={() => onChange(level.value)}
              className={`p-3 rounded-md border transition-colors duration-snap ${
                selected
                  ? toneSelectedFull[level.tone]
                  : 'border-border bg-surface-subtle hover:bg-surface-raised'
              }`}
            >
              <div className="text-center">
                <div className={`text-body-sm font-semibold mb-1 ${
                  selected ? 'text-ink' : 'text-ink-muted'
                }`}>
                  {level.label}
                </div>
                <div className="text-caption text-ink-subtle mb-1">{level.description}</div>
                <div className={`text-caption font-medium ${
                  selected ? toneAccentText[level.tone] : 'text-ink-subtle'
                }`}>
                  {level.increment}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
};

export default ExperienceLevelButtons;
