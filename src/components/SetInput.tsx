import React, { useState, useEffect } from 'react';
import { Check, X, Edit3, Save } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

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
        <div className="rounded-lg border-2 border-success/50 bg-success/15 p-4">
          <p className="mb-3 font-marker text-title text-success">
            Edit completed set
          </p>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <Label
                htmlFor="set-edit-reps"
                className="mb-2 block font-marker text-caption uppercase tracking-wider text-ink-muted"
              >
                Reps
              </Label>
              <Input
                id="set-edit-reps"
                type="number"
                inputMode="numeric"
                value={reps}
                onChange={(e) => setReps(parseInt(e.target.value) || 0)}
                onFocus={(e) => e.target.select()}
                onKeyDown={handleInputKeyDown}
                autoComplete="off"
                className="h-16 text-center text-display"
              />
            </div>
            <div>
              <Label
                htmlFor="set-edit-weight"
                className="mb-2 block font-marker text-caption uppercase tracking-wider text-ink-muted"
              >
                Weight <span className="normal-case text-ink-subtle">(lbs)</span>
              </Label>
              <Input
                id="set-edit-weight"
                type="number"
                inputMode="decimal"
                step="0.5"
                value={weight}
                onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                onFocus={(e) => e.target.select()}
                onKeyDown={handleInputKeyDown}
                autoComplete="off"
                className="h-16 text-center text-display"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveEdit} className="flex-1">
              <Save className="h-4 w-4" />
              <span>Save</span>
            </Button>
            <Button variant="secondary" onClick={handleCancelEdit} className="flex-1">
              <X className="h-4 w-4" />
              <span>Cancel</span>
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-lg border-2 border-success/50 bg-success/15 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-marker text-title text-success">Set done ✓</p>
            <p className="text-body-sm text-ink-muted">
              <span className="font-num font-tabular text-ink">{set.reps}</span>{' '}
              reps ×{' '}
              <span className="font-num font-tabular text-ink">
                {set.weight}
              </span>{' '}
              lbs
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleEdit}
              title="Edit Set"
            >
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onUncomplete}
              title="Mark Incomplete"
            >
              <X className="h-4 w-4" />
            </Button>
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
    <div className="rounded-lg bg-surface-subtle p-4">
      {isUsingSmartDefaults() && (
        <div className="mb-3 rounded-md border border-accent/40 bg-accent/10 p-2">
          <p className="font-hand text-body-sm text-accent">
            Auto-filled from {getDefaultSource()}
          </p>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <Label
            htmlFor="set-reps"
            className="mb-2 block font-marker text-caption uppercase tracking-wider text-ink-muted"
          >
            Reps
          </Label>
          <Input
            id="set-reps"
            type="number"
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(parseInt(e.target.value) || 0)}
            onFocus={(e) => e.target.select()}
            onKeyDown={handleInputKeyDown}
            autoComplete="off"
            className="h-16 text-center text-display"
          />
        </div>
        <div>
          <Label
            htmlFor="set-weight"
            className="mb-2 block font-marker text-caption uppercase tracking-wider text-ink-muted"
          >
            Weight <span className="normal-case text-ink-subtle">(lbs)</span>
          </Label>
          <Input
            id="set-weight"
            type="number"
            inputMode="decimal"
            step="0.5"
            value={weight}
            onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
            onFocus={(e) => e.target.select()}
            onKeyDown={handleInputKeyDown}
            autoComplete="off"
            className="h-16 text-center text-display"
          />
        </div>
      </div>
      <Button onClick={handleComplete} size="lg" className="w-full text-title">
        <Check className="h-5 w-5" />
        <span>Complete Set</span>
      </Button>
    </div>
  );
};
