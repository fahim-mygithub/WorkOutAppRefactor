import React, { useState } from 'react';
import { Info } from 'lucide-react';
import type { ExperienceLevel } from '../../types/progression';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { cn } from '@/lib/utils';

interface ExperienceSliderProps {
  currentLevel: ExperienceLevel;
  onChange: (level: ExperienceLevel) => void;
  showTooltip?: boolean;
}

const LEVELS: {
  value: ExperienceLevel;
  label: string;
  description: string;
  increment: string;
}[] = [
  {
    value: 'aggressive',
    label: 'Aggressive',
    description: 'For beginners. Larger weight jumps for faster linear progression.',
    increment: '+10',
  },
  {
    value: 'standard',
    label: 'Standard',
    description: 'For intermediate lifters. Moderate, steady weight increases.',
    increment: '+5',
  },
  {
    value: 'conservative',
    label: 'Conservative',
    description: 'For advanced lifters. Smaller increments with undulating periodization.',
    increment: '+2.5',
  },
];

/**
 * Progression-rate slider (Tempo): a three-stop range on the raised track with
 * an ice fill up to the thumb, the chosen level's increment as a display
 * number, and its one-line description underneath. The "about" copy is
 * disclosed on demand behind the info button.
 */
export const ExperienceSlider: React.FC<ExperienceSliderProps> = ({
  currentLevel,
  onChange,
  showTooltip = true,
}) => {
  const [showInfo, setShowInfo] = useState(false);

  const currentIndex = Math.max(
    0,
    LEVELS.findIndex((l) => l.value === currentLevel),
  );
  const current = LEVELS[currentIndex];

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value);
    onChange(LEVELS[index].value);
  };

  // Ice fill up to the thumb (informational, not an action), raised track beyond it.
  const pct = (currentIndex / (LEVELS.length - 1)) * 100;
  const trackBackground = `linear-gradient(to right, hsl(var(--accent-2)) 0% ${pct}%, hsl(var(--surface-raised)) ${pct}% 100%)`;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-body-sm font-semibold text-ink">Progression rate</h3>
        {showTooltip && (
          <IconButton
            variant="ghost"
            size="md"
            aria-label="About progression rate"
            aria-expanded={showInfo}
            onClick={() => setShowInfo(!showInfo)}
            className="-mr-2"
          >
            <Info size={18} aria-hidden="true" />
          </IconButton>
        )}
      </div>

      {showInfo && (
        <p className="mb-3 text-body-sm text-ink-muted">
          Sets how quickly weights increase. Beginners benefit from larger jumps; advanced lifters
          need smaller, more deliberate increases.
        </p>
      )}

      <div className="flex items-end gap-3">
        <span className="font-display font-tabular text-display text-ink">{current.increment}</span>
        <span className="pb-1 text-body-sm text-ink-muted">lb per step, upper body</span>
      </div>

      <input
        type="range"
        min="0"
        max="2"
        step="1"
        value={currentIndex}
        onChange={handleSliderChange}
        aria-label="Progression rate"
        aria-valuetext={current.label}
        className="experience-slider mt-4 h-2 w-full cursor-pointer appearance-none rounded-full"
        style={{ background: trackBackground }}
      />

      <div className="mt-2 flex justify-between">
        {LEVELS.map((level, index) => (
          <span
            key={level.value}
            className={cn(
              'text-caption transition-colors duration-snap',
              index === currentIndex ? 'font-semibold text-ink' : 'text-ink-muted',
            )}
          >
            {level.label}
          </span>
        ))}
      </div>

      <p className="mt-3 text-body-sm text-ink-muted">{current.description}</p>

      <style>{`
        .experience-slider::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          background: hsl(var(--ink));
          border: 0;
          border-radius: 50%;
          cursor: pointer;
        }

        .experience-slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          background: hsl(var(--ink));
          border: 0;
          border-radius: 50%;
          cursor: pointer;
        }
      `}</style>
    </Card>
  );
};

export default ExperienceSlider;
