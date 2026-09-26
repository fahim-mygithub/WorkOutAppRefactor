import React, { useState, useEffect } from 'react';
import { Check, X, Edit3, Save, Minus, Plus, Undo2 } from 'lucide-react';
import { Button } from './ui/button';
import { IconButton } from './ui/icon-button';
import { cn } from '@/lib/utils';
import { prescribedFloor, formatRepRange } from '@/lib/progression/setPrescription';

/** Optional reps-in-reserve taps. `3` renders as "3+" (3 or more left in the
 *  tank); an unset value means the lifter skipped logging effort for this set. */
const RIR_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: '0' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3+' },
];

// Stable fallback: a fresh `[]` default would change identity every render and
// re-fire the smart-defaults effect, clobbering stepper/typed edits.
const NO_SETS: any[] = [];

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
  allSets = NO_SETS,
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
    let defaultReps = set ? prescribedFloor(set) : 0;
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

  // Re-derives reps/weight from the smart defaults whenever the set (or the
  // unstable allSets/previousSet identities) change. RIR is deliberately NOT reset
  // here — it lives in the set-identity effect below so an in-progress tap survives
  // this effect's re-fires. Re-deriving reps/weight mid-edit is safe today because
  // no action mutates the sets array during a single set's edit.
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
        <div className={cn('rounded-3xl bg-surface-raised/40', compact ? 'p-3' : 'p-4')}>
          <p className="mb-3 text-body-sm font-semibold text-accent-2">Edit logged set</p>
          <div className="space-y-2">
            <Stepper
              id="set-edit-weight"
              label="Weight"
              unit="lb"
              value={weight}
              step={WEIGHT_STEP}
              decimal
              compact={compact}
              onChange={setWeight}
              onKeyDown={handleInputKeyDown}
            />
            <Stepper
              id="set-edit-reps"
              label="Reps"
              unit="reps"
              value={reps}
              step={1}
              compact={compact}
              onChange={setReps}
              onKeyDown={handleInputKeyDown}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" size="lg" onClick={handleCancelEdit}>
              <X className="h-4 w-4" aria-hidden="true" />
              <span>Cancel</span>
            </Button>
            <Button size="lg" onClick={handleSaveEdit}>
              <Save className="h-4 w-4" aria-hidden="true" />
              <span>Save</span>
            </Button>
          </div>
        </div>
      );
    }

    // Logged: ice = done. The numbers stay large so the lifter can confirm at
    // a glance; edit / undo are quiet secondary pills.
    return (
      <div className={cn('flex items-center gap-3 rounded-3xl bg-accent-2/10', compact ? 'p-3' : 'p-4')}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-2 text-accent-2-fg">
          <Check className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body-sm font-semibold text-accent-2">Set logged</p>
          <p className="font-display font-tabular text-title text-ink">
            {set.weight}
            <span className="font-sans text-body-sm font-normal tracking-normal text-ink-muted [font-stretch:100%]"> lb × </span>
            {set.reps}
          </p>
        </div>
        <IconButton variant="secondary" size="md" onClick={handleEdit} aria-label="Edit set">
          <Edit3 className="h-4 w-4" />
        </IconButton>
        <IconButton variant="secondary" size="md" onClick={onUncomplete} aria-label="Undo set">
          <Undo2 className="h-4 w-4" />
        </IconButton>
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
    if (recommendedWeight !== undefined) return 'your progression';
    if (previousSet?.reps && previousSet?.weight) return 'your previous set';
    return 'your last logged set';
  };

  // Prescribed rep range — shown as the target under the Reps number. Only a
  // real range (floor ≠ ceiling) is surfaced; a single configured rep count is
  // already carried by the stepper's default value.
  const repRangeLabel = set ? formatRepRange(set) : null;

  return (
    <div>
      {!compact && isUsingSmartDefaults() && (
        <p className="mb-2 text-center text-body-sm text-ink-muted">
          Filled from {getDefaultSource()}
        </p>
      )}

      <div className={cn(compact ? 'space-y-1' : 'space-y-3')}>
        <Stepper
          id="set-weight"
          label="Weight"
          unit="lb"
          value={weight}
          step={WEIGHT_STEP}
          decimal
          compact={compact}
          onChange={setWeight}
          onKeyDown={handleInputKeyDown}
        />
        <Stepper
          id="set-reps"
          label="Reps"
          unit="reps"
          hint={
            repRangeLabel ? (
              <>
                target <span aria-label={`Target ${repRangeLabel} reps`}>{repRangeLabel}</span>
              </>
            ) : undefined
          }
          value={reps}
          step={1}
          compact={compact}
          accent
          onChange={setReps}
          onKeyDown={handleInputKeyDown}
        />
      </div>

      {/* Optional reps-in-reserve tap — unset by default (skippable). Ice when
          chosen: it's information about the set, not the next action. */}
      <div className={cn('flex items-center gap-2', compact ? 'mt-2' : 'mt-4')}>
        <span className="w-12 shrink-0 text-caption leading-tight text-ink-muted">
          Reps left
        </span>
        <div className="flex flex-1 gap-1.5" role="group" aria-label="Reps in reserve">
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
                  'flex min-h-touch-min flex-1 items-center justify-center rounded-full font-num font-tabular text-body-sm font-semibold leading-none transition-colors duration-snap',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                  selected
                    ? 'bg-accent-2 text-accent-2-fg'
                    : 'bg-surface-raised text-ink-muted hover:text-ink',
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* The one forward action on the screen. */}
      <Button
        onClick={handleComplete}
        size={compact ? 'lg' : 'xl'}
        className={cn('w-full', compact ? 'mt-2.5 text-[18px] font-bold' : 'mt-5')}
      >
        <Check className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
        <span>Log set</span>
      </Button>
    </div>
  );
};

