import React, { useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle } from 'lucide-react';
import type { ProgressionRecommendation as ProgressionRec } from '../../types/progression';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

interface ProgressionRecommendationProps {
  recommendation: ProgressionRec;
  onAccept: () => void;
  onModify: (weight?: number, reps?: number) => void;
  onDismiss: () => void;
  isLoading?: boolean;
}

export const ProgressionRecommendation: React.FC<ProgressionRecommendationProps> = ({
  recommendation,
  onAccept,
  onModify,
  onDismiss,
  isLoading = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [customWeight, setCustomWeight] = useState(recommendation.recommendedWeight || 0);
  const [customReps, setCustomReps] = useState(recommendation.recommendedReps || 0);
  const [showCustomInput, setShowCustomInput] = useState(false);

  const getActionIcon = () => {
    switch (recommendation.action) {
      case 'increase':
        return <TrendingUp className="w-5 h-5 text-success" />;
      case 'decrease':
      case 'deload':
        return <TrendingDown className="w-5 h-5 text-warning" />;
      case 'maintain':
        return <Minus className="w-5 h-5 text-accent" />;
      default:
        return <AlertCircle className="w-5 h-5 text-ink-subtle" />;
    }
  };

  const getActionColor = () => {
    switch (recommendation.action) {
      case 'increase':
        return 'border-success/30 bg-success/10';
      case 'decrease':
      case 'deload':
        return 'border-warning/30 bg-warning/10';
      case 'maintain':
        return 'border-accent/30 bg-accent/10';
      default:
        return 'border-border bg-surface-subtle';
    }
  };

  const getConfidenceBadge = () => {
    const colors = {
      high: 'bg-success/15 text-success',
      medium: 'bg-warning/15 text-warning',
      low: 'bg-danger/15 text-danger'
    };

    return (
      <span className={`px-2 py-1 text-caption font-medium rounded-full ${colors[recommendation.confidence]}`}>
        {recommendation.confidence} confidence
      </span>
    );
  };

  const formatRecommendation = () => {
    if (recommendation.recommendedWeight) {
      const weightChange = recommendation.previousWeight
        ? recommendation.recommendedWeight - recommendation.previousWeight
        : 0;
      const sign = weightChange > 0 ? '+' : '';

      return (
        <div className="space-y-1">
          <div className="text-title font-semibold text-ink">
            {recommendation.recommendedWeight} lbs × {recommendation.recommendedReps} reps
            {weightChange !== 0 && (
              <span className={`ml-2 text-body-sm ${weightChange > 0 ? 'text-success' : 'text-warning'}`}>
                ({sign}{weightChange} lbs)
              </span>
            )}
          </div>
          {recommendation.previousWeight && (
            <div className="text-body-sm text-ink-muted">
              Previous: {recommendation.previousWeight} lbs × {recommendation.previousReps} reps
              {recommendation.daysSinceLastWorkout && (
                <span className="ml-2">({recommendation.daysSinceLastWorkout} days ago)</span>
              )}
            </div>
          )}
        </div>
      );
    }

    if (recommendation.recommendedTime) {
      return (
        <div className="text-title font-semibold text-ink">
          Hold for {recommendation.recommendedTime} seconds
        </div>
      );
    }

    if (recommendation.recommendedVariation) {
      return (
        <div className="text-title font-semibold text-ink">
          {recommendation.recommendedVariation}
        </div>
      );
    }

    return null;
  };

  if (isLoading) {
    return (
      <Card className="p-4 mb-4" aria-busy="true">
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </Card>
    );
  }

  return (
    <div className={`border rounded-lg p-4 mb-4 transition-colors duration-smooth ${getActionColor()}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {getActionIcon()}
          <h3 className="font-semibold text-ink">Progression Recommendation</h3>
          {getConfidenceBadge()}
        </div>
        {recommendation.deloadApplied && (
          <span className="px-2 py-1 text-caption font-medium bg-warning/15 text-warning rounded-full">
            Deload Applied
          </span>
        )}
      </div>

      {/* Main Recommendation */}
      <div className="mb-3">
        {formatRecommendation()}
      </div>

      {/* Reasoning - Always visible */}
      <p className="text-body-sm text-ink-muted mb-3">{recommendation.reasoning}</p>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Button variant="primary" size="sm" onClick={onAccept}>
          <CheckCircle className="w-4 h-4" />
          <span>Accept</span>
        </Button>

        {!showCustomInput ? (
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowCustomInput(true)}>
              Modify
            </Button>
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Dismiss
            </Button>
          </>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            {recommendation.recommendedWeight !== undefined && (
              <Input
                type="number"
                size="sm"
                value={customWeight}
                onChange={(e) => setCustomWeight(Number(e.target.value))}
                className="w-24"
                placeholder="Weight"
              />
            )}
            {recommendation.recommendedReps !== undefined && (
              <Input
                type="number"
                size="sm"
                value={customReps}
                onChange={(e) => setCustomReps(Number(e.target.value))}
                className="w-20"
                placeholder="Reps"
              />
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onModify(customWeight, customReps);
                setShowCustomInput(false);
              }}
            >
              Apply
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowCustomInput(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Expandable Alternatives Section */}
      {recommendation.alternatives && recommendation.alternatives.length > 0 && (
        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-body-sm font-medium text-ink-muted">
              Alternative Progressions ({recommendation.alternatives.length})
            </span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-ink-subtle" />
            ) : (
              <ChevronDown className="w-4 h-4 text-ink-subtle" />
            )}
          </button>

          {isExpanded && (
            <div className="mt-3 space-y-2">
              {recommendation.alternatives.map((alt, index) => (
                <Card key={index} elevation={0} className="p-3 bg-surface-raised/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-body-sm font-medium text-ink capitalize">
                      {alt.type.replace('-', ' ')}
                    </span>
                  </div>
                  <p className="text-body-sm text-ink-muted mb-1">{alt.description}</p>
                  <p className="text-body-sm text-ink font-medium">{alt.recommendation}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProgressionRecommendation;
