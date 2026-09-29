// InSessionSuggestion — the small inline cue that drops in under the SetInput
// after a logged set when the live decision says to reduce (or repeat) the load.
// Pure presentation: the decision is computed upstream (decideInSession) and the
// weight is derived from what was ACTUALLY lifted. Styled to sit quietly in the
// no-scroll player and stay out of the way until acted on.
import React from 'react';
import { MessageCircle, TrendingDown } from 'lucide-react';
import type { InSessionDecision } from '@/types/progression';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface InSessionSuggestionProps {
  decision: InSessionDecision;
  /** Apply the suggested load to the remaining (not-yet-completed) sets. */
  onApply: (weight: number) => void;
  /** Dismiss the cue and keep the planned load. */
  onKeep: () => void;
  /** Hand the miss to the AI coach (only passed when AI is usable). */
  onAskCoach?: () => void;
}

export const InSessionSuggestion: React.FC<InSessionSuggestionProps> = ({
  decision,
  onApply,
  onKeep,
  onAskCoach,
}) => {
  const suggestedWeight = decision.suggestedWeight;
  const canApply = suggestedWeight != null && suggestedWeight > 0;
  // Three actions share one row at phone width, so they go compact.
  const size = onAskCoach ? 'sm' : 'md';
  const pad = onAskCoach ? 'px-3' : undefined;

  // "Log set" stays the player's one amber action, so this cue offers the
  // suggested load as a secondary pill, "Keep" and "Ask coach" as ghost.
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
            size={size}
            onClick={() => onApply(suggestedWeight)}
            className={cn('flex-1', pad)}
          >
            Use <span className="font-num font-tabular">{suggestedWeight}</span> lb
          </Button>
        )}
        <Button
          variant="ghost"
          size={size}
          onClick={onKeep}
          className={cn(canApply || onAskCoach ? 'flex-1' : 'w-full', pad)}
        >
          Keep
        </Button>
        {onAskCoach && (
          <Button variant="ghost" size={size} onClick={onAskCoach} className={cn('shrink-0 gap-1.5', pad)}>
            <MessageCircle size={15} aria-hidden="true" />
            Ask coach
          </Button>
        )}
      </div>
    </div>
  );
};

export default InSessionSuggestion;
