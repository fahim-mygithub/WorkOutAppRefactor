import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ProgressionRecommendation } from '../../types/progression';
import { Button } from '@/components/ui/button';

interface SimpleProgressionIndicatorProps {
  recommendation: ProgressionRecommendation | null;
  onApply?: () => void;
  isLoading?: boolean;
}

/**
 * One-line suggestion (Tempo): informational, so it speaks in ice — the
 * suggested load as a tabular number, the delta as a quiet muted aside.
 */
export const SimpleProgressionIndicator: React.FC<SimpleProgressionIndicatorProps> = ({
  recommendation,
  onApply,
  isLoading = false,
}) => {
  if (isLoading || !recommendation) {
    return null;
  }

  const getIcon = () => {
    switch (recommendation.action) {
      case 'increase':
        return <TrendingUp size={16} className="shrink-0 text-accent-2" aria-hidden="true" />;
      case 'decrease':
      case 'deload':
        return <TrendingDown size={16} className="shrink-0 text-accent-2" aria-hidden="true" />;
      case 'maintain':
        return <Minus size={16} className="shrink-0 text-accent-2" aria-hidden="true" />;
      default:
        return null;
    }
  };

  const getActionText = () => {
    if (recommendation.recommendedWeight && recommendation.previousWeight) {
      const diff = recommendation.recommendedWeight - recommendation.previousWeight;
      if (diff > 0) {
        return `+${diff} lb`;
      } else if (diff < 0) {
        return `${diff} lb`;
      }
      return 'Same weight';
    }
    return recommendation.action;
  };

  const getRecommendationText = () => {
    if (recommendation.recommendedWeight) {
      return `${recommendation.recommendedWeight} lb × ${recommendation.recommendedReps || 8}`;
    }
    if (recommendation.recommendedVariation) {
      return recommendation.recommendedVariation;
    }
    if (recommendation.recommendedTime) {
      return `${recommendation.recommendedTime} s`;
    }
    return '';
  };

  return (
    <div className="flex min-h-touch-min items-center justify-between gap-3 rounded-2xl bg-surface-subtle py-1.5 pl-4 pr-1.5 text-body-sm">
      <div className="flex min-w-0 items-center gap-2">
        {getIcon()}
        <span className="text-ink-muted">Suggested</span>
        <span className="truncate font-semibold font-tabular text-ink">{getRecommendationText()}</span>
        <span className="shrink-0 text-caption font-tabular text-ink-muted">{getActionText()}</span>
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
