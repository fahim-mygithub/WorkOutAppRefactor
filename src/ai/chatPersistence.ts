/**
 * Keeps the assistant conversation per signed-in user in localStorage, so it
 * survives a reload. One key per uid; another user (or nobody) never sees it.
 *
 * Stored: the last MAX_CHAT_MESSAGES_KEPT messages without image data, and the
 * card decisions. Not stored: open cards' plans (a restored undecided card
 * reads as expired, see aiSlice `aiChatRestored`). Every read and write is
 * guarded: a corrupt or throwing storage means an empty chat, never a crash.
 */
import type { Store } from '@reduxjs/toolkit';
import {
  aiChatRestored,
  MAX_CHAT_MESSAGES_KEPT,
  type AiChatState,
} from '../store/slices/aiSlice';
import { getSafeLocalStorage, type StorageLike } from '../lib/workoutSession';
import type {
  AiNotice,
  AiProposalDecision,
  AiToolProposal,
  AiTranscriptMessage,
  AiVisualization,
} from './types';

export const CHAT_STORAGE_PREFIX = 'ai.chat.v1:';
const VERSION = 1;

export const chatStorageKey = (uid: string): string => `${CHAT_STORAGE_PREFIX}${uid}`;

export interface StoredChat {
  messages: AiTranscriptMessage[];
  decisions: Record<string, AiProposalDecision>;
}

const DECISIONS: readonly AiProposalDecision[] = ['applied', 'rejected', 'undone', 'expired'];
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

function readProposal(v: unknown): AiToolProposal | null {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.tool) || !isStr(v.summary)) return null;
  return { id: v.id, tool: v.tool, summary: v.summary, ...(isStr(v.detail) ? { detail: v.detail } : {}) };
}

function readNotice(v: unknown): AiNotice | null {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.text)) return null;
  if (v.tone !== 'applied' && v.tone !== 'discarded') return null;
  return { id: v.id, text: v.text, tone: v.tone };
}

function readVisualization(v: unknown): AiVisualization | null {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.kind) || !isStr(v.title)) return null;
  return { id: v.id, kind: v.kind, title: v.title, spec: v.spec ?? null };
}

function list<T>(v: unknown, read: (x: unknown) => T | null): T[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.map(read).filter((x): x is T => x !== null);
  return out.length ? out : undefined;
}

/** One stored message, or null when it is not one. Image data is never kept. */
function readMessage(v: unknown): AiTranscriptMessage | null {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.text)) return null;
  if (v.role !== 'user' && v.role !== 'assistant') return null;
  const proposals = list(v.proposals, readProposal);
  const notices = list(v.notices, readNotice);
  const visualizations = list(v.visualizations, readVisualization);
  return {
    id: v.id,
    role: v.role,
    text: v.text,
    ...(proposals ? { proposals } : {}),
    ...(notices ? { notices } : {}),
    ...(visualizations ? { visualizations } : {}),
  };
}

/** The stored conversation of `uid`; null when there is none or it is unreadable. */
export function loadChat(uid: string, storage: StorageLike | null = getSafeLocalStorage()): StoredChat | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(chatStorageKey(uid));
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (!isObj(data) || data.v !== VERSION || !Array.isArray(data.messages)) return null;
    const messages = data.messages.map(readMessage).filter((m): m is AiTranscriptMessage => m !== null);
    const decisions: Record<string, AiProposalDecision> = {};
    if (isObj(data.decisions)) {
      for (const [id, d] of Object.entries(data.decisions)) {
        if (DECISIONS.includes(d as AiProposalDecision)) decisions[id] = d as AiProposalDecision;
      }
    }
    return { messages: messages.slice(-MAX_CHAT_MESSAGES_KEPT), decisions };
  } catch {
    return null;
  }
}

/** Writes the conversation of `uid` (last messages, no images). Never throws. */
export function saveChat(
  uid: string,
  chat: Pick<AiChatState, 'messages' | 'decisions'>,
  storage: StorageLike | null = getSafeLocalStorage(),
): void {
  if (!storage) return;
  try {
    const key = chatStorageKey(uid);
    const messages = chat.messages.slice(-MAX_CHAT_MESSAGES_KEPT).map((m) => {
      if (!m.image) return m;
      const rest = { ...m };
      delete rest.image;
      return rest;
    });
    if (messages.length === 0) {
      storage.removeItem(key);
      return;
    }
    const ids = new Set(messages.flatMap((m) => (m.proposals ?? []).map((p) => p.id)));
    const decisions = Object.fromEntries(Object.entries(chat.decisions).filter(([id]) => ids.has(id)));
    storage.setItem(key, JSON.stringify({ v: VERSION, messages, decisions }));
  } catch {
    // Full or unavailable storage: the chat just isn't kept across a reload.
  }
}

interface PersistState {
  user: { profile?: { uid?: string } | null };
  ai: { chat: AiChatState };
}

/**
 * Follows the signed-in user: loads their conversation when the uid changes
 * (an empty one when signed out), and saves it whenever it changes. Returns
 * the unsubscribe. Never throws.
 */
export function initChatPersistence(
  store: Pick<Store<PersistState>, 'getState' | 'dispatch' | 'subscribe'>,
  storage: StorageLike | null = getSafeLocalStorage(),
): () => void {
  try {
    let uid: string | null | undefined;
    let saved: AiChatState | undefined;
    const sync = () => {
      const state = store.getState();
      const now = state.user.profile?.uid ?? null;
      if (now !== uid) {
        uid = now;
        const stored = now ? loadChat(now, storage) : null;
        store.dispatch(aiChatRestored({ uid: now, ...(stored ?? {}) }));
        saved = store.getState().ai.chat;
        return;
      }
      const chat = state.ai.chat;
      if (chat === saved) return;
      saved = chat;
      if (uid && chat.uid === uid) saveChat(uid, chat, storage);
    };
    sync();
    return store.subscribe(sync);
  } catch {
    return () => {};
  }
}
