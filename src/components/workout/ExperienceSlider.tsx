import React, { useState } from 'react';
import { Info } from 'lucide-react';
import type { ExperienceLevel } from '../../types/progression';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';

interface ExperienceSliderProps {
  currentLevel: ExperienceLevel;
  onChange: (level: ExperienceLevel) => void;
  showTooltip?: boolean;
}

export const ExperienceSlider: React.FC<ExperienceSliderProps> = ({
  currentLevel,
  onChange,
  showTooltip = true
}) => {
  const [showInfo, setShowInfo] = useState(false);

  const levels: {
    value: ExperienceLevel;
    label: string;
    description: string;
    fill: string;
    tint: string;
  }[] = [
    {
      value: 'aggressive',
      label: 'Aggressive',
      description: 'Recommended for beginners. Larger weight jumps for faster linear progression.',
      fill: 'bg-success',
      tint: 'bg-success/10'
    },
    {
      value: 'standard',
      label: 'Standard',
      description: 'Balanced progression for intermediate lifters. Moderate weight increases.',
      fill: 'bg-accent',
      tint: 'bg-accent/10'
    },
    {
      value: 'conservative',
      label: 'Conservative',
      description: 'For advanced lifters. Smaller increments with undulating periodization.',
      fill: 'bg-muscle-core',
      tint: 'bg-muscle-core/10'
    }
  ];

  const currentIndex = levels.findIndex(l => l.value === currentLevel);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value);
    onChange(levels[index].value);
  };

  // Token-driven track gradient: active third uses its semantic hue, rest muted.
  const trackBackground = `linear-gradient(to right,
    ${currentIndex === 0 ? 'hsl(var(--success))' : 'hsl(var(--surface-subtle))'} 0% 33.33%,
    ${currentIndex === 1 ? 'hsl(var(--accent))' : 'hsl(var(--surface-subtle))'} 33.33% 66.66%,
    ${currentIndex === 2 ? 'hsl(var(--muscle-core))' : 'hsl(var(--surface-subtle))'} 66.66% 100%)`;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-body-sm font-semibold text-ink">Progression Rate</h3>
        {showTooltip && (
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="About progression rate"
            onClick={() => setShowInfo(!showInfo)}
          >
            <Info className="w-4 h-4" />
          </IconButton>
        )}
      </div>

      {showInfo && (
        <div className="mb-4 p-3 bg-accent/10 rounded-md text-body-sm text-ink-muted">
          Adjust how aggressively weights increase based on your experience level.
          Beginners benefit from larger jumps, while advanced lifters need smaller, more strategic increases.
        </div>
      )}

      <div className="space-y-4">
        {/* Slider */}
        <div className="relative">
          <input
            type="range"
            min="0"
            max="2"
            step="1"
            value={currentIndex}
            onChange={handleSliderChange}
            className="experience-slider w-full h-2 rounded-md appearance-none cursor-pointer"
            style={{ background: trackBackground }}
          />

          {/* Labels */}
          <div className="flex justify-between mt-2">
            {levels.map((level, index) => (
              <div
                key={level.value}
                className={`text-caption font-medium transition-colors duration-snap ${
                  index === currentIndex ? 'text-ink' : 'text-ink-subtle'
                }`}
              >
                {level.label}
              </div>
            ))}
          </div>
        </div>

        {/* Current Selection Details */}
        <div className={`p-3 rounded-md ${levels[currentIndex].tint}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-ink">{levels[currentIndex].label}</span>
            <span className={`px-2 py-1 text-caption font-medium rounded-full text-ink-inverse ${levels[currentIndex].fill}`}>
              Active
            </span>
          </div>
          <p className="text-body-sm text-ink-muted">{levels[currentIndex].description}</p>
        </div>

        {/* Quick Examples */}
        <div className="text-caption text-ink-subtle space-y-1">
          <p className="font-medium">Example increments (upper body):</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className={currentIndex === 0 ? 'font-bold text-ink' : ''}>
              Aggressive: +10 lbs
            </div>
            <div className={currentIndex === 1 ? 'font-bold text-ink' : ''}>
              Standard: +5 lbs
            </div>
            <div className={currentIndex === 2 ? 'font-bold text-ink' : ''}>
              Conservative: +2.5 lbs
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .experience-slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: hsl(var(--surface-raised));
          border: 2px solid hsl(var(--accent));
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 4px hsl(var(--shadow) / 0.2);
        }

        .experience-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: hsl(var(--surface-raised));
          border: 2px solid hsl(var(--accent));
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 4px hsl(var(--shadow) / 0.2);
        }
      `}</style>
    </Card>
  );
};

export default ExperienceSlider;
