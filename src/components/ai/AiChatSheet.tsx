// AiChatSheet: the Ask AI chat surface (a bottom sheet), mounted app-wide by
// AskAiHost (components/ai/AskAiHost.tsx), which owns the Worker wiring.
//
// Behavior:
//   - The user types; each assistant turn renders as text plus structured
//     tool-call blocks.
//   - Confirm-tier tool calls render as [Apply]/[Reject] cards (ApplyRejectCard);
//     auto-tier calls (logSet, adjustSet) are applied by the host and show here
//     as small applied/discarded notices (the host shows the Undo toast).
//   - VISUALIZATION blocks render READ-ONLY (no Apply/Reject).
//   - One photo can ride with the next message (camera button, shown only when
//     AI is available): shrunk on the device by `prepareImage` before sending.
//   - Apply may be async (a save): the card stays locked while it runs and
//     only reads Applied once it succeeds.
//   - When no client is available it shows a graceful state and still offers
//     the on-device WorkoutParser (freeform text -> sets) via onFallbackParse.
//
// Isolation / security:
//   - This component NEVER imports @anthropic-ai/sdk and NEVER sees the API key.
//     The key lives in the Worker only; all model access goes through the
//     injected `client`. Models and prompt caching live in the Worker.
//   - The client is injected so this file compiles and tests without any
//     network/SDK dependency.
import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ArrowUp, Camera, Check, CircleSlash, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardBody } from '@/components/ui/card';
import {
  ApplyRejectCard,
  type ApplyRejectDecision,
} from '@/components/ai/ApplyRejectCard';
import type {
  AiAssistantTurn,
  AiImage,
  AiNotice,
  AiToolProposal,
  AiVisualization,
} from '@/ai/types';
import { compressImage, ImageTooLargeError } from '@/ai/image';
import { WorkoutParser } from '@/parser/workoutParser';
import type { ParsedWorkout } from '@/parser/types';
import { cn } from '@/lib/utils';
import { Markdown } from '@/ai/markdown';

// ---------------------------------------------------------------------------
// AI client boundary (the Worker transport contract).
// ---------------------------------------------------------------------------

export type { AiAssistantTurn, AiNotice, AiVisualization };

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
  /** A photo the user attached to this turn. */
  image?: AiImage;
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
   * `client.applyToolCall` if present. Return a message to refuse (e.g. the
   * change no longer fits the app state): the card stays open and the message
   * shows as the error. May be async (a save); the card stays locked until
   * it settles.
   */
  onApplyProposal?: (
    proposal: AiToolProposal,
  ) => string | void | Promise<string | void>;
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
  /** Shrinks a picked photo for the Worker. Defaults to `compressImage`. */
  prepareImage?: (file: File) => Promise<AiImage>;
  className?: string;
}

let _idSeq = 0;
function nextId(prefix: string): string {
  _idSeq += 1;
  return `${prefix}-${_idSeq}`;
}

