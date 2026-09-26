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

  // Informational: every direction speaks in ice; the words carry the meaning.
  const getActionIcon = () => {
    switch (recommendation.action) {
      case 'increase':
        return <TrendingUp size={20} className="shrink-0 text-accent-2" aria-hidden="true" />;
      case 'decrease':
      case 'deload':
        return <TrendingDown size={20} className="shrink-0 text-accent-2" aria-hidden="true" />;
      case 'maintain':
        return <Minus size={20} className="shrink-0 text-accent-2" aria-hidden="true" />;
      default:
        return <AlertCircle size={20} className="shrink-0 text-ink-muted" aria-hidden="true" />;
    }
  };

  const confidenceLabel = `${recommendation.confidence.charAt(0).toUpperCase()}${recommendation.confidence.slice(1)} confidence`;

  const formatRecommendation = () => {
    if (recommendation.recommendedWeight) {
      const weightChange = recommendation.previousWeight
        ? recommendation.recommendedWeight - recommendation.previousWeight
        : 0;
      const sign = weightChange > 0 ? '+' : '';

      return (
        <div>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-display font-tabular text-display text-ink">
              {recommendation.recommendedWeight}
              <span className="text-body-sm font-semibold text-ink-muted"> lb</span>
              <span className="text-ink-muted"> × </span>
              {recommendation.recommendedReps}
            </span>
            {weightChange !== 0 && (
              <span className="font-tabular text-body-sm font-semibold text-accent-2">
                {sign}{weightChange} lb
              </span>
            )}
          </div>
          {recommendation.previousWeight && (
            <p className="mt-1 text-body-sm text-ink-muted">
              Last time <span className="font-tabular">{recommendation.previousWeight} lb × {recommendation.previousReps}</span>
              {recommendation.daysSinceLastWorkout && (
                <span>, <span className="font-tabular">{recommendation.daysSinceLastWorkout}</span> days ago</span>
              )}
            </p>
          )}
        </div>
      );
    }

    if (recommendation.recommendedTime) {
      return (
        <p className="text-title font-semibold text-ink">
          Hold for <span className="font-display font-tabular">{recommendation.recommendedTime}</span> seconds
        </p>
      );
    }

    if (recommendation.recommendedVariation) {
      return (
        <p className="text-title font-semibold text-ink">
          {recommendation.recommendedVariation}
        </p>
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
    <Card className="mb-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        {getActionIcon()}
        <h3 className="text-body-sm font-semibold text-ink">Suggested next</h3>
        <span className="text-caption text-ink-muted">{confidenceLabel}</span>
        {recommendation.deloadApplied && (
          <span className="ml-auto rounded-full bg-surface-raised px-2.5 py-1 text-caption font-semibold text-ink">
            Deload
          </span>
        )}
      </div>

      {/* Main recommendation — the number does the talking. */}
      <div className="mt-3">{formatRecommendation()}</div>

      <p className="mt-2 text-body-sm text-ink-muted">{recommendation.reasoning}</p>

      {/* Actions — one amber, the rest quiet. */}
      {!showCustomInput ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={onAccept}>
            <CheckCircle size={18} aria-hidden="true" />
            <span>Accept</span>
          </Button>
          <Button variant="secondary" onClick={() => setShowCustomInput(true)}>
            Modify
          </Button>
          <Button variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {recommendation.recommendedWeight !== undefined && (
            <Input
              type="number"
              inputMode="decimal"
              value={customWeight}
              onChange={(e) => setCustomWeight(Number(e.target.value))}
              className="w-24"
              placeholder="Weight"
              aria-label="Weight"
            />
          )}
          {recommendation.recommendedReps !== undefined && (
            <Input
              type="number"
              inputMode="numeric"
              value={customReps}
              onChange={(e) => setCustomReps(Number(e.target.value))}
              className="w-20"
              placeholder="Reps"
              aria-label="Reps"
            />
          )}
          <Button
            variant="primary"
            onClick={() => {
              onModify(customWeight, customReps);
              setShowCustomInput(false);
            }}
          >
            Apply
          </Button>
          <Button variant="ghost" onClick={() => setShowCustomInput(false)}>
            Cancel
          </Button>
        </div>
      )}

      {/* Alternatives — disclosed on demand, rows split by hairlines. */}
      {recommendation.alternatives && recommendation.alternatives.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            className="flex min-h-touch-min w-full items-center justify-between rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="text-body-sm font-semibold text-ink-muted">
              Other options <span className="font-tabular">({recommendation.alternatives.length})</span>
            </span>
            {isExpanded ? (
              <ChevronUp size={18} className="text-ink-muted" aria-hidden="true" />
            ) : (
              <ChevronDown size={18} className="text-ink-muted" aria-hidden="true" />
            )}
          </button>

          {isExpanded && (
            <ul className="divide-y divide-hairline">
              {recommendation.alternatives.map((alt, index) => (
                <li key={index} className="py-3">
                  <p className="text-body-sm font-semibold text-ink first-letter:uppercase">
                    {alt.type.replace('-', ' ')}
                  </p>
                  <p className="mt-0.5 text-body-sm text-ink-muted">{alt.description}</p>
                  <p className="mt-0.5 text-body-sm font-medium text-ink">{alt.recommendation}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
};

export default ProgressionRecommendation;