const WEIGHT_STEP = 5;

interface StepperProps {
  id: string;
  label: string;
  unit: string;
  value: number;
  step: number;
  onChange: (value: number) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  /** Allow decimal entry (weight). */
  decimal?: boolean;
  compact?: boolean;
  /** Tint the number ice (reps) to separate it from the load. */
  accent?: boolean;
  /** Replaces the unit caption under the number (e.g. the target rep range). */
  hint?: React.ReactNode;
}

/**
 * One Tempo stepper row: round − / + on either side of a big editable number.
 * The number is a real <input type="number"> (tap to type) with a visually
 * hidden label, so the value stays accessible and testable by label.
 */
function Stepper({
  id,
  label,
  unit,
  value,
  step,
  onChange,
  onKeyDown,
  decimal = false,
  compact = false,
  accent = false,
  hint,
}: StepperProps) {
  const nudge = (dir: 1 | -1) => {
    const next = Math.max(0, Math.round((value + dir * step) * 100) / 100);
    onChange(next);
  };
  const noun = label.toLowerCase();
  const btn = cn(
    'flex shrink-0 items-center justify-center rounded-full bg-surface-raised text-ink transition-[background-color,transform] duration-snap',
    'hover:bg-surface-raised/70 active:scale-95',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
    compact ? 'h-12 w-12' : 'h-14 w-14',
  );
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btn} aria-label={`Decrease ${noun}`} onClick={() => nudge(-1)}>
        <Minus className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col items-center">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <input
          id={id}
          type="number"
          inputMode={decimal ? 'decimal' : 'numeric'}
          step={decimal ? '0.5' : '1'}
          value={value}
          onChange={(e) =>
            onChange((decimal ? parseFloat(e.target.value) : parseInt(e.target.value, 10)) || 0)
          }
          onFocus={(e) => e.target.select()}
          onKeyDown={onKeyDown}
          autoComplete="off"
          className={cn(
            'w-full rounded-2xl bg-transparent text-center font-display font-tabular leading-none outline-none',
            'focus-visible:bg-surface-raised/50 focus-visible:ring-2 focus-visible:ring-accent',
            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            compact ? 'h-12 text-[44px]' : 'h-16 text-metric',
            accent ? 'text-accent-2' : 'text-ink',
          )}
        />
        <span className="text-caption leading-tight text-ink-muted">{hint ?? unit}</span>
      </div>
      <button type="button" className={btn} aria-label={`Increase ${noun}`} onClick={() => nudge(1)}>
        <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
}
