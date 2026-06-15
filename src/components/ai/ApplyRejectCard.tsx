// ApplyRejectCard: renders a single AI *mutation* tool-call as a confirmation
// card with [Apply] / [Reject] actions (design §4 — "Apply/Reject confirmation
// UX"). The AI never mutates app state directly; it *proposes* a tool-call and
// the user confirms. Visualization tool-calls are read-only and are NOT routed
// through this card (see AiChatSheet).
//
// This component is purely presentational: it owns no network and no app state.
// It takes a proposal + onApply/onReject callbacks, tracks only its own
// resolved/pending UI state, and renders with Card/Button primitives + tokens +
// motion. Once a decision is made it locks (disables both buttons) so a proposal
// cannot be double-applied.
import * as React from 'react';
import { motion as fmotion } from 'framer-motion';
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion as motionTokens } from '@/lib/motion';
import { cn } from '@/lib/utils';

/** A mutation tool-call the AI wants to perform, pending user confirmation. */
export interface AiToolProposal {
  /** Tool-call id (stable; from the assistant turn). Used as React key. */
  id: string;
  /** Tool name, e.g. 'add_exercise' / 'log_set' / 'create_workout'. */
  tool: string;
  /** Human-readable one-line summary of what will happen if applied. */
  summary: string;
  /** Optional longer detail / rationale shown under the summary. */
  detail?: string;
  /** The raw tool-call input; rendered as a read-only preview when present. */
  input?: unknown;
}

export type ApplyRejectDecision = 'applied' | 'rejected';

export interface ApplyRejectCardProps {
  proposal: AiToolProposal;
  /** Invoked when the user confirms the mutation. */
  onApply: (proposal: AiToolProposal) => void;
  /** Invoked when the user declines the mutation. */
  onReject: (proposal: AiToolProposal) => void;
  /**
   * Controlled decision. When set, the card renders in its resolved state and
   * the buttons are disabled. When omitted, the card tracks its own decision
   * locally (uncontrolled).
   */
  decision?: ApplyRejectDecision | null;
  /** Disables the actions (e.g. while a parent is applying). */
  disabled?: boolean;
  className?: string;
}

function formatInput(input: unknown): string {
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

export const ApplyRejectCard = React.forwardRef<
  HTMLDivElement,
  ApplyRejectCardProps
>(
  (
    { proposal, onApply, onReject, decision, disabled = false, className },
    ref,
  ) => {
    const isControlled = decision !== undefined;
    const [internalDecision, setInternalDecision] =
      React.useState<ApplyRejectDecision | null>(null);
    const resolved = isControlled ? decision : internalDecision;
    const isResolved = resolved != null;

    const handleApply = React.useCallback(() => {
      if (isResolved || disabled) return;
      if (!isControlled) setInternalDecision('applied');
      onApply(proposal);
    }, [isControlled, isResolved, disabled, onApply, proposal]);

    const handleReject = React.useCallback(() => {
      if (isResolved || disabled) return;
      if (!isControlled) setInternalDecision('rejected');
      onReject(proposal);
    }, [isControlled, isResolved, disabled, onReject, proposal]);

    return (
      <fmotion.div
        ref={ref}
        {...motionTokens.preset.scale}
        className={cn('w-full', className)}
        data-testid="apply-reject-card"
        data-tool={proposal.tool}
        data-decision={resolved ?? 'pending'}
      >
        <Card elevation={2} role="group" aria-label={`Proposed change: ${proposal.summary}`}>
          <CardHeader>
            <p className="text-body-sm font-medium uppercase tracking-wide text-ink-subtle">
              {proposal.tool}
            </p>
            <CardTitle className="text-title">{proposal.summary}</CardTitle>
          </CardHeader>
          <CardBody>
            {proposal.detail ? (
              <p className="text-body-sm text-ink-subtle">{proposal.detail}</p>
            ) : null}
            {proposal.input != null ? (
              <pre
                data-testid="apply-reject-input"
                className="mt-2 max-h-48 overflow-auto rounded-md bg-surface-subtle p-3 text-body-sm text-ink"
              >
                {formatInput(proposal.input)}
              </pre>
            ) : null}
          </CardBody>
          <CardFooter>
            {isResolved ? (
              <p
                className={cn(
                  'text-body-sm font-medium',
                  resolved === 'applied' ? 'text-accent' : 'text-ink-subtle',
                )}
                role="status"
              >
                {resolved === 'applied' ? 'Applied' : 'Rejected'}
              </p>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApply}
                  disabled={disabled}
                >
                  Apply
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReject}
                  disabled={disabled}
                >
                  Reject
                </Button>
              </>
            )}
          </CardFooter>
        </Card>
      </fmotion.div>
    );
  },
);
ApplyRejectCard.displayName = 'ApplyRejectCard';
