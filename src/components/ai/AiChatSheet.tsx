// AiChatSheet: a self-contained AI chat surface (design §4 — Phase 4 AI layer).
//
// Behavior (per design §4 / §7 Phase 4):
//   - A bottom-sheet chat surface. The user types; assistant turns stream back
//     as text plus structured "tool-call" blocks.
//   - MUTATION tool-calls render as [Apply]/[Reject] cards (ApplyRejectCard).
//     The AI never mutates state directly — the user confirms each change.
//   - VISUALIZATION tool-calls (charts) render READ-ONLY (no Apply/Reject).
//   - When the AI backend is unavailable (no /ai function deployed, or no
//     ANTHROPIC_API_KEY in Functions config) it shows a graceful state AND
//     still offers the working DETERMINISTIC parse (freeform text -> sets) via
//     the existing client-side WorkoutParser. So the surface is useful even
//     before the backend ships.
//
// Isolation / security:
//   - This component NEVER imports @anthropic-ai/sdk and NEVER sees the API key.
//     The key lives in Functions config only. All Claude access goes through an
//     injected `client` (the /ai transport). Model ids
//     (parse=claude-haiku-4-5-20251001, chat=claude-sonnet-4-6) and prompt
//     caching live server-side in the function, not here.
//   - The client is injected so this file compiles and tests without any
//     network/SDK dependency, and so the page that mounts it owns the wiring.
//
// Not wired into any route yet — exported ready to mount (e.g. a Build-page
// "Ask AI" button). Mounting it touches no shared files.
import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardBody } from '@/components/ui/card';
import {
  ApplyRejectCard,
  type AiToolProposal,
  type ApplyRejectDecision,
} from '@/components/ai/ApplyRejectCard';
import { WorkoutParser } from '@/parser/workoutParser';
import type { ParsedWorkout } from '@/parser/types';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// AI client boundary (the /ai transport contract).
// ---------------------------------------------------------------------------

/** A visualization tool-call — rendered read-only, never Apply/Reject. */
export interface AiVisualization {
  id: string;
  /** Chart kind from the design's chart vocabulary, e.g. 'line' | 'bar'. */
  kind: string;
  /** Title shown above the chart. */
  title: string;
  /** Opaque chart spec/data; rendered by an injected renderer if provided. */
  spec: unknown;
}

/** One assistant turn returned by the /ai function. */
export interface AiAssistantTurn {
  /** Free-text assistant prose (may be empty if it only emitted tool-calls). */
  text: string;
  /** Mutation tool-calls -> ApplyRejectCard. */
  proposals?: AiToolProposal[];
  /** Visualization tool-calls -> read-only render. */
  visualizations?: AiVisualization[];
}

/**
 * The injected transport to the deployed `/ai` Firebase callable. Implemented
 * by the page that mounts this component (it owns the firebase/functions
 * wiring). Kept minimal so the component has no firebase/SDK import.
 */
export interface AiChatClient {
  /** Send the conversation; resolve with the next assistant turn. */
  sendMessage: (input: {
    messages: AiChatMessage[];
  }) => Promise<AiAssistantTurn>;
  /**
   * Confirm a previously-proposed mutation tool-call (user pressed Apply).
   * The page performs the real mutation; this notifies the backend so the
   * tool_result can be fed back into the conversation. Optional.
   */
  applyToolCall?: (proposal: AiToolProposal) => Promise<void> | void;
}

export type AiChatRole = 'user' | 'assistant';

export interface AiChatMessage {
  id: string;
  role: AiChatRole;
  text: string;
  proposals?: AiToolProposal[];
  visualizations?: AiVisualization[];
}

export interface AiChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The /ai transport. When `undefined` (or `available` is false), the surface
   * renders the graceful unavailable state + deterministic parse fallback.
   */
  client?: AiChatClient;
  /**
   * Explicit availability override. Defaults to `client != null`. Pass `false`
   * to force the graceful/fallback state even if a client object is present
   * (e.g. a feature flag, or the function probe failed).
   */
  available?: boolean;
  /**
   * Called when the user confirms a mutation proposal (Apply). The mounting
   * page performs the real app-state mutation here. Also forwarded to
   * `client.applyToolCall` if present.
   */
  onApplyProposal?: (proposal: AiToolProposal) => void;
  /** Called when the user rejects a mutation proposal. */
  onRejectProposal?: (proposal: AiToolProposal) => void;
  /**
   * Called when the deterministic fallback parses freeform text into sets.
   * This is the working path when the AI backend is absent.
   */
  onFallbackParse?: (workout: ParsedWorkout, rawText: string) => void;
  /** Optional renderer for visualization tool-calls (charts). */
  renderVisualization?: (viz: AiVisualization) => React.ReactNode;
  className?: string;
}

let _idSeq = 0;
function nextId(prefix: string): string {
  _idSeq += 1;
  return `${prefix}-${_idSeq}`;
}

const FALLBACK_HINT =
  'AI assistant needs the /ai function deployed + ANTHROPIC_API_KEY';

