import React from 'react';
import type { ExperienceLevel } from '../../types/progression';

interface ExperienceLevelButtonsProps {
  currentLevel: ExperienceLevel;
  onChange: (level: ExperienceLevel) => void;
  compact?: boolean;
}

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
    color: string;
  }[] = [
    {
      value: 'aggressive',
      label: 'Aggressive',
      description: 'Beginners',
      increment: '+10 lbs',
      color: 'green'
    },
    {
      value: 'standard',
      label: 'Standard',
      description: 'Intermediate',
      increment: '+5 lbs',
      color: 'blue'
    },
    {
      value: 'conservative',
      label: 'Conservative',
      description: 'Advanced',
      increment: '+2.5 lbs',
      color: 'purple'
    }
  ];

  if (compact) {
    // Compact version - just buttons
    return (
      <div className="flex space-x-2">
        {levels.map((level) => (
          <button
            key={level.value}
            onClick={() => onChange(level.value)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              currentLevel === level.value
                ? level.color === 'green'
                  ? 'bg-green-600 text-white'
                  : level.color === 'blue'
                  ? 'bg-blue-600 text-white'
                  : 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
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
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-300">Progression Rate</h3>
        <span className="text-xs text-gray-500">Select your experience level</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {levels.map((level) => (
          <button
            key={level.value}
            onClick={() => onChange(level.value)}
            className={`p-3 rounded-lg border transition-all ${
              currentLevel === level.value
                ? level.color === 'green'
                  ? 'border-green-500 bg-green-900 bg-opacity-20'
                  : level.color === 'blue'
                  ? 'border-blue-500 bg-blue-900 bg-opacity-20'
                  : 'border-purple-500 bg-purple-900 bg-opacity-20'
                : 'border-gray-700 bg-gray-850 hover:bg-gray-750 hover:border-gray-600'
            }`}
          >
            <div className="text-center">
              <div className={`text-sm font-semibold mb-1 ${
                currentLevel === level.value ? 'text-white' : 'text-gray-300'
              }`}>
                {level.label}
              </div>
              <div className="text-xs text-gray-500 mb-1">{level.description}</div>
              <div className={`text-xs font-medium ${
                currentLevel === level.value
                  ? level.color === 'green'
                    ? 'text-green-400'
                    : level.color === 'blue'
                    ? 'text-blue-400'
                    : 'text-purple-400'
                  : 'text-gray-400'
              }`}>
                {level.increment}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ExperienceLevelButtons;