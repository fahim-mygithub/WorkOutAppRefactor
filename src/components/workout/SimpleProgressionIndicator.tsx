import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ProgressionRecommendation } from '../../types/progression';

interface SimpleProgressionIndicatorProps {
  recommendation: ProgressionRecommendation | null;
  onApply?: () => void;
  isLoading?: boolean;
}

export const SimpleProgressionIndicator: React.FC<SimpleProgressionIndicatorProps> = ({
  recommendation,
  onApply,
  isLoading = false
}) => {
  if (isLoading || !recommendation) {
    return null;
  }

  const getIcon = () => {
    switch (recommendation.action) {
      case 'increase':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'decrease':
      case 'deload':
        return <TrendingDown className="w-4 h-4 text-yellow-500" />;
      case 'maintain':
        return <Minus className="w-4 h-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getActionText = () => {
    if (recommendation.recommendedWeight && recommendation.previousWeight) {
      const diff = recommendation.recommendedWeight - recommendation.previousWeight;
      if (diff > 0) {
        return `+${diff} lbs`;
      } else if (diff < 0) {
        return `${diff} lbs`;
      }
      return 'Same weight';
    }
    return recommendation.action;
  };

  const getRecommendationText = () => {
    if (recommendation.recommendedWeight) {
      return `${recommendation.recommendedWeight} lbs × ${recommendation.recommendedReps || 8}`;
    }
    if (recommendation.recommendedVariation) {
      return recommendation.recommendedVariation;
    }
    if (recommendation.recommendedTime) {
      return `${recommendation.recommendedTime} seconds`;
    }
    return '';
  };

  return (
    <div className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2 text-sm">
      <div className="flex items-center space-x-2">
        {getIcon()}
        <span className="text-gray-400">Suggested:</span>
        <span className="text-white font-medium">{getRecommendationText()}</span>
        <span className={`text-xs ${
          recommendation.action === 'increase' ? 'text-green-500' :
          recommendation.action === 'decrease' ? 'text-yellow-500' :
          'text-blue-500'
        }`}>
          ({getActionText()})
        </span>
      </div>
      {onApply && (
        <button
          onClick={onApply}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors"
        >
          Apply
        </button>
      )}
    </div>
  );
};

export default SimpleProgressionIndicator;