export function AiChatSheet({
  open,
  onOpenChange,
  client,
  available,
  onApplyProposal,
  onRejectProposal,
  onFallbackParse,
  renderVisualization,
  className,
}: AiChatSheetProps) {
  const isAvailable = available ?? client != null;

  const [messages, setMessages] = React.useState<AiChatMessage[]>([]);
  const [draft, setDraft] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Tracks Apply/Reject decisions by proposal id so cards lock after a choice.
  const [decisions, setDecisions] = React.useState<
    Record<string, ApplyRejectDecision>
  >({});

  const parserRef = React.useRef<WorkoutParser | null>(null);
  if (parserRef.current === null) {
    parserRef.current = new WorkoutParser();
  }

  const handleApply = React.useCallback(
    (proposal: AiToolProposal) => {
      setDecisions((d) => ({ ...d, [proposal.id]: 'applied' }));
      onApplyProposal?.(proposal);
      void client?.applyToolCall?.(proposal);
    },
    [client, onApplyProposal],
  );

  const handleReject = React.useCallback(
    (proposal: AiToolProposal) => {
      setDecisions((d) => ({ ...d, [proposal.id]: 'rejected' }));
      onRejectProposal?.(proposal);
    },
    [onRejectProposal],
  );

  const sendToBackend = React.useCallback(
    async (text: string) => {
      if (!client) return;
      const userMsg: AiChatMessage = {
        id: nextId('user'),
        role: 'user',
        text,
      };
      const history = [...messages, userMsg];
      setMessages(history);
      setDraft('');
      setPending(true);
      setError(null);
      try {
        const turn = await client.sendMessage({ messages: history });
        setMessages((prev) => [
          ...prev,
          {
            id: nextId('assistant'),
            role: 'assistant',
            text: turn.text,
            proposals: turn.proposals,
            visualizations: turn.visualizations,
          },
        ]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'The AI request failed.',
        );
      } finally {
        setPending(false);
      }
    },
    [client, messages],
  );

  const runFallbackParse = React.useCallback(
    (text: string) => {
      const result = parserRef.current!.parse(text);
      if (result.success && result.workout) {
        onFallbackParse?.(result.workout, text);
        setError(null);
        setDraft('');
      } else {
        setError(
          result.errors[0]?.message ??
            'Could not parse that into sets. Try e.g. "3x10 Bench Press @135".',
        );
      }
    },
    [onFallbackParse],
  );

  const handleSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = draft.trim();
      if (!text || pending) return;
      if (isAvailable && client) {
        void sendToBackend(text);
      } else {
        runFallbackParse(text);
      }
    },
    [draft, pending, isAvailable, client, sendToBackend, runFallbackParse],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn('flex h-[80vh] max-h-[90vh] flex-col', className)}
      >
        <SheetTitle>AI assistant</SheetTitle>
        <SheetDescription>
          {isAvailable
            ? 'Ask about your training, or describe a workout to log.'
            : 'Offline mode — deterministic parse only.'}
        </SheetDescription>

        {/* Message transcript — the scroll region. */}
        <div
          data-testid="ai-chat-transcript"
          className="mt-3 flex-1 space-y-3 overflow-y-auto"
        >
          {!isAvailable ? (
            <Card elevation={1} role="note">
              <CardBody>
                <p className="text-body font-medium text-ink">
                  AI assistant unavailable
                </p>
                <p className="mt-1 text-body-sm text-ink-subtle">
                  {FALLBACK_HINT}.
                </p>
                <p className="mt-2 text-body-sm text-ink-subtle">
                  You can still type a workout in freeform (e.g.{' '}
                  <span className="font-medium text-ink">
                    3x10 Bench Press @135
                  </span>
                  ) and it will be parsed into sets below.
                </p>
              </CardBody>
            </Card>
          ) : null}

          {messages.map((msg) => (
            <div key={msg.id} data-role={msg.role} className="space-y-2">
              {msg.text ? (
                <div
                  className={cn(
                    'max-w-[85%] rounded-lg px-3 py-2 text-body',
                    msg.role === 'user'
                      ? 'ml-auto bg-accent text-accent-fg'
                      : 'bg-surface-subtle text-ink',
                  )}
                >
                  {msg.text}
                </div>
              ) : null}

              {/* Mutation tool-calls -> Apply/Reject cards. */}
              {msg.proposals?.map((proposal) => (
                <ApplyRejectCard
                  key={proposal.id}
                  proposal={proposal}
                  decision={decisions[proposal.id] ?? null}
                  onApply={handleApply}
                  onReject={handleReject}
                />
              ))}

              {/* Visualization tool-calls -> read-only. */}
              {msg.visualizations?.map((viz) => (
                <Card
                  key={viz.id}
                  elevation={1}
                  data-testid="ai-visualization"
                  data-viz-kind={viz.kind}
                >
                  <CardBody>
                    <p className="mb-2 text-body-sm font-medium text-ink-subtle">
                      {viz.title}
                    </p>
                    {renderVisualization ? (
                      renderVisualization(viz)
                    ) : (
                      <p className="text-body-sm text-ink-subtle">
                        Chart ({viz.kind})
                      </p>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          ))}

          {pending ? (
            <p
              data-testid="ai-pending"
              className="text-body-sm text-ink-subtle"
            >
              Thinking…
            </p>
          ) : null}
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-2 text-body-sm text-danger"
            data-testid="ai-error"
          >
            {error}
          </p>
        ) : null}

        {/* Composer. */}
        <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder={
              isAvailable
                ? 'Ask the AI…'
                : '3x10 Bench Press @135'
            }
            aria-label="Message"
            disabled={pending}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={pending || draft.trim().length === 0}
          >
            {isAvailable ? 'Send' : 'Parse to sets'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
AiChatSheet.displayName = 'AiChatSheet';
