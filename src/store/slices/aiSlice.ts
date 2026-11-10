// Ask AI state. AI hides unless invoked: the sheet starts closed and only
// opens on an explicit user action (never auto-popup).
//
// The conversation lives here (not in the sheet), so it survives closing the
// sheet and navigating; `ai/chatPersistence.ts` keeps it per signed-in user
// across reloads. `chat.id` changes on New chat and on a different user, so a
// reply still in flight for the old conversation is dropped, not appended.
import { createSlice, type PayloadAction, type UnknownAction } from '@reduxjs/toolkit';
import type { AiProposalDecision, AiToolCall, AiTranscriptMessage } from '../../ai/types';
import type { AiEffect } from '../../ai/effects';
import type { SavedWorkoutDraft } from '../../ai/effects';

/** Most transcript messages kept (and persisted). */
export const MAX_CHAT_MESSAGES_KEPT = 60;

/** A confirm card awaiting Apply, with what it was planned to do. Never persisted. */
export interface AiPendingCall {
  call: AiToolCall;
  apply: UnknownAction[];
  effects?: AiEffect[];
}

export interface AiChatState {
  /** Changes on New chat and when the owner changes. */
  id: string;
  /** The signed-in user this conversation belongs to (null: nobody). */
  uid: string | null;
  messages: AiTranscriptMessage[];
  decisions: Record<string, AiProposalDecision>;
}

/** A workout the assistant put on the Build screen, waiting for Build to show it. */
export interface BuildPreset {
  id: string;
  name: string;
  workout: SavedWorkoutDraft;
}

export interface AiState {
  open: boolean;
  /** A first message to send when the sheet opens (e.g. from Ask coach). */
  seed?: string;
  /** The exercise the conversation is about, when opened from the player. */
  focusExerciseId?: string;
  /** Set when the backend said no (not allowed / limit); hides AI entry points. */
  disabledReason?: 'not-allowed' | 'limit' | 'unconfigured';
  chat: AiChatState;
  /** Confirm cards of this chat still applyable in this session, by proposal id. */
  pending: Record<string, AiPendingCall>;
  /** Set by loadIntoBuild on Apply; Build shows it, then clears it. */
  buildPreset?: BuildPreset;
  /** Whether the Build screen has content the lifter has not saved. */
  buildHasDraft: boolean;
}

let chatSeq = 0;
/** A fresh conversation id (prepared in the action creator, so reducers stay pure). */
export const newChatId = (): string => `chat-${Date.now().toString(36)}-${(chatSeq += 1)}`;

const emptyChat = (id: string, uid: string | null): AiChatState => ({ id, uid, messages: [], decisions: {} });

const initialState: AiState = {
  open: false,
  chat: emptyChat('chat-initial', null),
  pending: {},
  buildHasDraft: false,
};

const capMessages = (messages: AiTranscriptMessage[]): AiTranscriptMessage[] =>
  messages.length > MAX_CHAT_MESSAGES_KEPT ? messages.slice(-MAX_CHAT_MESSAGES_KEPT) : messages;

const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    askAiOpened(
      state,
      action: PayloadAction<{ seed?: string; focusExerciseId?: string } | undefined>,
    ) {
      state.open = true;
      state.seed = action.payload?.seed;
      state.focusExerciseId = action.payload?.focusExerciseId;
    },
    askAiClosed(state) {
      state.open = false;
      state.seed = undefined;
      state.focusExerciseId = undefined;
    },
    aiDisabled(state, action: PayloadAction<NonNullable<AiState['disabledReason']>>) {
      state.disabledReason = action.payload;
    },

    /** Appends to the conversation `chatId`; ignored when that is no longer the current one. */
    aiMessageAdded(state, action: PayloadAction<{ chatId: string; message: AiTranscriptMessage }>) {
      if (action.payload.chatId !== state.chat.id) return;
      state.chat.messages = capMessages([...state.chat.messages, action.payload.message]);
    },
    aiDecisionSet(state, action: PayloadAction<{ id: string; decision: AiProposalDecision }>) {
      state.chat.decisions[action.payload.id] = action.payload.decision;
    },
    /** New chat: an empty conversation for the same user; open cards go with the old one. */
    aiNewChat: {
      reducer(state, action: PayloadAction<{ id: string }>) {
        state.chat = emptyChat(action.payload.id, state.chat.uid);
        state.pending = {};
      },
      prepare: () => ({ payload: { id: newChatId() } }),
    },
    /**
     * The conversation of `uid` (from storage, or empty). A card restored
     * undecided reads as expired: it was planned against another session's state.
     */
    aiChatRestored: {
      reducer(
        state,
        action: PayloadAction<{
          id: string;
          uid: string | null;
          messages?: AiTranscriptMessage[];
          decisions?: Record<string, AiProposalDecision>;
        }>,
      ) {
        const { id, uid, messages = [], decisions = {} } = action.payload;
        const next = emptyChat(id, uid);
        next.messages = capMessages(messages);
        next.decisions = { ...decisions };
        for (const m of next.messages) {
          for (const p of m.proposals ?? []) {
            if (!next.decisions[p.id]) next.decisions[p.id] = 'expired';
          }
        }
        state.chat = next;
        state.pending = {};
      },
      prepare: (payload: {
        uid: string | null;
        messages?: AiTranscriptMessage[];
        decisions?: Record<string, AiProposalDecision>;
      }) => ({ payload: { ...payload, id: newChatId() } }),
    },
    aiPendingSet(state, action: PayloadAction<{ id: string; pending: AiPendingCall }>) {
      state.pending[action.payload.id] = action.payload.pending;
    },
    aiPendingRemoved(state, action: PayloadAction<string>) {
      delete state.pending[action.payload];
    },

    buildPresetSet(state, action: PayloadAction<BuildPreset>) {
      state.buildPreset = action.payload;
    },
    buildPresetConsumed(state, action: PayloadAction<string>) {
      if (state.buildPreset?.id === action.payload) state.buildPreset = undefined;
    },
    buildDraftChanged(state, action: PayloadAction<boolean>) {
      state.buildHasDraft = action.payload;
    },
  },
});

export const {
  askAiOpened,
  askAiClosed,
  aiDisabled,
  aiMessageAdded,
  aiDecisionSet,
  aiNewChat,
  aiChatRestored,
  aiPendingSet,
  aiPendingRemoved,
  buildPresetSet,
  buildPresetConsumed,
  buildDraftChanged,
} = aiSlice.actions;
export default aiSlice.reducer;
