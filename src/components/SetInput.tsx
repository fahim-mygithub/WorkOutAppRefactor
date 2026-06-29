import React, { useState, useEffect } from 'react';
import { Check, X, Edit3, Save } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { cn } from '@/lib/utils';

/** Optional reps-in-reserve taps. `3` renders as "3+" (3 or more left in the
 *  tank); an unset value means the lifter skipped logging effort for this set. */
const RIR_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: '0' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3+' },
];

interface SetInputProps {
  set: any;
  onComplete: (reps: number, weight: number, rir?: number) => void;
  onUncomplete: () => void;
  previousSet?: any;
  allSets?: any[];
  recommendedWeight?: number;
  recommendedReps?: number;
  /** Tighten padding, input height, and the action button for the no-scroll player. */
  compact?: boolean;
}

export const SetInput: React.FC<SetInputProps> = ({
  set,
  onComplete,
  onUncomplete,
  previousSet,
  allSets = [],
  recommendedWeight,
  recommendedReps,
  compact = false,
}) => {
  const [reps, setReps] = useState(0);
  const [weight, setWeight] = useState(0);
  const [rir, setRir] = useState<number | undefined>(undefined);
  const [isEditing, setIsEditing] = useState(false);

  // Smart defaults logic
  const getSmartDefaults = () => {
    // First priority: Use configured reps from the set (e.g., from "4x8" parsing).
    // With a prescribed range, default to the floor (repMin) — double-progression
    // starts at the bottom of the range and only the load advances once it's beaten.
    // Handle both reps and weight separately to avoid issues with first-time exercises
    let defaultReps = set?.repMin ?? set?.reps ?? 0;
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

  // Seed RIR only when the set itself changes (not on every render — the effect
  // above re-fires whenever the unstable `allSets`/`previousSet` defaults change,
  // which must not clobber an in-progress tap). Fresh sets start unset (skipped);
  // a revisited set restores its stored effort.
  useEffect(() => {
    setRir(set?.rir);
  }, [set?.id, set?.rir]);

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
    onComplete(reps, weight, rir);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    onComplete(reps, weight, rir);
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
      <div className={cn('rounded-lg border-2 border-success/50 bg-success/15', compact ? 'p-3' : 'p-4')}>
        <div className="flex items-center justify-between">
          <div>
            <p className={cn('font-marker text-success', compact ? 'text-body' : 'text-title')}>Set done ✓</p>
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

  // Prescribed rep range — shown as a hint beside the editable Reps field. Only a
  // real range (floor ≠ ceiling) is surfaced; a single configured rep count is
  // already carried by the input's default value, so no separate hint is needed.
  const repMin = set?.repMin;
  const repMax = set?.repMax;
  const repRangeLabel =
    repMin != null && repMax != null && repMin !== repMax ? `${repMin}–${repMax}` : null;

  return (
    <div className={cn('rounded-lg bg-surface-subtle', compact ? 'p-3' : 'p-4')}>
      {!compact && isUsingSmartDefaults() && (
        <div className="mb-3 rounded-md border border-accent/40 bg-accent/10 p-2">
          <p className="font-hand text-body-sm text-accent">
            Auto-filled from {getDefaultSource()}
          </p>
        </div>
      )}

      <div className={cn('grid grid-cols-2 items-end gap-3', compact ? 'mb-2.5' : 'mb-4')}>
        <div>
          <div className={cn('flex items-baseline justify-between gap-1', compact ? 'mb-1' : 'mb-2')}>
            <Label
              htmlFor="set-reps"
              className={cn('block font-marker uppercase tracking-wider text-ink-muted', compact ? 'text-[10px]' : 'text-caption')}
            >
              Reps
            </Label>
            {repRangeLabel && (
              <span
                className={cn('font-num font-tabular leading-none text-ink-subtle', compact ? 'text-[10px]' : 'text-caption')}
                aria-label={`Target ${repRangeLabel} reps`}
              >
                {repRangeLabel}
              </span>
            )}
          </div>
          <Input
            id="set-reps"
            type="number"
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(parseInt(e.target.value) || 0)}
            onFocus={(e) => e.target.select()}
            onKeyDown={handleInputKeyDown}
            autoComplete="off"
            className={cn('text-center', compact ? 'h-12 text-2xl' : 'h-16 text-display')}
          />
        </div>
        <div>
          <Label
            htmlFor="set-weight"
            className={cn('block font-marker uppercase tracking-wider text-ink-muted', compact ? 'mb-1 text-[10px]' : 'mb-2 text-caption')}
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
            className={cn('text-center', compact ? 'h-12 text-2xl' : 'h-16 text-display')}
          />
        </div>
      </div>

      {/* Optional reps-in-reserve tap — unset by default (skippable). Kept on one
          tight row so it stays unobtrusive in the no-scroll compact player. */}
      <div className={cn('flex items-center gap-2', compact ? 'mb-2.5' : 'mb-4')}>
        <span
          className={cn(
            'shrink-0 font-marker uppercase tracking-wider text-ink-muted',
            compact ? 'text-[10px]' : 'text-caption',
          )}
        >
          RIR
        </span>
        <div className="flex flex-1 gap-1" role="group" aria-label="Reps in reserve">
          {RIR_OPTIONS.map((opt) => {
            const selected = rir === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-label={`RIR ${opt.label}`}
                aria-pressed={selected}
                // Tapping the active chip clears it back to skipped.
                onClick={() => setRir(selected ? undefined : opt.value)}
                className={cn(
                  'flex-1 rounded-md border text-center font-num font-tabular leading-none transition-colors',
                  compact ? 'py-1 text-caption' : 'py-1.5 text-body-sm',
                  selected
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-board-line/25 bg-surface-subtle text-ink-muted',
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stays a colored, labeled action — just smaller in compact (md vs lg). */}
      <Button
        onClick={handleComplete}
        size={compact ? 'md' : 'lg'}
        className={cn('w-full', !compact && 'text-title')}
      >
        <Check className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
        <span>Complete Set</span>
      </Button>
    </div>
  );
};
