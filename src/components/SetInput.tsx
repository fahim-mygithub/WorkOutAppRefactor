import React, { useState, useEffect } from 'react';
import { Check, X, Edit3, Save } from 'lucide-react';

interface SetInputProps {
  set: any;
  onComplete: (reps: number, weight: number) => void;
  onUncomplete: () => void;
  previousSet?: any;
  allSets?: any[];
  recommendedWeight?: number;
  recommendedReps?: number;
}

export const SetInput: React.FC<SetInputProps> = ({
  set,
  onComplete,
  onUncomplete,
  previousSet,
  allSets = [],
  recommendedWeight,
  recommendedReps
}) => {
  const [reps, setReps] = useState(0);
  const [weight, setWeight] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  // Smart defaults logic
  const getSmartDefaults = () => {
    // First priority: Use configured reps from the set (e.g., from "4x8" parsing)
    // Handle both reps and weight separately to avoid issues with first-time exercises
    let defaultReps = set?.reps || 0;
    let defaultWeight = set?.weight || 0;

    // If the set already has both values (completed set), use them
    if (set?.reps && set?.weight && set?.completed) {
      return { reps: set.reps, weight: set.weight };
    }

    // Use recommendations if available (takes precedence for weight, but respect configured reps)
    if (recommendedReps !== undefined) {
      defaultReps = recommendedReps;
    }
    if (recommendedWeight !== undefined) {
      defaultWeight = recommendedWeight;
    }

    // If we have recommendation or configured reps, use them
    if (defaultReps > 0 || recommendedReps !== undefined || recommendedWeight !== undefined) {
      return {
        reps: defaultReps || previousSet?.reps || 8,
        weight: defaultWeight || previousSet?.weight || 0
      };
    }

    // Try to get from previous set if no configured values
    if (previousSet?.reps && previousSet?.weight) {
      return { reps: previousSet.reps, weight: previousSet.weight };
    }

    // Try to get from the last completed set
    const lastCompleted = allSets
      .slice()
      .reverse()
      .find(s => s.completed && s.reps && s.weight);

    if (lastCompleted) {
      return { reps: lastCompleted.reps, weight: lastCompleted.weight };
    }

    // Final fallback - use configured reps or sensible defaults
    return {
      reps: defaultReps > 0 ? defaultReps : 8,
      weight: defaultWeight
    };
  };

  useEffect(() => {
    if (set) {
      const { reps: defaultReps, weight: defaultWeight } = getSmartDefaults();
      setReps(defaultReps);
      setWeight(defaultWeight);
    }
  }, [set, previousSet, allSets]);

  // Update when recommendation changes
  useEffect(() => {
    if (recommendedWeight !== undefined && !set?.completed) {
      setWeight(recommendedWeight);
    }
    if (recommendedReps !== undefined && !set?.completed) {
      setReps(recommendedReps);
    }
  }, [recommendedWeight, recommendedReps, set?.completed]);

  const handleComplete = () => {
    onComplete(reps, weight);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    onComplete(reps, weight);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    // Reset to original values
    setReps(set?.reps || 0);
    setWeight(set?.weight || 0);
    setIsEditing(false);
  };

  // Prevent keyboard shortcuts from interfering with input
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  if (set?.completed) {
    if (isEditing) {
      return (
        <div className="bg-green-600 rounded-lg p-4 text-white">
          <p className="font-medium mb-3">Edit Completed Set</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2 opacity-90">Reps</label>
              <input
                type="number"
                inputMode="numeric"
                value={reps}
                onChange={(e) => setReps(parseInt(e.target.value) || 0)}
                onFocus={(e) => e.target.select()}
                onKeyDown={handleInputKeyDown}
                className="w-full p-2 bg-green-700 border border-green-500 rounded-lg text-white placeholder-green-200 focus:ring-2 focus:ring-green-300 focus:border-transparent"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 opacity-90">Weight (lbs)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                value={weight}
                onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                onFocus={(e) => e.target.select()}
                onKeyDown={handleInputKeyDown}
                className="w-full p-2 bg-green-700 border border-green-500 rounded-lg text-white placeholder-green-200 focus:ring-2 focus:ring-green-300 focus:border-transparent"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleSaveEdit}
              className="flex items-center space-x-2 bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg transition-colors flex-1"
            >
              <Save className="w-4 h-4" />
              <span>Save</span>
            </button>
            <button
              onClick={handleCancelEdit}
              className="flex items-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors flex-1"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-green-600 rounded-lg p-4 text-white">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-medium">Set Completed ✓</p>
            <p className="text-sm opacity-75">{set.reps} reps × {set.weight} lbs</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleEdit}
              className="p-2 bg-green-700 hover:bg-green-800 rounded transition-colors"
              title="Edit Set"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={onUncomplete}
              className="p-2 bg-green-700 hover:bg-green-800 rounded transition-colors"
              title="Mark Incomplete"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check if we're using smart defaults
  const isUsingSmartDefaults = () => {
    if (set?.reps && set?.weight) return false;
    return (recommendedWeight !== undefined) ||
           (previousSet?.reps && previousSet?.weight) ||
           allSets.some(s => s.completed && s.reps && s.weight);
  };

  const getDefaultSource = () => {
    if (recommendedWeight !== undefined) return 'progression recommendation';
    if (previousSet?.reps && previousSet?.weight) return 'previous set';
    return 'last completed set';
  };

  return (
    <div className="bg-gray-700 rounded-lg p-4">
      {isUsingSmartDefaults() && (
        <div className="mb-3 p-2 bg-blue-600 bg-opacity-20 border border-blue-500 rounded-lg">
          <p className="text-blue-300 text-sm">
            💡 Auto-filled from {getDefaultSource()}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Reps</label>
          <input
            type="number"
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(parseInt(e.target.value) || 0)}
            onFocus={(e) => e.target.select()}
            onKeyDown={handleInputKeyDown}
            className="w-full p-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Weight (lbs)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={weight}
            onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
            onFocus={(e) => e.target.select()}
            onKeyDown={handleInputKeyDown}
            className="w-full p-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoComplete="off"
          />
        </div>
      </div>
      <button
        onClick={handleComplete}
        className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg transition-colors"
      >
        <Check className="w-4 h-4" />
        <span>Complete Set</span>
      </button>
    </div>
  );
};