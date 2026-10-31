// AskAiHost: the floating Ask AI button and the chat sheet behind it.
//
// Each tool call the model returns is planned against the LATEST store state
// (`planToolCall`) and tiered: auto → applied now with an Undo toast; confirm →
// an Apply/Reject card (re-planned against the state at Apply); rejected → a
// "discarded" notice. The button hides when AI can't be used, mid-rest, while
// an Undo toast shows, and on /workout (the player has its own Ask coach
// entries there; the sheet itself still opens on any route).
//
// The build / plan / profile tools save outside the store on Apply
// (`applyPlan`: saved workouts, custom exercises, the profile) and then offer
// the same Undo toast. The chat context carries the saved workouts (read once
// per opening, again after a change), the profile and today's date.
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
import {
  planToolCall,
  sameEffects,
  sameIntent,
  toAssistantTurn,
  type SavedWorkoutRef,
} from '../../ai/applyTool';
import { applyPlan, type AiEffect } from '../../ai/effects';
import { appServices } from '../../ai/appServices';
import { toDateKey } from '../../lib/dateKey';
import type { AiErrorCode, AiToolCall } from '../../ai/types';
import { useExerciseLibrary } from '../workout/useExerciseLibrary';
import { AiChatSheet, type AiChatClient } from './AiChatSheet';
import { UndoToast } from './UndoToast';
import { type ApplyRejectDecision } from './ApplyRejectCard';

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
  undo: () => void;
}

const touchesSavedWorkouts = (effects: readonly AiEffect[] | undefined): boolean =>
  (effects ?? []).some((e) => e.type.endsWith('SavedWorkout'));

interface ActiveUndo {
  proposalId: string;
  recordKeys: string[];
  undo: () => Promise<void>;
  message: string;
}

