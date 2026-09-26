import React, { useState, useEffect } from 'react';
import { TrendingUp, Minus, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface WeightProgressionSliderProps {
  previousWeight: number;
  currentWeight: number;
  onWeightChange: (weight: number) => void;
  minIncrease?: number; // Conservative (2.5 lbs)
  maxIncrease?: number; // Aggressive (10 lbs)
  action?: 'increase' | 'maintain' | 'decrease' | 'deload';
  reasoning?: string;
  deloadApplied?: boolean;
}

export const WeightProgressionSlider: React.FC<WeightProgressionSliderProps> = ({
  previousWeight,
  currentWeight,
  onWeightChange,
  minIncrease = 2.5,
  maxIncrease = 10,
  action,
  reasoning,
  deloadApplied
}) => {
  const [sliderValue, setSliderValue] = useState(50);
  const [recommendedWeight, setRecommendedWeight] = useState(currentWeight);

  // Calculate weight from slider position
  const calculateWeightFromSlider = (value: number) => {
    if (value === 50) {
      return previousWeight; // No change
    } else if (value < 50) {
      // Decrease weight (deload)
      const decreaseRange = previousWeight * 0.1; // Max 10% decrease
      const decreaseAmount = (50 - value) / 50 * decreaseRange;
      return Math.round((previousWeight - decreaseAmount) * 2) / 2; // Round to nearest 0.5
    } else {
      // Increase weight (progression)
      const normalizedValue = (value - 50) / 50; // 0 to 1
      const increase = normalizedValue * maxIncrease;
      return Math.round((previousWeight + increase) * 2) / 2; // Round to nearest 0.5
    }
  };

  // Calculate slider position from weight
  const calculateSliderFromWeight = (weight: number) => {
    const diff = weight - previousWeight;

    if (Math.abs(diff) < 0.5) {
      return 50; // No significant change
    } else if (diff < 0) {
      // Deload
      const maxDecrease = previousWeight * 0.1;
      const percentage = Math.min(Math.abs(diff) / maxDecrease, 1);
      return Math.round(50 - (percentage * 50));
    } else {
      // Progression
      if (diff <= minIncrease) {
        return 50 + Math.round((diff / minIncrease) * 10); // Conservative range
      } else if (diff >= maxIncrease) {
        return 100; // Max aggressive
      } else {
        const progressRange = maxIncrease - minIncrease;
        const progressPercentage = (diff - minIncrease) / progressRange;
        return 50 + Math.round(10 + progressPercentage * 40);
      }
    }
  };

  // Initialize slider based on current weight
  useEffect(() => {
    if (currentWeight && previousWeight) {
      const initialValue = calculateSliderFromWeight(currentWeight);
      setSliderValue(initialValue);
      setRecommendedWeight(currentWeight);
    }
  }, []);

  const handleSliderChange = (value: number) => {
    setSliderValue(value);
    const newWeight = calculateWeightFromSlider(value);
    setRecommendedWeight(newWeight);
    onWeightChange(newWeight);
  };

  const getProgressionIcon = () => {
    if (sliderValue < 40) return <TrendingDown size={16} className="text-ink-muted" aria-hidden="true" />;
    if (sliderValue < 60) return <Minus size={16} className="text-ink-muted" aria-hidden="true" />;
    return <TrendingUp size={16} className="text-accent-2" aria-hidden="true" />;
  };

  const weightDiff = recommendedWeight - previousWeight;

  // Get descriptive label for weight change
  const getWeightChangeDescription = () => {
    if (Math.abs(weightDiff) < 0.5) {
      return action === 'maintain' ? 'Maintaining weight' : 'No change';
    }

    if (weightDiff < 0) {
      if (deloadApplied || action === 'deload') {
        return `Deload, ${weightDiff} lb`;
      } else if (reasoning && reasoning.toLowerCase().includes('fatigue')) {
        return `Fatigue adjustment, ${weightDiff} lb`;
      } else {
        return `Reduced, ${weightDiff} lb`;
      }
    } else {
      if (action === 'increase') {
        return `Progression, +${weightDiff} lb`;
      } else {
        return `Increased, +${weightDiff} lb`;
      }
    }
  };

  // Calculate stop points based on weight increments
  const calculateStopPoint = (weightIncrease: number) => {
    if (weightIncrease === 0) return 50;
    if (weightIncrease < 0) {
      const maxDecrease = previousWeight * 0.1;
      return Math.round(50 - (Math.abs(weightIncrease) / maxDecrease) * 50);
    }
    return Math.round(50 + (weightIncrease / maxIncrease) * 50);
  };

  const stopPoints = [
    { position: 0, label: `-${Math.round(previousWeight * 0.1)}` },
    { position: 50, label: '±0' },
    { position: calculateStopPoint(2.5), label: '+2.5' },
    { position: calculateStopPoint(5), label: '+5' },
    { position: 100, label: `+${maxIncrease}` }
  ];

  // Presets as pills. Selection is a surface step (ink pill), not a hue.
  const presets = [
    { label: 'Deload', value: 25, active: sliderValue < 40 },
    { label: 'Beginner', value: 100, active: sliderValue >= 85 },
    { label: 'Intermediate', value: calculateStopPoint(5), active: sliderValue >= 70 && sliderValue < 85 },
    { label: 'Advanced', value: calculateStopPoint(2.5), active: sliderValue >= 50 && sliderValue < 70 },
  ];

  return (
    <Card className="p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-body-sm text-ink-muted">
            Weight {getProgressionIcon()}
          </p>
          <p className="mt-0.5 text-caption font-tabular text-ink-muted">{getWeightChangeDescription()}</p>
        </div>
        <p className="font-display font-tabular text-display text-ink">
          {recommendedWeight}
          <span className="ml-1 text-body-sm font-semibold text-ink-muted">lb</span>
        </p>
      </div>

      <div className="relative mt-4 h-6">
        {/* Track: raised, ice fill up to the thumb. */}
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-surface-raised">
          <div
            className="absolute left-0 top-0 h-2 rounded-full bg-accent-2 transition-[width] duration-snap"
            style={{ width: `${sliderValue}%` }}
          />

          {/* Stop point markers */}
          {stopPoints.map((point) => (
            <div
              key={point.position}
              className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-ink/25"
              style={{ left: `${point.position}%` }}
            />
          ))}
        </div>

        {/* Native range input (invisible) drives the value and keyboard access. */}
        <input
          type="range"
          min="0"
          max="100"
          value={sliderValue}
          onChange={(e) => handleSliderChange(parseInt(e.target.value))}
          aria-label="Weight change"
          aria-valuetext={`${recommendedWeight} lb`}
          className="peer absolute inset-0 h-6 w-full cursor-pointer opacity-0"
        />

        {/* Thumb */}
        <div
          className="pointer-events-none absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-ink peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-subtle"
          style={{ left: `calc(${sliderValue}% - 12px)` }}
        />
      </div>

      {/* Increment markers */}
      <div className="relative mt-1.5 h-4">
        {stopPoints.map((point) => (
          <span
            key={point.position}
            className="absolute text-caption font-tabular text-ink-muted"
            style={{
              left: `${point.position}%`,
              transform: 'translateX(-50%)',
            }}
          >
            {point.label}
          </span>
        ))}
      </div>

      {/* Presets */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            aria-pressed={preset.active}
            onClick={() => handleSliderChange(preset.value)}
            className={cn(
              'min-h-9 rounded-full px-3.5 text-body-sm font-semibold transition-colors duration-snap',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle',
              preset.active ? 'bg-ink text-ink-inverse' : 'bg-surface-raised text-ink-muted hover:text-ink',
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </Card>
  );
};

export default WeightProgressionSlider;
