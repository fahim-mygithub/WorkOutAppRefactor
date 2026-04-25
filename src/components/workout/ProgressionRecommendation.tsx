import React, { useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle } from 'lucide-react';
import type { ProgressionRecommendation as ProgressionRec } from '../../types/progression';

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
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'decrease':
      case 'deload':
        return <TrendingDown className="w-5 h-5 text-yellow-500" />;
      case 'maintain':
        return <Minus className="w-5 h-5 text-blue-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getActionColor = () => {
    switch (recommendation.action) {
      case 'increase':
        return 'border-green-200 bg-green-50';
      case 'decrease':
      case 'deload':
        return 'border-yellow-200 bg-yellow-50';
      case 'maintain':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getConfidenceBadge = () => {
    const colors = {
      high: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[recommendation.confidence]}`}>
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
          <div className="text-lg font-semibold">
            {recommendation.recommendedWeight} lbs × {recommendation.recommendedReps} reps
            {weightChange !== 0 && (
              <span className={`ml-2 text-sm ${weightChange > 0 ? 'text-green-600' : 'text-yellow-600'}`}>
                ({sign}{weightChange} lbs)
              </span>
            )}
          </div>
          {recommendation.previousWeight && (
            <div className="text-sm text-gray-600">
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
        <div className="text-lg font-semibold">
          Hold for {recommendation.recommendedTime} seconds
        </div>
      );
    }

    if (recommendation.recommendedVariation) {
      return (
        <div className="text-lg font-semibold">
          {recommendation.recommendedVariation}
        </div>
      );
    }

    return null;
  };

  if (isLoading) {
    return (
      <div className="animate-pulse bg-gray-100 rounded-lg p-4 mb-4">
        <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-300 rounded w-1/2"></div>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-4 mb-4 transition-all ${getActionColor()}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {getActionIcon()}
          <h3 className="font-semibold text-gray-900">Progression Recommendation</h3>
          {getConfidenceBadge()}
        </div>
        {recommendation.deloadApplied && (
          <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
            Deload Applied
          </span>
        )}
      </div>

      {/* Main Recommendation */}
      <div className="mb-3">
        {formatRecommendation()}
      </div>

      {/* Reasoning - Always visible */}
      <p className="text-sm text-gray-700 mb-3">{recommendation.reasoning}</p>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={onAccept}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center space-x-1"
        >
          <CheckCircle className="w-4 h-4" />
          <span>Accept</span>
        </button>

        {!showCustomInput ? (
          <>
            <button
              onClick={() => setShowCustomInput(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Modify
            </button>
            <button
              onClick={onDismiss}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              Dismiss
            </button>
          </>
        ) : (
          <div className="flex items-center space-x-2 flex-1">
            {recommendation.recommendedWeight !== undefined && (
              <input
                type="number"
                value={customWeight}
                onChange={(e) => setCustomWeight(Number(e.target.value))}
                className="w-24 px-2 py-1 border rounded"
                placeholder="Weight"
              />
            )}
            {recommendation.recommendedReps !== undefined && (
              <input
                type="number"
                value={customReps}
                onChange={(e) => setCustomReps(Number(e.target.value))}
                className="w-20 px-2 py-1 border rounded"
                placeholder="Reps"
              />
            )}
            <button
              onClick={() => {
                onModify(customWeight, customReps);
                setShowCustomInput(false);
              }}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Apply
            </button>
            <button
              onClick={() => setShowCustomInput(false)}
              className="px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Expandable Alternatives Section */}
      {recommendation.alternatives && recommendation.alternatives.length > 0 && (
        <div className="border-t pt-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-sm font-medium text-gray-700">
              Alternative Progressions ({recommendation.alternatives.length})
            </span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>

          {isExpanded && (
            <div className="mt-3 space-y-2">
              {recommendation.alternatives.map((alt, index) => (
                <div key={index} className="p-3 bg-white bg-opacity-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {alt.type.replace('-', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">{alt.description}</p>
                  <p className="text-sm text-gray-800 font-medium">{alt.recommendation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProgressionRecommendation;