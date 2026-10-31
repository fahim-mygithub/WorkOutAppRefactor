import { describe, it, expect } from 'vitest';
import { attachNotes, capNotes, formatNote, MAX_NOTES } from './chatNotes';

const card = { tool: 'logPastWorkout', summary: 'Log Push day (45 min)' };

describe('formatNote', () => {
  it('states applied with the time', () => {
    const at = new Date(2026, 9, 31, 15, 4);
    const text = formatNote(card, { kind: 'applied', at });
    expect(text).toMatch(/^Log Push day \(45 min\) \(logPastWorkout\): applied at \d{1,2}:04/);
  });

  it('states rejected', () => {
    expect(formatNote(card, { kind: 'rejected' })).toBe(
      'Log Push day (45 min) (logPastWorkout): rejected.',
    );
  });

  it('states undone, with the data removed', () => {
    expect(formatNote(card, { kind: 'undone' })).toBe(
      'Log Push day (45 min) (logPastWorkout): undone, the data was removed.',
    );
  });

  it('states a failed undo with its reason', () => {
    expect(formatNote(card, { kind: 'undo-failed', reason: 'network error' })).toBe(
      'Log Push day (45 min) (logPastWorkout): undo failed: network error.',
    );
  });
});

describe('capNotes', () => {
  it('keeps the newest notes in order', () => {
    const notes = Array.from({ length: MAX_NOTES + 3 }, (_, i) => `n${i}`);
    const capped = capNotes(notes);
    expect(capped).toHaveLength(MAX_NOTES);
    expect(capped[0]).toBe('n3');
    expect(capped[capped.length - 1]).toBe(`n${MAX_NOTES + 2}`);
  });

  it('returns a copy when under the cap', () => {
    const notes = ['a', 'b'];
    const capped = capNotes(notes);
    expect(capped).toEqual(['a', 'b']);
    expect(capped).not.toBe(notes);
  });
});

describe('attachNotes', () => {
  const messages = [
    { role: 'user' as const, text: 'log it' },
    { role: 'assistant' as const, text: 'Proposed' },
    { role: 'user' as const, text: 'what happened?' },
  ];

  it('returns the same messages when there are no notes', () => {
    expect(attachNotes(messages, [])).toBe(messages);
  });

  it('prefixes only the last user turn with the marked note block', () => {
    const out = attachNotes(messages, ['X: applied at 3:04 PM.']);
    expect(out[0].text).toBe('log it');
    expect(out[1].text).toBe('Proposed');
    expect(out[2].text).toContain('[App note, not written by the user:');
    expect(out[2].text).toContain('- X: applied at 3:04 PM.');
    expect(out[2].text.endsWith('what happened?')).toBe(true);
  });

  it('does not mutate the input messages', () => {
    attachNotes(messages, ['X: rejected.']);
    expect(messages[2].text).toBe('what happened?');
  });

  it('sends at most the newest MAX_NOTES notes', () => {
    const notes = Array.from({ length: MAX_NOTES + 2 }, (_, i) => `note-${i}`);
    const text = attachNotes(messages, notes)[2].text;
    expect(text).not.toContain('note-0');
    expect(text).not.toContain('note-1');
    expect(text).toContain(`note-${MAX_NOTES + 1}`);
  });

  it('leaves messages alone when there is no user turn', () => {
    const onlyAssistant = [{ role: 'assistant' as const, text: 'hi' }];
    expect(attachNotes(onlyAssistant, ['x'])).toBe(onlyAssistant);
  });
});
