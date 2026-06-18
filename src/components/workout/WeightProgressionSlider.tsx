import React, { useState, useEffect } from 'react';
import { TrendingUp, Minus, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';

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
    if (sliderValue < 40) return <TrendingDown className="w-4 h-4 text-warning" />;
    if (sliderValue < 60) return <Minus className="w-4 h-4 text-ink-subtle" />;
    return <TrendingUp className="w-4 h-4 text-success" />;
  };

  const weightDiff = recommendedWeight - previousWeight;

  // Get descriptive label for weight change
  const getWeightChangeDescription = () => {
    if (Math.abs(weightDiff) < 0.5) {
      return action === 'maintain' ? 'Maintaining weight' : 'No change';
    }

    if (weightDiff < 0) {
      if (deloadApplied || action === 'deload') {
        return `Deload: ${weightDiff} lbs`;
      } else if (reasoning && reasoning.toLowerCase().includes('fatigue')) {
        return `Fatigue adjustment: ${weightDiff} lbs`;
      } else {
        return `Reduced: ${weightDiff} lbs`;
      }
    } else {
      if (action === 'increase') {
        return `Progression: +${weightDiff} lbs`;
      } else {
        return `Increased: +${weightDiff} lbs`;
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
    { position: 0, label: `-${Math.round(previousWeight * 0.1)} lbs` },
    { position: 50, label: '±0' },
    { position: calculateStopPoint(2.5), label: '+2.5' },
    { position: calculateStopPoint(5), label: '+5' },
    { position: 100, label: `+${maxIncrease}` }
  ];

  // Token-driven fill color for the progress track.
  const fillClass =
    sliderValue < 50 ? 'bg-warning' :
    sliderValue < 70 ? 'bg-muscle-core' :
    'bg-success';

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-body-sm text-ink-muted font-marker">Weight</span>
          {getProgressionIcon()}
        </div>
        <div className="text-right">
          <div className="text-title font-bold text-ink font-num font-tabular">{recommendedWeight} lbs</div>
          <div className={`text-caption font-num font-tabular ${
            Math.abs(weightDiff) < 0.5 ? 'text-ink-subtle' :
            weightDiff >= 0 ? 'text-success' :
            (deloadApplied || (reasoning && reasoning.toLowerCase().includes('fatigue'))) ? 'text-warning' : 'text-warning'
          }`}>
            {getWeightChangeDescription()}
          </div>
        </div>
      </div>

      <div className="relative">
        {/* Slider Track */}
        <div className="relative h-2 bg-surface-subtle rounded-full">
          {/* Progress Fill */}
          <div
            className={`absolute left-0 top-0 h-2 rounded-full transition-all duration-snap ${fillClass}`}
            style={{ width: `${sliderValue}%` }}
          />

          {/* Stop Point Markers */}
          {stopPoints.map((point) => (
            <div
              key={point.position}
              className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-ink-subtle/40"
              style={{ left: `${point.position}%` }}
            />
          ))}
        </div>

        {/* Slider Input */}
        <input
          type="range"
          min="0"
          max="100"
          value={sliderValue}
          onChange={(e) => handleSliderChange(parseInt(e.target.value))}
          className="absolute inset-0 w-full h-2 opacity-0 cursor-pointer"
        />

        {/* Slider Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-surface-raised rounded-full shadow-e1 border-2 border-border pointer-events-none"
          style={{ left: `calc(${sliderValue}% - 10px)` }}
        />
      </div>

      {/* Weight Markers */}
      <div className="relative mt-2">
        {stopPoints.map((point, index) => (
          <span
            key={point.position}
            className={`absolute text-caption font-num font-tabular ${
              index === 0 ? 'text-warning' :
              index === 1 ? 'text-ink-subtle' :
              index === 2 ? 'text-muscle-core' :
              index === 3 ? 'text-accent' :
              'text-success'
            }`}
            style={{
              left: `${point.position}%`,
              transform: 'translateX(-50%)'
            }}
          >
            {point.label}
          </span>
        ))}
        <div className="h-4"></div>
      </div>

      {/* Clickable Progression Labels */}
      <div className="flex justify-between mt-3 pt-2 border-t border-border">
        <button
          type="button"
          onClick={() => handleSliderChange(25)}
          className={`text-caption px-2 py-1 rounded transition-colors duration-snap ${
            sliderValue < 40 ? 'bg-warning/15 text-warning font-semibold' : 'text-ink-subtle hover:text-warning'
          }`}
        >
          Deload
        </button>
        <button
          type="button"
          onClick={() => handleSliderChange(100)}
          className={`text-caption px-2 py-1 rounded transition-colors duration-snap ${
            sliderValue >= 85 ? 'bg-success/15 text-success font-semibold' : 'text-ink-subtle hover:text-success'
          }`}
        >
          Beginner
        </button>
        <button
          type="button"
          onClick={() => handleSliderChange(calculateStopPoint(5))}
          className={`text-caption px-2 py-1 rounded transition-colors duration-snap ${
            sliderValue >= 70 && sliderValue < 85 ? 'bg-accent/15 text-accent font-semibold' : 'text-ink-subtle hover:text-accent'
          }`}
        >
          Intermediate
        </button>
        <button
          type="button"
          onClick={() => handleSliderChange(calculateStopPoint(2.5))}
          className={`text-caption px-2 py-1 rounded transition-colors duration-snap ${
            sliderValue >= 50 && sliderValue < 70 ? 'bg-muscle-core/15 text-muscle-core font-semibold' : 'text-ink-subtle hover:text-muscle-core'
          }`}
        >
          Advanced
        </button>
      </div>
    </Card>
  );
};

export default WeightProgressionSlider;