function getPlanRecordKeys(plan: { effects?: AiEffect[]; apply: UnknownAction[]; summary?: string }): string[] {
  const keys: string[] = [];
  for (const e of plan.effects ?? []) {
    switch (e.type) {
      case 'editPastWorkout':
      case 'undoEditPastWorkout':
        keys.push(`pastWorkout:${e.workoutId}`);
        break;
      case 'updateSavedWorkout':
      case 'deleteSavedWorkout':
        keys.push(`savedWorkout:${e.id}`);
        break;
      case 'removeCustomExercise':
        keys.push(`customExercise:${e.id}`);
        break;
      case 'updateProfile':
        keys.push('profile');
        break;
      case 'logPastWorkout':
        keys.push(`pastWorkout:${e.workout.date}:${e.workout.name}`);
        break;
      case 'createSavedWorkout':
        keys.push(`savedWorkout:${e.workout.name}`);
        break;
      case 'addCustomExercise':
        keys.push(`customExercise:${e.exercise.name}`);
        break;
    }
  }
  if (keys.length === 0) {
    const actionTypes = plan.apply.map((a) => a.type).join(',');
    if (actionTypes) keys.push(`action:${actionTypes}`);
  }
  return keys;
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
  const pendingCalls = React.useRef(
    new Map<string, { call: AiToolCall; apply: UnknownAction[]; effects?: AiEffect[] }>(),
  );
  // The lifter's saved workouts: read on the first turn of an opening, and
  // again after an Apply or Undo changed them. null = read on the next turn.
  const savedWorkouts = React.useRef<SavedWorkoutRef[] | null>(null);
  React.useEffect(() => {
    if (!open) {
      pendingCalls.current.clear();
      savedWorkouts.current = null;
      setSessionUndos(new Map());
      setDecisions({});
    }
  }, [open]);
  const [undos, setUndos] = React.useState<QueuedUndo[]>([]);
  const [sessionUndos, setSessionUndos] = React.useState<Map<string, ActiveUndo>>(new Map());
  const [decisions, setDecisions] = React.useState<Record<string, ApplyRejectDecision>>({});

  const planNow = React.useCallback((call: AiToolCall) => {
    const now = store.getState();
    return planToolCall(call, {
      activeWorkout: now.workout.activeWorkout,
      trackedLifts: now.trackedLifts.lifts,
      library: libraryRef.current,
      units: now.user.preferences.weightUnit,
      todayKey: toDateKey(new Date()),
      savedWorkouts: savedWorkouts.current ?? [],
      displayName: now.user.profile?.displayName,
      preferences: now.user.preferences,
    });
  }, [store]);

  const effectDeps = React.useCallback(() => ({
    userId: store.getState().user.profile?.uid ?? null,
    dispatch,
    getState: store.getState,
    services: appServices,
  }), [store, dispatch]);

  const client = React.useMemo<AiChatClient>(() => ({
    async sendMessage({ messages }) {
      const uid = store.getState().user.profile?.uid;
      if (uid && savedWorkouts.current === null) {
        savedWorkouts.current = await appServices.listSavedWorkouts(uid).catch(() => []);
      }
      const s = store.getState();
      const activeWorkout = s.workout.activeWorkout;
      const context = buildAiContext({
        screen: activeWorkout ? 'workout' : pathname.startsWith('/build') ? 'build' : 'other',
        units: s.user.preferences.weightUnit,
        activeWorkout,
        trackedLifts: s.trackedLifts.lifts,
        focusExerciseId: s.ai.focusExerciseId,
        library: libraryRef.current,
        profile: s.user.profile
          ? { displayName: s.user.profile.displayName, preferences: s.user.preferences }
          : undefined,
        today: toDateKey(new Date()),
      });
      let res;
      try {
        res = await chat({
          messages: messages.map((m) => ({
            role: m.role,
            content: m.text,
            ...(m.image ? { image: m.image } : {}),
          })),
          context,
        });
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
          setUndos((q) => [...q, { id: plan.id, message: plan.summary, undo: () => plan.undo.forEach((a) => dispatch(a)) }]);
        } else if (plan.kind === 'confirm') {
          pendingCalls.current.set(plan.id, { call, apply: plan.apply, effects: plan.effects });
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
          onUndo={current.undo}
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
        onApplyProposal={async (proposal) => {
          const pending = pendingCalls.current.get(proposal.id);
          if (!pending) return "Couldn't apply: this suggestion has expired.";
          const plan = planNow(pending.call);
          if (plan.kind !== 'confirm') {
            return `Couldn't apply: ${plan.kind === 'rejected' ? plan.reason : 'things changed since.'}`;
          }
          // Still valid but no longer what the card was planned to do (e.g. a
          // different unit): don't apply something the user didn't read.
          // Compared by intent, not wording, so a swap renaming the lift doesn't
          // block a benchmark card from the same turn. The re-plan's actions
          // are the ones dispatched: they fit the state right now.
          if (!sameIntent(plan.apply, pending.apply) || !sameEffects(plan.effects, pending.effects)) {
            return "Couldn't apply: things changed since this was suggested.";
          }
          // Taken off the pending list first so a second tap can't apply twice.
          pendingCalls.current.delete(proposal.id);
          let undo: (() => Promise<void>) | undefined;
          try {
            undo = await applyPlan(plan, effectDeps());
          } catch (err) {
            pendingCalls.current.set(proposal.id, pending);
            const signIn = err instanceof Error && err.message === 'Sign in to save.';
            return signIn ? 'Sign in to save.' : "Couldn't save — try again.";
          }
          const savedChanged = touchesSavedWorkouts(plan.effects);
          if (savedChanged) savedWorkouts.current = null;
          const recordKeys = getPlanRecordKeys(plan);
          setDecisions((d) => ({ ...d, [proposal.id]: 'applied' }));
          if (undo) {
            const takeBack = undo;
            const activeUndoFn = async () => {
              await takeBack();
              if (savedChanged) savedWorkouts.current = null;
            };
            setSessionUndos((prev) => {
              const next = new Map(prev);
              for (const [id, entry] of prev) {
                if (entry.recordKeys.some((k) => recordKeys.includes(k))) {
                  next.delete(id);
                }
              }
              next.set(proposal.id, {
                proposalId: proposal.id,
                recordKeys,
                undo: activeUndoFn,
                message: plan.summary,
              });
              return next;
            });

            setUndos((q) => [...q, {
              id: plan.id,
              message: plan.summary,
              undo: () => {
                activeUndoFn()
                  .then(() => {
                    setDecisions((d) => ({ ...d, [proposal.id]: 'undone' }));
                    setSessionUndos((prev) => {
                      const next = new Map(prev);
                      next.delete(proposal.id);
                      return next;
                    });
                  })
                  .catch((e) => console.error('AI undo failed', e));
              },
            }]);
          }
        }}
        onUndoProposal={async (proposal) => {
          const active = sessionUndos.get(proposal.id);
          if (!active) return;
          setSessionUndos((prev) => {
            const next = new Map(prev);
            next.delete(proposal.id);
            return next;
          });
          setUndos((q) => q.filter((u) => u.id !== proposal.id));
          setDecisions((d) => ({ ...d, [proposal.id]: 'undone' }));
          await active.undo();
        }}
        isProposalUndoable={(proposalId) => sessionUndos.has(proposalId)}
        decisions={decisions}
        onDecisionChange={(id, dec) => setDecisions((d) => ({ ...d, [id]: dec }))}
        onRejectProposal={(proposal) => {
          pendingCalls.current.delete(proposal.id);
          setDecisions((d) => ({ ...d, [proposal.id]: 'rejected' }));
        }}
        overlay={open ? toast : undefined}
      />
      {open ? null : toast}
    </>
  );
}
AskAiHost.displayName = 'AskAiHost';
