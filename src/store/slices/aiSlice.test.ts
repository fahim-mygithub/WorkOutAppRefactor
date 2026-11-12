import { describe, it, expect } from 'vitest';
import reducer, { askAiOpened, askAiClosed, aiDisabled } from './aiSlice';

describe('aiSlice', () => {
  it('starts closed (AI hides unless invoked)', () => {
    expect(reducer(undefined, { type: '@@init' })).toMatchObject({ open: false });
  });
  it('opens with a seed and focus, closes clearing them', () => {
    let s = reducer(undefined, askAiOpened({ seed: 'I missed my last rep', focusExerciseId: 'e1' }));
    expect(s).toMatchObject({ open: true, seed: 'I missed my last rep', focusExerciseId: 'e1' });
    s = reducer(s, askAiClosed());
    expect(s).toMatchObject({ open: false, seed: undefined, focusExerciseId: undefined });
  });
  it('opens without a payload', () => {
    const s = reducer(undefined, askAiOpened());
    expect(s).toMatchObject({ open: true, seed: undefined, focusExerciseId: undefined });
  });
  it('remembers why AI is off', () => {
    expect(reducer(undefined, aiDisabled('limit')).disabledReason).toBe('limit');
  });
});

import {
  aiChatRestored,
  aiDecisionSet,
  aiMessageAdded,
  aiNewChat,
  aiPendingSet,
  buildPresetConsumed,
  buildPresetSet,
  buildEditConsumed,
  buildEditRequested,
  screenCleared,
  screenPublished,
  MAX_CHAT_MESSAGES_KEPT,
} from './aiSlice';
import type { AiTranscriptMessage } from '../../ai/types';

const msg = (id: string, extra: Partial<AiTranscriptMessage> = {}): AiTranscriptMessage => ({
  id, role: 'user', text: id, ...extra,
});

describe('aiSlice — the conversation', () => {
  it('appends to the current chat only, and keeps the last messages', () => {
    let s = reducer(undefined, aiChatRestored({ uid: 'u1' }));
    const id = s.chat.id;
    s = reducer(s, aiMessageAdded({ chatId: id, message: msg('m1') }));
    s = reducer(s, aiMessageAdded({ chatId: 'some-old-chat', message: msg('late') }));
    expect(s.chat.messages.map((m) => m.id)).toEqual(['m1']);
    for (let k = 0; k < MAX_CHAT_MESSAGES_KEPT + 5; k++) s = reducer(s, aiMessageAdded({ chatId: id, message: msg(`n${k}`) }));
    expect(s.chat.messages).toHaveLength(MAX_CHAT_MESSAGES_KEPT);
    expect(s.chat.messages.at(-1)!.id).toBe(`n${MAX_CHAT_MESSAGES_KEPT + 4}`);
  });

  it('New chat empties the conversation and its open cards, for the same user', () => {
    let s = reducer(undefined, aiChatRestored({ uid: 'u1' }));
    s = reducer(s, aiMessageAdded({ chatId: s.chat.id, message: msg('a1', { role: 'assistant', proposals: [{ id: 'p1', tool: 'createWorkout', summary: 'Save' }] }) }));
    s = reducer(s, aiDecisionSet({ id: 'p1', decision: 'applied' }));
    s = reducer(s, aiPendingSet({ id: 'p2', pending: { call: { id: 'p2', name: 'openTab', input: {} }, apply: [] } }));
    const before = s.chat.id;
    s = reducer(s, aiNewChat());
    expect(s.chat).toMatchObject({ uid: 'u1', messages: [], decisions: {} });
    expect(s.chat.id).not.toBe(before);
    expect(s.pending).toEqual({});
  });

  it('restores undecided cards as expired and keeps decided ones', () => {
    const s = reducer(undefined, aiChatRestored({
      uid: 'u1',
      messages: [msg('a1', {
        role: 'assistant',
        proposals: [
          { id: 'p1', tool: 'startWorkout', summary: 'Start Push' },
          { id: 'p2', tool: 'createWorkout', summary: 'Save Push' },
        ],
      })],
      decisions: { p2: 'applied' },
    }));
    expect(s.chat.decisions).toEqual({ p1: 'expired', p2: 'applied' });
  });

  it('hands a Build preset over once', () => {
    const preset = { id: 'build-c1', name: 'Push', workout: { name: 'Push', workoutText: '', parsedWorkout: { exercises: [], supersets: [] } } };
    let s = reducer(undefined, buildPresetSet(preset));
    s = reducer(s, buildPresetConsumed('build-other'));
    expect(s.buildPreset).toEqual(preset);
    s = reducer(s, buildPresetConsumed('build-c1'));
    expect(s.buildPreset).toBeUndefined();
  });
});

describe('screen snapshot', () => {
  const build = { tab: 'build' as const, title: 'Build workout', summary: 'Draft "Push"', data: { name: 'Push' } };
  const draft = { name: 'Push', text: '3x8 Squat' };

  it('holds what the screen published, and clears it when that screen goes', () => {
    let s = reducer(undefined, screenPublished({ ...build, draft }));
    expect(s.screen).toEqual(build);
    expect(s.buildDraft).toEqual(draft);
    s = reducer(s, screenCleared('build'));
    expect(s.screen).toBeUndefined();
    expect(s.buildDraft).toBeUndefined();
  });

  it('a screen that unmounts after the next one published does not clear the next one', () => {
    let s = reducer(undefined, screenPublished({ ...build, draft }));
    s = reducer(s, screenPublished({ tab: 'library', title: 'Library', summary: '3 exercises' }));
    s = reducer(s, screenCleared('build'));
    expect(s.screen?.tab).toBe('library');
  });

  it('caps what is published, whatever the publisher sent', () => {
    const s = reducer(undefined, screenPublished({
      tab: 'library', title: 'x'.repeat(300), summary: 'y'.repeat(3_000), data: { names: Array.from({ length: 500 }, (_, k) => `Exercise ${k}`) },
    }));
    expect(JSON.stringify(s.screen).length).toBeLessThanOrEqual(3_000);
    expect(s.screen?.title).toHaveLength(80);
  });

  it('keeps the draft only for Build', () => {
    const s = reducer(undefined, screenPublished({ tab: 'today', title: 'Today', summary: 's', draft }));
    expect(s.buildDraft).toBeUndefined();
  });

  it('ignores a Build edit while Build is not showing, and merges edits until the page consumes them', () => {
    let s = reducer(undefined, buildEditRequested({ id: 'e0', name: 'Nope' }));
    expect(s.buildEdit).toBeUndefined();
    s = reducer(undefined, screenPublished({ ...build, draft }));
    s = reducer(s, buildEditRequested({ id: 'e1', name: 'Pull' }));
    s = reducer(s, buildEditRequested({ id: 'e2', text: '3x8 Row' }));
    expect(s.buildEdit).toEqual({ id: 'e2', name: 'Pull', text: '3x8 Row' });
    expect(s.buildDraft).toEqual({ name: 'Pull', text: '3x8 Row' });
    s = reducer(s, buildEditConsumed('e1'));
    expect(s.buildEdit?.id).toBe('e2');
    s = reducer(s, buildEditConsumed('e2'));
    expect(s.buildEdit).toBeUndefined();
  });

  it('leaving Build drops an edit the page never applied', () => {
    let s = reducer(undefined, screenPublished({ ...build, draft }));
    s = reducer(s, buildEditRequested({ id: 'e1', name: 'Pull' }));
    s = reducer(s, screenCleared('build'));
    expect(s.buildEdit).toBeUndefined();
  });
});

