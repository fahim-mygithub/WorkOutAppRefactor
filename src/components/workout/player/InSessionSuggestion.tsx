// InSessionSuggestion — the small inline cue that drops in under the SetInput
// after a logged set when the live decision says to reduce (or repeat) the load.
// Pure presentation: the decision is computed upstream (decideInSession) and the
// weight is derived from what was ACTUALLY lifted. Styled to sit quietly in the
// no-scroll player and stay out of the way until acted on.
import React from 'react';
import { TrendingDown } from 'lucide-react';
import type { InSessionDecision } from '@/types/progression';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface InSessionSuggestionProps {
  decision: InSessionDecision;
  /** Apply the suggested load to the remaining (not-yet-completed) sets. */
  onApply: (weight: number) => void;
  /** Dismiss the cue and keep the planned load. */
  onKeep: () => void;
}

export const InSessionSuggestion: React.FC<InSessionSuggestionProps> = ({
  decision,
  onApply,
  onKeep,
}) => {
  const suggestedWeight = decision.suggestedWeight;
  const canApply = suggestedWeight != null && suggestedWeight > 0;

  // "Log set" stays the player's one amber action, so this cue offers the
  // suggested load as a secondary pill and "Keep" as ghost.
  return (
    <div role="status" className="rounded-2xl bg-surface-subtle p-3">
      <div className="mb-2 flex items-start gap-2">
        <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-accent-2" aria-hidden="true" />
        <p className="text-body-sm leading-snug text-ink">{decision.message}</p>
      </div>
      <div className="flex gap-2">
        {canApply && (
          <Button
            variant="secondary"
            onClick={() => onApply(suggestedWeight)}
            className="flex-1"
          >
            Use <span className="font-num font-tabular">{suggestedWeight}</span> lb
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={onKeep}
          className={cn(canApply ? 'flex-1' : 'w-full')}
        >
          Keep
        </Button>
      </div>
    </div>
  );
};

export default InSessionSuggestion;
