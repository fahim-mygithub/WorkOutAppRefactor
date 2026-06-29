// WelcomeBackSuggestion — opt-in "welcome back" prompt shown when arriving at an
// exercise after a real layoff (≥3 weeks). It replaces the old auto-deload modal,
// which silently cut the load and ALWAYS printed a hardcoded −15%. This one never
// applies anything on its own and never hardcodes the percentage: it surfaces the
// REAL reductionPct from the pure layoff delegate and lets the lifter choose to
// ease in lighter or keep the full load. Bottom-sheet so it stays clear of the
// no-scroll player flow.
import React, { useState } from 'react';
import { Sparkles, TrendingDown } from 'lucide-react';
import type { LayoffSuggestion } from '@/lib/progression';
import { round5 } from '@/lib/progression';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface WelcomeBackSuggestionProps {
  suggestion: LayoffSuggestion;
  exerciseName: string;
  /** Apply the lighter easing-in load to the working sets. */
  onApply: (weight: number) => void;
  /** Keep the full load (or dismiss via backdrop/Escape). */
  onDismiss: () => void;
}

export const WelcomeBackSuggestion: React.FC<WelcomeBackSuggestionProps> = ({
  suggestion,
  exerciseName,
  onApply,
  onDismiss,
}) => {
  // Mirror the sheet's open state so the exit animation can play; the parent also
  // unmounts us once answered (per-exercise flag), so this is mostly for the
  // backdrop/Escape path.
  const [open, setOpen] = useState(true);

  // Backdrop / Escape / "Keep full load" all resolve to a dismissal.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) onDismiss();
  };

  const handleApply = () => {
    onApply(suggestion.suggestedWeight);
    // Close directly (not through onOpenChange) so we don't also fire onDismiss.
    setOpen(false);
  };

  // The full (pre-cut) load reconstructed from the suggestion — the component is
  // intentionally fed only the suggestion, so we invert the reduction to show the
  // lifter what they're easing down FROM. round5 keeps it on the plate grid.
  const fullLoad = round5(suggestion.suggestedWeight / (1 - suggestion.reductionPct / 100));

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent>
        {/* Header */}
        <p className="font-marker text-caption uppercase tracking-wide text-ink-subtle">
          {exerciseName}
        </p>
        <div className="mb-2 mt-0.5 flex items-center gap-2">
          <Sparkles className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          <SheetTitle className="text-title font-marker">
            <span className="marker-underline">Welcome back</span>
          </SheetTitle>
        </div>

        <SheetDescription className="text-body-sm text-ink-muted">
          {suggestion.message}
        </SheetDescription>

        {/* Full load vs. the optional lighter load + the REAL reduction */}
        <div className="mt-4 rounded-md bg-surface-subtle p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-marker text-body-sm text-ink-subtle">Full load</span>
                <span className="font-num font-tabular font-semibold text-ink">{fullLoad} lb</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-accent" aria-hidden="true" />
                <span className="font-marker text-body-sm text-ink-subtle">Ease in</span>
                <span className="font-num font-tabular font-semibold text-accent">
                  {suggestion.suggestedWeight} lb
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-display font-bold text-accent font-num font-tabular">
                −{suggestion.reductionPct}%
              </div>
              <div className="text-caption text-ink-subtle font-marker">lighter</div>
            </div>
          </div>
        </div>

        {/* Actions — opt-in: nothing changes unless the lifter taps "Use …". */}
        <div className="mt-4 flex gap-2">
          <Button variant="primary" onClick={handleApply} className="flex-1">
            Use {suggestion.suggestedWeight} lb
          </Button>
          <Button variant="secondary" onClick={() => handleOpenChange(false)} className="flex-1">
            Keep full load
          </Button>
        </div>

        <p className="mt-3 text-center text-caption text-ink-subtle">
          Optional — you can always adjust the weight on your first set
        </p>
      </SheetContent>
    </Sheet>
  );
};

export default WelcomeBackSuggestion;
