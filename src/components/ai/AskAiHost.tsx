// AskAiHost: the floating Ask AI button and the chat sheet behind it.
//
// Each tool call the model returns is planned against the LATEST store state
// (`planToolCall`) and tiered: auto → applied now with an Undo toast; confirm →
// an Apply/Reject card (re-planned against the state at Apply); rejected → a
// "discarded" notice. The button hides when AI can't be used or mid-rest.
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
import { useExerciseLibrary } from '../workout/ExerciseQuickAdd';
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
  useExerciseLibrary(); // the planner resolves swaps against the library

  // A fresh sheet (and transcript) per opening, so each seed is sent. Bumped
  // during render (not in an effect) so the old sheet never sees the new seed.
  const [session, setSession] = React.useState({ open, n: 0 });
  if (session.open !== open) setSession({ open, n: open ? session.n + 1 : session.n });

  // Calls awaiting Apply, re-planned on Apply against the state at that moment.
  const pendingCalls = React.useRef(new Map<string, AiToolCall>());
  React.useEffect(() => {
    if (!open) pendingCalls.current.clear();
  }, [open]);
  const [undos, setUndos] = React.useState<QueuedUndo[]>([]);

  const planNow = React.useCallback((call: AiToolCall) => {
    const now = store.getState();
    return planToolCall(call, {
      activeWorkout: now.workout.activeWorkout,
      trackedLifts: now.trackedLifts.lifts,
      library: now.exercise.exercises,
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
          pendingCalls.current.set(plan.id, call);
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
          const call = pendingCalls.current.get(proposal.id);
          if (!call) return "Couldn't apply: this suggestion has expired.";
          const plan = planNow(call);
          if (plan.kind !== 'confirm') {
            return `Couldn't apply: ${plan.kind === 'rejected' ? plan.reason : 'things changed since.'}`;
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
