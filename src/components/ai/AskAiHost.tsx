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
// the same Undo toast. The chat context carries the profile, today's date, the
// tab the lifter is on and today's planned workouts; saved workouts are read
// once per opening (again after a change) for the planner.
//
// The conversation and its card decisions live in the store (aiSlice), kept
// per user across reloads (ai/chatPersistence.ts), so closing the sheet or
// navigating loses nothing; "New chat" clears it. App-control tools: openTab
// navigates at once; startWorkout and loadIntoBuild navigate (and close the
// sheet) once applied.
import * as React from 'react';
import { useStore } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import type { UnknownAction } from '@reduxjs/toolkit';
import { AnimatePresence, motion as fmotion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { motion as motionTokens } from '@/lib/motion';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import type { RootState } from '../../store';
import {
  aiDecisionSet,
  aiDisabled,
  aiMessageAdded,
  aiNewChat,
  aiPendingRemoved,
  aiPendingSet,
  askAiClosed,
  askAiOpened,
} from '../../store/slices/aiSlice';
import { selectPlansForToday } from '../../store/slices/plannedWorkoutsSlice';
import { setStoredPlanContext } from '../../lib/workoutSession';
import { AiBackendError, chat, isBackendAvailable, isSignedIn } from '../../ai/aiClient';
import { buildAiContext } from '../../ai/context';
import {
  planToolCall,
  sameEffects,
  sameIntent,
  tabOfPath,
  toAssistantTurn,
  type AfterApply,
  type SavedWorkoutRef,
} from '../../ai/applyTool';
import { applyPlan, type AiEffect } from '../../ai/effects';
import { appServices } from '../../ai/appServices';
import { toDateKey } from '../../lib/dateKey';
import type { AiErrorCode, AiProposalDecision, AiToolCall } from '../../ai/types';
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
  /** Distinct per showing, so a toast queued again after a failed take-back is
   *  not mistaken for the one still animating out (which ignores clicks). */
  key?: string;
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
  for (const a of plan.apply) {
    const payload = (a as any).payload;
    if (!payload) continue;
    switch (a.type) {
      case 'plannedWorkouts/planAdded':
        if (payload.id) keys.push(`plan:${payload.id}`);
        if (payload.dateKey) keys.push(`planDate:${payload.dateKey}`);
        break;
      case 'plannedWorkouts/planRemoved':
        if (typeof payload === 'string') keys.push(`plan:${payload}`);
        break;
      case 'trackedLifts/liftUpdated':
        if (payload.id) keys.push(`lift:${payload.id}`);
        break;
      case 'trackedLifts/liftRemoved':
        if (typeof payload === 'string') keys.push(`lift:${payload}`);
        break;
      case 'trackedLifts/liftAdded':
        if (payload.lift?.id) keys.push(`lift:${payload.lift.id}`);
        if (payload.lift?.name) keys.push(`liftName:${payload.lift.name.toLowerCase()}`);
        break;
      case 'workout/replaceExerciseMovement':
      case 'workout/setsPatched':
      case 'workout/removeOpenSets':
      case 'workout/removeExerciseFromWorkout':
      case 'workout/updateExerciseNotesAndTitle':
      case 'workout/addSet':
        if (payload.exerciseId) keys.push(`activeExercise:${payload.exerciseId}`);
        break;
      case 'workout/addExerciseToWorkout':
        if (payload.exercise?.id) keys.push(`activeExercise:${payload.exercise.id}`);
        break;
      case 'customExercises/customExerciseAdded':
        if (payload.id) keys.push(`customExercise:${payload.id}`);
        if (payload.name) keys.push(`customExercise:${payload.name}`);
        break;
      case 'user/updateProfile':
      case 'user/setPreferences':
        keys.push('profile');
        break;
    }
  }
  return keys;
}

