import React, { useState, useEffect } from 'react';
import { TrendingUp, Minus, TrendingDown } from 'lucide-react';

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

  const getProgressionLabel = () => {
    if (sliderValue < 40) return 'Deload';
    if (sliderValue < 70) return 'Advanced';
    if (sliderValue < 85) return 'Intermediate';
    return 'Beginner';
  };

  const getProgressionColor = () => {
    if (sliderValue < 40) return 'text-yellow-500';
    if (sliderValue < 70) return 'text-purple-500';
    if (sliderValue < 85) return 'text-blue-500';
    return 'text-green-500';
  };

  const getProgressionIcon = () => {
    if (sliderValue < 40) return <TrendingDown className="w-4 h-4" />;
    if (sliderValue < 60) return <Minus className="w-4 h-4" />;
    return <TrendingUp className="w-4 h-4" />;
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

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-400">Weight</span>
          {getProgressionIcon()}
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-white">{recommendedWeight} lbs</div>
          <div className={`text-xs ${
            Math.abs(weightDiff) < 0.5 ? 'text-gray-400' :
            weightDiff >= 0 ? 'text-green-500' :
            (deloadApplied || (reasoning && reasoning.toLowerCase().includes('fatigue'))) ? 'text-orange-500' : 'text-yellow-500'
          }`}>
            {getWeightChangeDescription()}
          </div>
        </div>
      </div>

      <div className="relative">
        {/* Slider Track */}
        <div className="relative h-2 bg-gray-700 rounded-full">
          {/* Progress Fill */}
          <div
            className={`absolute left-0 top-0 h-2 rounded-full transition-all ${
              sliderValue < 50 ? 'bg-gradient-to-r from-yellow-600 to-yellow-500' :
              sliderValue < 70 ? 'bg-gradient-to-r from-purple-600 to-blue-500' :
              'bg-gradient-to-r from-blue-500 to-green-500'
            }`}
            style={{ width: `${sliderValue}%` }}
          />

          {/* Stop Point Markers */}
          {stopPoints.map((point) => (
            <div
              key={point.position}
              className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-gray-600"
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
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-lg border-2 border-gray-600 pointer-events-none"
          style={{ left: `calc(${sliderValue}% - 10px)` }}
        />
      </div>

      {/* Weight Markers */}
      <div className="relative mt-2">
        {stopPoints.map((point, index) => (
          <span
            key={point.position}
            className={`absolute text-xs ${
              index === 0 ? 'text-yellow-500' :
              index === 1 ? 'text-gray-500' :
              index === 2 ? 'text-purple-500' :
              index === 3 ? 'text-blue-500' :
              'text-green-500'
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
      <div className="flex justify-between mt-3 pt-2 border-t border-gray-700">
        <button
          onClick={() => handleSliderChange(25)}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            sliderValue < 40 ? 'bg-yellow-900 bg-opacity-30 text-yellow-500 font-semibold' : 'text-gray-500 hover:text-yellow-500'
          }`}
        >
          Deload
        </button>
        <button
          onClick={() => handleSliderChange(100)}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            sliderValue >= 85 ? 'bg-green-900 bg-opacity-30 text-green-500 font-semibold' : 'text-gray-500 hover:text-green-500'
          }`}
        >
          Beginner
        </button>
        <button
          onClick={() => handleSliderChange(calculateStopPoint(5))}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            sliderValue >= 70 && sliderValue < 85 ? 'bg-blue-900 bg-opacity-30 text-blue-500 font-semibold' : 'text-gray-500 hover:text-blue-500'
          }`}
        >
          Intermediate
        </button>
        <button
          onClick={() => handleSliderChange(calculateStopPoint(2.5))}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            sliderValue >= 50 && sliderValue < 70 ? 'bg-purple-900 bg-opacity-30 text-purple-500 font-semibold' : 'text-gray-500 hover:text-purple-500'
          }`}
        >
          Advanced
        </button>
      </div>
    </div>
  );
};

export default WeightProgressionSlider;