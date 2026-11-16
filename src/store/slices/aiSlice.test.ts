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
  planEditConsumed,
  planEditRequested,
  screenCleared,
  screenPublished,
  MAX_CHAT_MESSAGES_KEPT,
} from './aiSlice';
import { toDateKey } from '../../lib/dateKey';
import type { AiTranscriptMessage } from '../../ai/types';
import type { Exercise } from '../../types/exercise';

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

  describe('plan-edit modal snapshot and draft', () => {
    const today = toDateKey(new Date());
    const benchEx = {
      id: 'bench',
      name: 'Bench Press',
      muscleGroup: 'Chest',
      muscleGroups: ['Chest'],
      equipment: 'Barbell',
      videoLinks: [],
      instructions: [],
      difficulty: 'Intermediate' as const,
      force: null,
      grips: null,
      mechanic: null,
      searchKeywords: [],
      createdAt: '',
      updatedAt: '',
    } satisfies Exercise;
    const planItem = {
      key: 'pe-1-0',
      base: {
        id: 'pe-1',
        exercise: benchEx,
        sets: [{ id: 's-1', reps: 8, weight: 185, unit: 'lbs' as const, completed: false }],
        restTime: 120,
      },
      setsCount: '3',
      reps: '8',
      weight: '185',
      unit: 'lbs' as const,
    };
    const planSnap = {
      tab: 'plan-edit' as const,
      title: 'Plan editor',
      summary: `Plan "Push" for ${today}, 1 exercise`,
      data: { planId: 'p1', name: 'Push', date: today, exercises: [{ name: 'Bench Press', sets: 3, reps: 8, weight: 185, unit: 'lbs' }] },
    };
    const planDraft = { planId: 'p1', date: today, name: 'Push', exercises: [planItem] };

    it('holds plan-edit over Today, restores Today on close, and clears standalone to undefined', () => {
      let standalone = reducer(undefined, screenPublished({ ...planSnap, planDraft }));
      expect(standalone.screen).toEqual(planSnap);
      expect(standalone.planDraft).toEqual(planDraft);
      standalone = reducer(standalone, screenCleared('plan-edit'));
      expect(standalone.screen).toBeUndefined();
      expect(standalone.planDraft).toBeUndefined();

      const todaySnap = { tab: 'today' as const, title: 'Today', summary: 'Today: Push' };
      let overToday = reducer(undefined, screenPublished(todaySnap));
      overToday = reducer(overToday, screenPublished({ ...planSnap, planDraft }));
      expect(overToday.screen).toEqual(planSnap);
      // Today re-publishing while the modal is open updates underneath without hiding the modal.
      const updatedToday = { tab: 'today' as const, title: 'Today', summary: 'Today: Heavy Push' };
      overToday = reducer(overToday, screenPublished(updatedToday));
      expect(overToday.screen).toEqual(planSnap);
      overToday = reducer(overToday, screenCleared('plan-edit'));
      expect(overToday.screen).toEqual(updatedToday);
      expect(overToday.planDraft).toBeUndefined();
    });

    it('ignores planEditRequested when closed or for another planId, and merges pending edits', () => {
      let s = reducer(undefined, planEditRequested({ id: 'e0', planId: 'p1', name: 'Nope' }));
      expect(s.planEdit).toBeUndefined();

      s = reducer(undefined, screenPublished({ ...planSnap, planDraft }));
      s = reducer(s, planEditRequested({ id: 'wrong', planId: 'other-plan', name: 'Wrong' }));
      expect(s.planEdit).toBeUndefined();

      const nextExercises = [{ ...planItem, setsCount: '5' }];
      s = reducer(s, planEditRequested({ id: 'e1', planId: 'p1', name: 'Heavy Push' }));
      s = reducer(s, planEditRequested({ id: 'e2', planId: 'p1', exercises: nextExercises }));
      expect(s.planEdit).toEqual({ id: 'e2', planId: 'p1', name: 'Heavy Push', exercises: nextExercises });
      expect(s.planDraft).toEqual({ ...planDraft, name: 'Heavy Push', exercises: nextExercises });

      s = reducer(s, planEditConsumed('e1'));
      expect(s.planEdit?.id).toBe('e2');
      s = reducer(s, planEditConsumed('e2'));
      expect(s.planEdit).toBeUndefined();
    });
  });
});

