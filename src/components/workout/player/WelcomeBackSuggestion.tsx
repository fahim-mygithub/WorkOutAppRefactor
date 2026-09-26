// WelcomeBackSuggestion — opt-in "welcome back" prompt shown when arriving at an
// exercise after a real layoff (≥3 weeks). It replaces the old auto-deload modal,
// which silently cut the load and ALWAYS printed a hardcoded −15%. This one never
// applies anything on its own and never hardcodes the percentage: it surfaces the
// REAL reductionPct from the pure layoff delegate and lets the lifter choose to
// ease in lighter or keep the full load. Bottom-sheet so it stays clear of the
// no-scroll player flow.
import React from 'react';
import type { LayoffSuggestion } from '@/lib/progression';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface WelcomeBackSuggestionProps {
  suggestion: LayoffSuggestion;
  /** The full (pre-cut) working load — shown verbatim as what we're easing FROM. */
  previousWeight: number;
  exerciseName: string;
  /** Apply the lighter easing-in load to the working sets. */
  onApply: (weight: number) => void;
  /** Keep the full load (or dismiss via backdrop/Escape). */
  onDismiss: () => void;
}

export const WelcomeBackSuggestion: React.FC<WelcomeBackSuggestionProps> = ({
  suggestion,
  previousWeight,
  exerciseName,
  onApply,
  onDismiss,
}) => {
  // The parent unmounts us on every dismissal path (per-exercise answered flag),
  // so there's no exit animation to preserve — render open and treat any Radix
  // close (backdrop / Escape) as an honest, instant dismissal.
  const handleOpenChange = (next: boolean) => {
    if (!next) onDismiss();
  };

  return (
    <Sheet open onOpenChange={handleOpenChange}>
      <SheetContent className="mx-auto max-w-md">
        <p className="text-body-sm text-ink-muted">{exerciseName}</p>
        <SheetTitle className="mt-1 font-display text-display text-ink">Welcome back</SheetTitle>
        <SheetDescription className="mt-2 text-body-sm text-ink-muted">
          {suggestion.message}
        </SheetDescription>

        {/* The lighter load is the hero; the full load and the REAL cut sit beside it. */}
        <dl className="mt-6 grid grid-cols-3 items-end gap-3">
          <div className="col-span-2 min-w-0">
            <dt className="sr-only">Ease in</dt>
            <dd className="font-display font-tabular text-display-lg text-ink">
              {suggestion.suggestedWeight}
              <span className="ml-1 text-title text-ink-muted">lb</span>
            </dd>
            <dd aria-hidden="true" className="mt-1 text-body-sm text-ink-muted">
              ease in, from <span className="font-num font-tabular">{previousWeight} lb</span>
            </dd>
          </div>
          <div className="text-right">
            <dt className="sr-only">Lighter by</dt>
            <dd className="font-display font-tabular text-title text-accent-2">
              −{suggestion.reductionPct}%
            </dd>
            <dd aria-hidden="true" className="mt-1 text-body-sm text-ink-muted">lighter</dd>
          </div>
        </dl>

        {/* Opt-in: nothing changes unless the lifter taps "Use …". */}
        <div className="mt-8 flex flex-col gap-2">
          <Button size="xl" onClick={() => onApply(suggestion.suggestedWeight)}>
            Use {suggestion.suggestedWeight} lb
          </Button>
          <Button variant="ghost" size="lg" onClick={onDismiss}>
            Keep full load
          </Button>
        </div>

        <p className="mt-2 text-center text-caption text-ink-subtle">
          Optional. You can change the weight on your first set.
        </p>
      </SheetContent>
    </Sheet>
  );
};

export default WelcomeBackSuggestion;
