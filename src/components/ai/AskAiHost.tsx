// AskAiHost: the floating Ask AI button and the chat sheet behind it.
//
// Each tool call the model returns is planned against the LATEST store state
// (`planToolCall`) and tiered: auto → applied now with an Undo toast; confirm →
// an Apply/Reject card (re-planned against the state at Apply); rejected → a
// "discarded" notice. The button hides when AI can't be used, mid-rest, while
// an Undo toast shows, and on /workout (the player has its own Ask coach
// entries there; the sheet itself still opens on any route).
import * as React from 'react';
import { useStore } from 'react-redux';
import { useLocation } from 'react-router-dom';
import type { UnknownAction } from '@reduxjs/toolkit';
import { AnimatePresence, motion as fmotion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { motion as motionTokens } from '@/lib/motion';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import type { RootState } from '../../store';
import { aiDisabled, askAiClosed, askAiOpened } from '../../store/slices/aiSlice';
import { AiBackendError, chat, isBackendAvailable, isSignedIn } from '../../ai/aiClient';
import { buildAiContext } from '../../ai/context';
import { planToolCall, toAssistantTurn } from '../../ai/applyTool';
import type { AiErrorCode, AiToolCall } from '../../ai/types';
import { useExerciseLibrary } from '../workout/useExerciseLibrary';
import { AiChatSheet, type AiChatClient } from './AiChatSheet';
import { UndoToast } from './UndoToast';

const FRIENDLY: Partial<Record<AiErrorCode, string>> = {
  limit: 'AI limit reached for today.',
  'not-allowed': "AI isn't enabled for this account.",
  'signed-out': 'Sign in to use AI.',
  offline: "You're offline.",
  unconfigured: "AI isn't set up yet.",
};
const GENERIC = 'Something went wrong — try again.';

interface QueuedUndo {
  id: string;
  message: string;
  undo: UnknownAction[];
}

export function AskAiHost() {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const { pathname } = useLocation();
  const { open, seed, disabledReason } = useAppSelector((s) => s.ai);
  const resting = useAppSelector((s) => s.workout.restTimer.isActive);
  // Built-in + custom exercises: the context offers swap alternatives from it
  // and the planner resolves swaps against it. Read through a ref so the chat
  // client and a late Apply see the latest list.
  const library = useExerciseLibrary();
  const libraryRef = React.useRef(library);
  libraryRef.current = library;

  // A fresh sheet (and transcript) per opening, so each seed is sent. Bumped
  // during render (not in an effect) so the old sheet never sees the new seed.
  const [session, setSession] = React.useState({ open, n: 0 });
  if (session.open !== open) setSession({ open, n: open ? session.n + 1 : session.n });

  // Calls awaiting Apply, with the actions their card was planned with. Each
  // is re-planned on Apply against the state at that moment.
  const pendingCalls = React.useRef(new Map<string, { call: AiToolCall; apply: string }>());
  React.useEffect(() => {
    if (!open) pendingCalls.current.clear();
  }, [open]);
  const [undos, setUndos] = React.useState<QueuedUndo[]>([]);

  const planNow = React.useCallback((call: AiToolCall) => {
    const now = store.getState();
    return planToolCall(call, {
      activeWorkout: now.workout.activeWorkout,
      trackedLifts: now.trackedLifts.lifts,
      library: libraryRef.current,
    });
  }, [store]);

  const client = React.useMemo<AiChatClient>(() => ({
    async sendMessage({ messages }) {
      const s = store.getState();
      const activeWorkout = s.workout.activeWorkout;
      const context = buildAiContext({
        screen: activeWorkout ? 'workout' : pathname.startsWith('/build') ? 'build' : 'other',
        units: s.user.preferences.weightUnit,
        activeWorkout,
        trackedLifts: s.trackedLifts.lifts,
        focusExerciseId: s.ai.focusExerciseId,
        library: libraryRef.current,
      });
      let res;
      try {
        res = await chat({ messages: messages.map((m) => ({ role: m.role, content: m.text })), context });
      } catch (err) {
        const code = err instanceof AiBackendError ? err.code : 'failed';
        if (code === 'not-allowed' || code === 'limit' || code === 'unconfigured') dispatch(aiDisabled(code));
        throw new Error(FRIENDLY[code] ?? GENERIC);
      }
      const planned = res.toolCalls.map((call) => {
        // Latest state per call: an earlier auto call in this turn may have applied.
        const plan = planNow(call);
        if (plan.kind === 'auto') {
          plan.apply.forEach((a) => dispatch(a));
          setUndos((q) => [...q, { id: plan.id, message: plan.summary, undo: plan.undo }]);
        } else if (plan.kind === 'confirm') {
          pendingCalls.current.set(plan.id, { call, apply: JSON.stringify(plan.apply) });
        }
        return { call, plan };
      });
      return toAssistantTurn(res.reply, planned);
    },
  }), [store, dispatch, pathname, planNow]);

  const current = undos[0];
  const toast = (
    <AnimatePresence mode="wait">
      {current ? (
        <UndoToast
          key={current.id}
          message={current.message}
          onUndo={() => current.undo.forEach((a) => dispatch(a))}
          onDone={() => setUndos((q) => q.filter((u) => u.id !== current.id))}
        />
      ) : null}
    </AnimatePresence>
  );

  // Off the player (it has its own entry and its rest controls sit here), and
  // out of the Undo toast's way.
  const showButton = !disabledReason && !resting && !current && !pathname.startsWith('/workout')
    && isBackendAvailable() && isSignedIn();

  return (
    <>
      <AnimatePresence>
        {showButton ? (
          <fmotion.div
            key="ask-ai"
            {...motionTokens.preset.scale}
            className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30"
          >
            <IconButton
              aria-label="Ask AI"
              size="lg"
              className="shadow-e3"
              onClick={() => dispatch(askAiOpened())}
            >
              <Sparkles size={22} aria-hidden="true" />
            </IconButton>
          </fmotion.div>
        ) : null}
      </AnimatePresence>
      <AiChatSheet
        key={session.n}
        open={open}
        onOpenChange={(next) => {
          if (!next) dispatch(askAiClosed());
        }}
        client={client}
        initialMessage={seed}
        onApplyProposal={(proposal) => {
          const pending = pendingCalls.current.get(proposal.id);
          if (!pending) return "Couldn't apply: this suggestion has expired.";
          const plan = planNow(pending.call);
          if (plan.kind !== 'confirm') {
            return `Couldn't apply: ${plan.kind === 'rejected' ? plan.reason : 'things changed since.'}`;
          }
          // Still valid but no longer the actions the card was planned with (e.g.
          // a set logged since, or a different unit): don't apply something the
          // user didn't read. Compared by actions, not wording, so a swap
          // renaming the lift doesn't block a benchmark card from the same turn.
          if (JSON.stringify(plan.apply) !== pending.apply) {
            return "Couldn't apply: things changed since this was suggested.";
          }
          plan.apply.forEach((a) => dispatch(a));
          pendingCalls.current.delete(proposal.id);
        }}
        onRejectProposal={(proposal) => pendingCalls.current.delete(proposal.id)}
        overlay={open ? toast : undefined}
      />
      {open ? null : toast}
    </>
  );
}
AskAiHost.displayName = 'AskAiHost';
