import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import user, { resetUser, setProfile } from '../store/slices/userSlice';
import ai, {
  aiDecisionSet,
  aiMessageAdded,
  aiNewChat,
  askAiClosed,
  askAiOpened,
  MAX_CHAT_MESSAGES_KEPT,
} from '../store/slices/aiSlice';
import type { StorageLike } from '../lib/workoutSession';
import { chatStorageKey, initChatPersistence, loadChat } from './chatPersistence';
import type { AiTranscriptMessage } from './types';

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const profile = (uid: string) => ({ uid, email: `${uid}@x.y`, displayName: uid, createdAt: '', lastActiveAt: '' });

/** A fresh app (as after a reload) on `storage`, signed in as `uid` when given. */
function boot(storage: StorageLike | null, uid?: string) {
  const store = configureStore({ reducer: { user, ai } });
  initChatPersistence(store, storage);
  if (uid) store.dispatch(setProfile(profile(uid)));
  return store;
}

const say = (store: ReturnType<typeof boot>, message: AiTranscriptMessage) =>
  store.dispatch(aiMessageAdded({ chatId: store.getState().ai.chat.id, message }));

const card = { id: 'p1', tool: 'startWorkout', summary: 'Start "Push" (3 exercises)' };

describe('chat persistence', () => {
  it('survives closing the sheet and a reload', () => {
    const storage = memoryStorage();
    const a = boot(storage, 'u1');
    a.dispatch(askAiOpened());
    say(a, { id: 'm1', role: 'user', text: 'load push day' });
    say(a, { id: 'm2', role: 'assistant', text: 'Here it is.', proposals: [card] });
    a.dispatch(askAiClosed());
    expect(a.getState().ai.chat.messages.map((m) => m.text)).toEqual(['load push day', 'Here it is.']);

    const b = boot(storage, 'u1');
    expect(b.getState().ai.chat.messages.map((m) => m.text)).toEqual(['load push day', 'Here it is.']);
    expect(b.getState().ai.chat.messages[1].proposals).toEqual([card]);
  });

  it('restores an undecided card as expired and an applied one as applied', () => {
    const storage = memoryStorage();
    const a = boot(storage, 'u1');
    say(a, {
      id: 'm1', role: 'assistant', text: '',
      proposals: [card, { id: 'p2', tool: 'createWorkout', summary: 'Save "Push"' }],
    });
    a.dispatch(aiDecisionSet({ id: 'p2', decision: 'applied' }));
    const b = boot(storage, 'u1');
    expect(b.getState().ai.chat.decisions).toEqual({ p1: 'expired', p2: 'applied' });
    expect(b.getState().ai.pending).toEqual({});
  });

  it('New chat clears the conversation, also after a reload', () => {
    const storage = memoryStorage();
    const a = boot(storage, 'u1');
    say(a, { id: 'm1', role: 'user', text: 'hello' });
    a.dispatch(aiNewChat());
    expect(a.getState().ai.chat.messages).toEqual([]);
    expect(storage.data.has(chatStorageKey('u1'))).toBe(false);
    expect(boot(storage, 'u1').getState().ai.chat.messages).toEqual([]);
  });

  it('never shows one user the chat of another, or of nobody after sign-out', () => {
    const storage = memoryStorage();
    const a = boot(storage, 'u1');
    say(a, { id: 'm1', role: 'user', text: 'my secret program' });
    a.dispatch(resetUser());
    expect(a.getState().ai.chat).toMatchObject({ uid: null, messages: [] });
    a.dispatch(setProfile(profile('u2')));
    expect(a.getState().ai.chat).toMatchObject({ uid: 'u2', messages: [] });
    say(a, { id: 'm2', role: 'user', text: 'u2 here' });

    expect(boot(storage, 'u2').getState().ai.chat.messages.map((m) => m.text)).toEqual(['u2 here']);
    expect(boot(storage, 'u1').getState().ai.chat.messages.map((m) => m.text)).toEqual(['my secret program']);
    expect(boot(storage).getState().ai.chat.messages).toEqual([]);
  });

  it('starts empty on corrupted storage', () => {
    for (const raw of ['{not json', '"text"', '{"v":1,"messages":"nope"}', '{"v":99,"messages":[]}', 'null']) {
      const storage = memoryStorage();
      storage.setItem(chatStorageKey('u1'), raw);
      expect(boot(storage, 'u1').getState().ai.chat.messages).toEqual([]);
    }
    // Readable file with junk entries: the junk is dropped, the rest kept.
    const storage = memoryStorage();
    storage.setItem(chatStorageKey('u1'), JSON.stringify({
      v: 1,
      messages: [{ id: 'm1', role: 'user', text: 'ok' }, { id: 2, role: 'user' }, { id: 'm3', role: 'system', text: 'x' }],
      decisions: { p1: 'applied', p2: 'exploded' },
    }));
    expect(loadChat('u1', storage)).toEqual({ messages: [{ id: 'm1', role: 'user', text: 'ok' }], decisions: { p1: 'applied' } });
  });

  it('keeps working when storage throws or is missing', () => {
    const throwing: StorageLike = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('full'); },
      removeItem: () => { throw new Error('denied'); },
    };
    const a = boot(throwing, 'u1');
    say(a, { id: 'm1', role: 'user', text: 'still works' });
    expect(a.getState().ai.chat.messages).toHaveLength(1);
    const b = boot(null, 'u1');
    say(b, { id: 'm1', role: 'user', text: 'no storage' });
    expect(b.getState().ai.chat.messages).toHaveLength(1);
  });

  it('drops image data and keeps only the last messages', () => {
    const storage = memoryStorage();
    const a = boot(storage, 'u1');
    say(a, { id: 'photo', role: 'user', text: 'what is this', image: { mediaType: 'image/jpeg', data: 'QUJD'.repeat(1000) } });
    for (let k = 0; k < MAX_CHAT_MESSAGES_KEPT; k++) say(a, { id: `m${k}`, role: 'user', text: `m${k}` });
    const raw = storage.data.get(chatStorageKey('u1'))!;
    expect(raw).not.toContain('QUJD');
    expect(JSON.parse(raw).messages).toHaveLength(MAX_CHAT_MESSAGES_KEPT);

    const b = memoryStorage();
    const c = boot(b, 'u1');
    say(c, { id: 'photo', role: 'user', text: 'what is this', image: { mediaType: 'image/jpeg', data: 'QUJD' } });
    expect(b.data.get(chatStorageKey('u1'))).not.toContain('image');
    expect(boot(b, 'u1').getState().ai.chat.messages).toEqual([{ id: 'photo', role: 'user', text: 'what is this' }]);
  });
});
