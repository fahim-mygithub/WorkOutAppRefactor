// AiChatSheet: a self-contained AI chat surface (design §4 — Phase 4 AI layer).
//
// Behavior (per design §4 / §7 Phase 4):
//   - A bottom-sheet chat surface. The user types; assistant turns stream back
//     as text plus structured "tool-call" blocks.
//   - MUTATION tool-calls render as [Apply]/[Reject] cards (ApplyRejectCard).
//     The AI never mutates state directly — the user confirms each change.
//   - VISUALIZATION tool-calls (charts) render READ-ONLY (no Apply/Reject).
//   - When the AI backend is unavailable (no Worker URL configured, or no
//     ANTHROPIC_API_KEY secret on the Worker) it shows a graceful state AND
//     still offers the working DETERMINISTIC parse (freeform text -> sets) via
//     the existing client-side WorkoutParser. So the surface is useful even
//     before the backend ships.
//
// Isolation / security:
//   - This component NEVER imports @anthropic-ai/sdk and NEVER sees the API key.
//     The key lives in the Worker only. All Claude access goes through an
//     injected `client` (the Worker transport). Model ids
//     (parse=claude-haiku-4-5-20251001, chat=claude-sonnet-5-5) and prompt
//     caching live server-side in the Worker, not here.
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
import { ArrowUp, Check, CircleSlash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
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
// AI client boundary (the Worker transport contract).
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

/**
 * A short line under the assistant prose saying what happened to a tool call:
 * applied on its own (auto tier) or discarded (failed the engine's checks).
 */
export interface AiNotice {
  id: string;
  text: string;
  tone: 'applied' | 'discarded';
}

/** One assistant turn returned by the AI Worker. */
export interface AiAssistantTurn {
  /** Free-text assistant prose (may be empty if it only emitted tool-calls). */
  text: string;
  /** Mutation tool-calls -> ApplyRejectCard. */
  proposals?: AiToolProposal[];
  /** Visualization tool-calls -> read-only render. */
  visualizations?: AiVisualization[];
  /** Applied / discarded notices -> small lines under the prose. */
  notices?: AiNotice[];
}

/**
 * The injected transport to the AI Worker. Implemented by the page that
 * mounts this component (it owns the `aiClient` wiring). Kept minimal so the
 * component has no firebase/SDK import.
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
  notices?: AiNotice[];
}

export interface AiChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The Worker transport. When `undefined` (or `available` is false), the surface
   * renders the graceful unavailable state + deterministic parse fallback.
   */
  client?: AiChatClient;
  /**
   * Explicit availability override. Defaults to `client != null`. Pass `false`
   * to force the graceful/fallback state even if a client object is present
   * (e.g. a feature flag, or no Worker URL is configured).
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
  /**
   * A first message to send on the user's behalf when the sheet opens with an
   * empty transcript (e.g. "I missed my last rep" from Ask coach). Sent once.
   */
  initialMessage?: string;
  /**
   * Rendered inside the sheet, after the composer (e.g. an Undo toast). The
   * sheet is modal, so anything outside it is inert while it is open.
   */
  overlay?: React.ReactNode;
  className?: string;
}

let _idSeq = 0;
function nextId(prefix: string): string {
  _idSeq += 1;
  return `${prefix}-${_idSeq}`;
}

const FALLBACK_HINT = "AI isn't available right now.";

/**
 * The Worker rejects chat messages with empty content, and an assistant turn
 * can be empty when it only emitted tool calls. Describe what those turns did
 * (proposals, notices, charts) so the model keeps its context and the history
 * keeps its user/assistant alternation.
 */
function describeEmptyTurn(m: AiChatMessage): string {
  const parts: string[] = [];
  if (m.proposals?.length) {
    parts.push(`Proposed: ${m.proposals.map((p) => p.summary).join('; ')}`);
  }
  if (m.notices?.length) {
    parts.push(m.notices.map((n) => n.text).join('; '));
  }
  if (parts.length > 0) return parts.join('; ');
  if (m.visualizations?.length) return '(showed a chart)';
  return '(no reply)';
}

function toBackendHistory(messages: AiChatMessage[]): AiChatMessage[] {
  return messages.map((m) =>
    m.text.trim().length > 0 ? m : { ...m, text: describeEmptyTurn(m) },
  );
}