const FALLBACK_HINT = "AI isn't available right now.";
/** Sent as the text of a turn that is only a photo. */
const PHOTO_ONLY_TEXT = 'What is this machine? Add it to my exercises.';

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
  prepareImage = compressImage,
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
  // Proposals whose Apply is still running (locks their card).
  const [applying, setApplying] = React.useState<Record<string, boolean>>({});
  // The photo waiting to go with the next message, and whether one is being read.
  const [attached, setAttached] = React.useState<AiImage | null>(null);
  const [readingPhoto, setReadingPhoto] = React.useState(false);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  const parserRef = React.useRef<WorkoutParser | null>(null);
  if (parserRef.current === null) {
    parserRef.current = new WorkoutParser();
  }

  const handleApply = React.useCallback(
    async (proposal: AiToolProposal) => {
      setApplying((a) => ({ ...a, [proposal.id]: true }));
      let problem: string | void;
      try {
        problem = await onApplyProposal?.(proposal);
      } catch {
        problem = "Couldn't apply — try again.";
      } finally {
        setApplying((a) => ({ ...a, [proposal.id]: false }));
      }
      if (typeof problem === 'string') {
        setError(problem);
        return;
      }
      setError(null);
      setDecisions((d) => ({ ...d, [proposal.id]: 'applied' }));
      void client?.applyToolCall?.(proposal);
    },
    [client, onApplyProposal],
  );

  const handlePhoto = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Clear so picking the same photo again still fires a change.
      e.target.value = '';
      if (!file) return;
      setReadingPhoto(true);
      setError(null);
      try {
        setAttached(await prepareImage(file));
      } catch (err) {
        setAttached(null);
        setError(
          err instanceof ImageTooLargeError
            ? 'That photo is too large — try another.'
            : "Couldn't read that photo — try another.",
        );
      } finally {
        setReadingPhoto(false);
      }
    },
    [prepareImage],
  );

  const handleReject = React.useCallback(
    (proposal: AiToolProposal) => {
      setDecisions((d) => ({ ...d, [proposal.id]: 'rejected' }));
      onRejectProposal?.(proposal);
    },
    [onRejectProposal],
  );

  const sendToBackend = React.useCallback(
    async (text: string, image?: AiImage) => {
      if (!client) return;
      const userMsg: AiChatMessage = {
        id: nextId('user'),
        role: 'user',
        text,
        ...(image ? { image } : {}),
      };
      const history = [...messages, userMsg];
      setMessages(history);
      setDraft('');
      setAttached(null);
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
      if (pending || readingPhoto) return;
      if (isAvailable && client) {
        if (!text && !attached) return;
        void sendToBackend(text || PHOTO_ONLY_TEXT, attached ?? undefined);
      } else if (text) {
        runFallbackParse(text);
      }
    },
    [draft, pending, readingPhoto, isAvailable, client, attached, sendToBackend, runFallbackParse],
  );

  const canAttach = isAvailable && client != null;
  const canSubmit =
    !pending &&
    !readingPhoto &&
    (draft.trim().length > 0 || (canAttach && attached != null));

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
              {msg.image ? (
                <img
                  src={`data:${msg.image.mediaType};base64,${msg.image.data}`}
                  alt="Your photo"
                  className="ml-auto block max-h-48 w-auto max-w-[70%] rounded-2xl rounded-br-md object-cover"
                />
              ) : null}

              {msg.text ? (
                <div
                  className={cn(
                    'text-body text-ink',
                    msg.role === 'user'
                      ? 'ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-surface-raised px-4 py-2.5 whitespace-pre-wrap'
                      : 'max-w-[92%]',
                  )}
                >
                  {msg.role === 'user' ? msg.text : <Markdown text={msg.text} />}
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
                  onApply={(p) => void handleApply(p)}
                  onReject={handleReject}
                  disabled={applying[proposal.id] ?? false}
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

        {/* The photo going with the next message. */}
        {canAttach && attached ? (
          <div
            data-testid="ai-photo-preview"
            className="mt-3 flex items-center gap-2"
          >
            <img
              src={`data:${attached.mediaType};base64,${attached.data}`}
              alt="Photo to send"
              className="h-14 w-14 rounded-xl object-cover"
            />
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Remove photo"
              onClick={() => setAttached(null)}
            >
              <X size={16} aria-hidden="true" />
            </IconButton>
          </div>
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
          {canAttach ? (
            <>
              {/* capture="environment" opens the rear camera on phones
                  (including the iOS home-screen app); desktops get a picker. */}
              <input
                ref={photoInputRef}
                data-testid="ai-photo-input"
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => void handlePhoto(e)}
              />
              <IconButton
                type="button"
                variant="secondary"
                aria-label="Add a photo"
                disabled={pending || readingPhoto}
                className="mb-1"
                onClick={() => photoInputRef.current?.click()}
              >
                <Camera size={20} aria-hidden="true" />
              </IconButton>
            </>
          ) : null}
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
