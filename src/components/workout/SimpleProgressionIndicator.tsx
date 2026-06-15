import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ProgressionRecommendation } from '../../types/progression';
import { Button } from '@/components/ui/button';

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
        return <TrendingUp className="w-4 h-4 text-success" />;
      case 'decrease':
      case 'deload':
        return <TrendingDown className="w-4 h-4 text-warning" />;
      case 'maintain':
        return <Minus className="w-4 h-4 text-accent" />;
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
    <div className="flex items-center justify-between bg-surface-subtle rounded-md px-3 py-2 text-body-sm">
      <div className="flex items-center gap-2">
        {getIcon()}
        <span className="text-ink-subtle">Suggested:</span>
        <span className="text-ink font-medium">{getRecommendationText()}</span>
        <span className={`text-caption ${
          recommendation.action === 'increase' ? 'text-success' :
          recommendation.action === 'decrease' ? 'text-warning' :
          'text-accent'
        }`}>
          ({getActionText()})
        </span>
      </div>
      {onApply && (
        <Button variant="secondary" size="sm" onClick={onApply}>
          Apply
        </Button>
      )}
    </div>
  );
};

export default SimpleProgressionIndicator;
