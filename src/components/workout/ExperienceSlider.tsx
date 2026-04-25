import React, { useState } from 'react';
import { Info } from 'lucide-react';
import type { ExperienceLevel } from '../../types/progression';

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

  const levels: { value: ExperienceLevel; label: string; description: string; color: string }[] = [
    {
      value: 'aggressive',
      label: 'Aggressive',
      description: 'Recommended for beginners. Larger weight jumps for faster linear progression.',
      color: 'bg-green-500'
    },
    {
      value: 'standard',
      label: 'Standard',
      description: 'Balanced progression for intermediate lifters. Moderate weight increases.',
      color: 'bg-blue-500'
    },
    {
      value: 'conservative',
      label: 'Conservative',
      description: 'For advanced lifters. Smaller increments with undulating periodization.',
      color: 'bg-purple-500'
    }
  ];

  const currentIndex = levels.findIndex(l => l.value === currentLevel);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value);
    onChange(levels[index].value);
  };

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Progression Rate</h3>
        {showTooltip && (
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="text-gray-500 hover:text-gray-700 transition"
          >
            <Info className="w-4 h-4" />
          </button>
        )}
      </div>

      {showInfo && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
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
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right,
                ${currentIndex === 0 ? '#10b981' : '#e5e7eb'} 0% 33.33%,
                ${currentIndex === 1 ? '#3b82f6' : '#e5e7eb'} 33.33% 66.66%,
                ${currentIndex === 2 ? '#8b5cf6' : '#e5e7eb'} 66.66% 100%)`
            }}
          />

          {/* Labels */}
          <div className="flex justify-between mt-2">
            {levels.map((level, index) => (
              <div
                key={level.value}
                className={`text-xs font-medium transition ${
                  index === currentIndex ? 'text-gray-900' : 'text-gray-400'
                }`}
              >
                {level.label}
              </div>
            ))}
          </div>
        </div>

        {/* Current Selection Details */}
        <div className={`p-3 rounded-lg ${levels[currentIndex].color} bg-opacity-10`}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-gray-900">{levels[currentIndex].label}</span>
            <span className={`px-2 py-1 text-xs font-medium rounded-full text-white ${levels[currentIndex].color}`}>
              Active
            </span>
          </div>
          <p className="text-sm text-gray-600">{levels[currentIndex].description}</p>
        </div>

        {/* Quick Examples */}
        <div className="text-xs text-gray-500 space-y-1">
          <p className="font-medium">Example increments (upper body):</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className={currentIndex === 0 ? 'font-bold' : ''}>
              Aggressive: +10 lbs
            </div>
            <div className={currentIndex === 1 ? 'font-bold' : ''}>
              Standard: +5 lbs
            </div>
            <div className={currentIndex === 2 ? 'font-bold' : ''}>
              Conservative: +2.5 lbs
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: white;
          border: 2px solid #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: white;
          border: 2px solid #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
};

export default ExperienceSlider;