export function AiChatSheet({
  open,
  onOpenChange,
  client,
  available,
  onApplyProposal,
  onRejectProposal,
  onFallbackParse,
  renderVisualization,
  initialMessage,
  overlay,
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
        const turn = await client.sendMessage({
          messages: toBackendHistory(history),
        });
        setMessages((prev) => [
          ...prev,
          {
            id: nextId('assistant'),
            role: 'assistant',
            text: turn.text,
            proposals: turn.proposals,
            visualizations: turn.visualizations,
            notices: turn.notices,
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

  // Send the seed once per opening. The ref guards StrictMode's double effect;
  // it resets on close so a later opening with a fresh transcript can seed.
  const seedSentRef = React.useRef(false);
  React.useEffect(() => {
    if (!open) {
      seedSentRef.current = false;
      return;
    }
    const seed = initialMessage?.trim();
    if (seedSentRef.current || !seed || !isAvailable || !client) return;
    if (messages.length > 0) return;
    seedSentRef.current = true;
    void sendToBackend(seed);
  }, [open, initialMessage, isAvailable, client, messages.length, sendToBackend]);

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

  const canSubmit = !pending && draft.trim().length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn('mx-auto flex h-[80vh] max-h-[90vh] max-w-lg flex-col', className)}
      >
        <SheetTitle className="text-title">AI assistant</SheetTitle>
        <SheetDescription>
          {isAvailable
            ? 'Ask about your training, or describe a workout to log.'
            : 'Offline. Type a workout and it is parsed into sets.'}
        </SheetDescription>

        {/* Message transcript — the scroll region. */}
        <div
          data-testid="ai-chat-transcript"
          role="log"
          aria-live="polite"
          className="mt-4 flex-1 space-y-4 overflow-y-auto"
        >
          {!isAvailable ? (
            <Card elevation={2} role="note">
              <CardBody className="p-4">
                <p className="text-body font-semibold text-ink">
                  AI assistant unavailable
                </p>
                <p className="mt-1 text-body-sm text-ink-muted">
                  {FALLBACK_HINT}
                </p>
                <p className="mt-2 text-body-sm text-ink-muted">
                  You can still type a workout in freeform (e.g.{' '}
                  <span className="font-num font-tabular text-accent-2">
                    3x10 Bench Press @135
                  </span>
                  ) and it will be parsed into sets below.
                </p>
              </CardBody>
            </Card>
          ) : null}

          {messages.map((msg) => (
            <div key={msg.id} data-role={msg.role} className="space-y-3">
              {msg.text ? (
                <div
                  className={cn(
                    'text-body text-ink',
                    msg.role === 'user'
                      ? 'ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-surface-raised px-4 py-2.5'
                      : 'max-w-[92%] whitespace-pre-wrap',
                  )}
                >
                  {msg.text}
                </div>
              ) : null}

              {/* What happened to auto-applied / discarded tool calls. */}
              {msg.notices?.length ? (
                <ul className="space-y-1">
                  {msg.notices.map((notice) => (
                    <li
                      key={notice.id}
                      data-tone={notice.tone}
                      className={cn(
                        'flex items-start gap-1.5 text-caption',
                        notice.tone === 'applied'
                          ? 'text-accent-2'
                          : 'text-ink-muted',
                      )}
                    >
                      {notice.tone === 'applied' ? (
                        <Check className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <CircleSlash className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span>{notice.text}</span>
                    </li>
                  ))}
                </ul>
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
                  elevation={2}
                  data-testid="ai-visualization"
                  data-viz-kind={viz.kind}
                >
                  <CardBody className="p-4">
                    <p className="mb-2 text-body-sm text-ink-muted">
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
              className="text-body-sm text-ink-muted"
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

        {/* Composer — raised field; the amber control is the one action. */}
        <form
          onSubmit={handleSubmit}
          className={cn(
            'mt-3 flex gap-2',
            isAvailable ? 'items-end' : 'flex-col',
          )}
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder={
              isAvailable
                ? 'Ask about your training'
                : '3x10 Bench Press @135'
            }
            aria-label="Message"
            disabled={pending}
            className="min-h-[3.25rem] flex-1 resize-none"
          />
          {isAvailable ? (
            <IconButton
              type="submit"
              variant="primary"
              aria-label="Send"
              disabled={!canSubmit}
              className="mb-1"
            >
              <ArrowUp size={20} aria-hidden="true" />
            </IconButton>
          ) : (
            <Button type="submit" variant="primary" size="lg" disabled={!canSubmit}>
              Parse to sets
            </Button>
          )}
        </form>
        {overlay}
      </SheetContent>
    </Sheet>
  );
}
AiChatSheet.displayName = 'AiChatSheet';