export function AskAiHost() {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Read at plan time (openTab skips the tab the lifter is on).
  const pathnameRef = React.useRef(pathname);
  pathnameRef.current = pathname;
  const { open, seed, disabledReason } = useAppSelector((s) => s.ai);
  const conversation = useAppSelector((s) => s.ai.chat);
  const resting = useAppSelector((s) => s.workout.restTimer.isActive);
  // Built-in + custom exercises: the context offers swap alternatives from it
  // and the planner resolves swaps against it. Read through a ref so the chat
  // client and a late Apply see the latest list.
  const library = useExerciseLibrary();
  const libraryRef = React.useRef(library);
  libraryRef.current = library;

  // The lifter's saved workouts: read on the first turn of an opening (or the
  // first Apply), and again after an Apply or Undo changed them. null = read next time.
  const savedWorkouts = React.useRef<SavedWorkoutRef[] | null>(null);
  const loadSavedWorkouts = React.useCallback(async () => {
    const uid = store.getState().user.profile?.uid;
    if (uid && savedWorkouts.current === null) {
      savedWorkouts.current = await appServices.listSavedWorkouts(uid).catch(() => []);
    }
  }, [store]);
  React.useEffect(() => {
    if (!open) savedWorkouts.current = null;
  }, [open]);
  const [undos, setUndos] = React.useState<QueuedUndo[]>([]);
  const [sessionUndos, setSessionUndos] = React.useState<Map<string, ActiveUndo>>(new Map());
  // Mirror of sessionUndos that handlers can read synchronously, so state
  // updaters stay pure (no setState inside another updater).
  const sessionUndosRef = React.useRef<Map<string, ActiveUndo>>(new Map());
  const requeues = React.useRef(0);
  const setDecision = React.useCallback(
    (id: string, decision: AiProposalDecision) => {
      dispatch(aiDecisionSet({ id, decision }));
    },
    [dispatch],
  );

  function commitSessionUndos(next: Map<string, ActiveUndo>) {
    sessionUndosRef.current = next;
    setSessionUndos(next);
  }

  // A new conversation (New chat, another user): its cards have no Undo here.
  const chatId = conversation.id;
  React.useEffect(() => {
    commitSessionUndos(new Map());
  }, [chatId]);

  // Takes one applied proposal back, from the card's Undo or the toast's Undo
  // (same path, so a failure is reported the same way): the card flips to
  // "undone" at once; if the take-back fails it goes back to "applied", its
  // Undo is restored and the toast is queued again. Rethrows for the caller.
  async function undoActive(proposalId: string, active: ActiveUndo): Promise<void> {
    const without = new Map(sessionUndosRef.current);
    without.delete(proposalId);
    commitSessionUndos(without);
    setUndos((q) => q.filter((u) => u.id !== proposalId));
    setDecision(proposalId, 'undone');
    try {
      await active.undo();
    } catch (err) {
      commitSessionUndos(new Map(sessionUndosRef.current).set(proposalId, active));
      setUndos((q) => [
        ...q,
        { id: proposalId, key: `${proposalId}:retry${++requeues.current}`, message: active.message, undo: toastUndo(proposalId, active) },
      ]);
      setDecision(proposalId, 'applied');
      throw err;
    }
  }

  function toastUndo(proposalId: string, active: ActiveUndo): () => void {
    return () => {
      undoActive(proposalId, active).catch((e) => console.error('AI undo failed', e));
    };
  }

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
      pathname: pathnameRef.current,
      plannedWorkouts: now.plannedWorkouts?.plans ?? [],
      defaultGoal: now.trackedLifts.lastGoal ?? 'volume',
      buildHasDraft: now.ai.buildHasDraft,
    });
  }, [store]);

  const effectDeps = React.useCallback(() => ({
    userId: store.getState().user.profile?.uid ?? null,
    dispatch,
    getState: store.getState,
    services: appServices,
  }), [store, dispatch]);

  /** Navigation and session bookkeeping of an applied start / Build load. */
  const runAfterApply = React.useCallback((after: AfterApply | undefined) => {
    if (!after) return;
    if (after.planContext) setStoredPlanContext(after.planContext);
    const uid = store.getState().user.profile?.uid;
    if (after.markPerformed && uid) {
      Promise.resolve(appServices.markWorkoutPerformed?.(uid, after.markPerformed)).catch(() => undefined);
    }
    if (after.closeChat) dispatch(askAiClosed());
    if (after.navigate) {
      pathnameRef.current = after.navigate;
      navigate(after.navigate);
    }
  }, [store, dispatch, navigate]);

  const client = React.useMemo<AiChatClient>(() => ({
    async sendMessage({ messages }) {
      await loadSavedWorkouts();
      const s = store.getState();
      const activeWorkout = s.workout.activeWorkout;
      const todayKey = toDateKey(new Date());
      const here = pathnameRef.current;
      const context = buildAiContext({
        screen: activeWorkout ? 'workout' : here.startsWith('/build') ? 'build' : 'other',
        units: s.user.preferences.weightUnit,
        activeWorkout,
        trackedLifts: s.trackedLifts.lifts,
        focusExerciseId: s.ai.focusExerciseId,
        library: libraryRef.current,
        profile: s.user.profile
          ? { displayName: s.user.profile.displayName, preferences: s.user.preferences }
          : undefined,
        today: todayKey,
        tab: tabOfPath(here),
        todayPlans: selectPlansForToday(s, todayKey),
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
          if (plan.undo.length > 0) {
            setUndos((q) => [...q, { id: plan.id, message: plan.summary, undo: () => plan.undo.forEach((a) => dispatch(a)) }]);
          }
          if (plan.navigate) {
            pathnameRef.current = plan.navigate;
            navigate(plan.navigate);
          }
        } else if (plan.kind === 'confirm') {
          dispatch(aiPendingSet({ id: plan.id, pending: { call, apply: plan.apply, effects: plan.effects } }));
        }
        return { call, plan };
      });
      return toAssistantTurn(res.reply, planned);
    },
  }), [store, dispatch, planNow, loadSavedWorkouts, navigate]);

  const current = undos[0];
  const toast = (
    <AnimatePresence mode="wait">
      {current ? (
        <UndoToast
          key={current.key ?? current.id}
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
        open={open}
        onOpenChange={(next) => {
          if (!next) dispatch(askAiClosed());
        }}
        client={client}
        initialMessage={seed}
        messages={conversation.messages}
        chatKey={conversation.id}
        onMessageAdded={(message, chatId) => dispatch(aiMessageAdded({ chatId, message }))}
        onNewChat={() => dispatch(aiNewChat())}
        onApplyProposal={async (proposal) => {
          const pending = store.getState().ai.pending[proposal.id];
          if (!pending) {
            setDecision(proposal.id, 'expired');
            return "Couldn't apply: this suggestion has expired.";
          }
          await loadSavedWorkouts();
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
          dispatch(aiPendingRemoved(proposal.id));
          let undo: (() => Promise<void>) | undefined;
          try {
            undo = await applyPlan(plan, effectDeps());
          } catch (err) {
            dispatch(aiPendingSet({ id: proposal.id, pending }));
            const signIn = err instanceof Error && err.message === 'Sign in to save.';
            return signIn ? 'Sign in to save.' : "Couldn't save — try again.";
          }
          const savedChanged = touchesSavedWorkouts(plan.effects);
          if (savedChanged) savedWorkouts.current = null;
          const recordKeys = getPlanRecordKeys(plan);
          const inverses = (undo as any)?.inverses as AiEffect[] | undefined;
          if (inverses) {
            for (const inv of inverses) {
              if (inv.type === 'undoLogPastWorkout' && inv.workoutId) {
                recordKeys.push(`pastWorkout:${inv.workoutId}`);
              }
              if (inv.type === 'deleteSavedWorkout' && inv.id) {
                recordKeys.push(`savedWorkout:${inv.id}`);
              }
              if (inv.type === 'removeCustomExercise' && inv.id) {
                recordKeys.push(`customExercise:${inv.id}`);
              }
            }
          }
          setDecision(proposal.id, 'applied');
          runAfterApply(plan.afterApply);
          if (undo) {
            const takeBack = undo;
            const activeUndoFn = async () => {
              await takeBack();
              if (savedChanged) savedWorkouts.current = null;
            };
            const entry: ActiveUndo = {
              proposalId: proposal.id,
              recordKeys,
              undo: activeUndoFn,
              message: plan.summary,
            };
            const next = new Map(sessionUndosRef.current);
            const replacedIds = new Set<string>();
            for (const [id, prior] of sessionUndosRef.current) {
              if (prior.recordKeys.some((k) => recordKeys.includes(k))) {
                next.delete(id);
                replacedIds.add(id);
              }
            }
            next.set(proposal.id, entry);
            commitSessionUndos(next);
            setUndos((q) => [
              ...(replacedIds.size > 0 ? q.filter((u) => !replacedIds.has(u.id)) : q),
              { id: proposal.id, message: plan.summary, undo: toastUndo(proposal.id, entry) },
            ]);
          }
        }}
        onUndoProposal={async (proposal) => {
          const active = sessionUndosRef.current.get(proposal.id);
          if (!active) return;
          await undoActive(proposal.id, active);
        }}
        isProposalUndoable={(proposalId) => sessionUndos.has(proposalId)}
        decisions={conversation.decisions}
        onDecisionChange={setDecision}
        onRejectProposal={(proposal) => {
          dispatch(aiPendingRemoved(proposal.id));
          setDecision(proposal.id, 'rejected');
        }}
        overlay={open ? toast : undefined}
      />
      {open ? null : toast}
    </>
  );
}
AskAiHost.displayName = 'AskAiHost';
