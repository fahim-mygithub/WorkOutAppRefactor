import { describe, it, expect } from 'vitest';
import { CHAT_SYSTEM_PROMPT, READ_MACHINE_SYSTEM_PROMPT } from './prompts';

describe('CHAT_SYSTEM_PROMPT', () => {
  it('pairs an ongoing swap of a tracked lift with a benchmark update', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain(
      "When you propose swapExercise with scope 'ongoing' for a tracked lift, also propose updateBenchmark with a realistic starting benchmark for the new exercise.",
    );
  });

  it('lets the pain rule override the missed-rep load rules', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain(
      '- Pain that sounds like injury overrides the rules above: stop that exercise, suggest seeing a professional, and give no load advice. You may propose swapExercise to a pain-free alternative without a weight.',
    );
    // The pain rule comes after every load rule it overrides.
    expect(CHAT_SYSTEM_PROMPT.indexOf('Pain that sounds like injury')).toBeGreaterThan(
      CHAT_SYSTEM_PROMPT.indexOf('Cannot do the exercise at all'),
    );
  });

  it('points swapExercise at the per-exercise alternatives in the context', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain(
      "For swapExercise, use a name from that exercise's `alternatives` in the context when one fits.",
    );
  });
});

describe('CHAT_SYSTEM_PROMPT history and past workouts', () => {
  it('tells the model it can read the whole history using read tools', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('list_history');
    expect(CHAT_SYSTEM_PROMPT).toContain('get_history_entry');
    expect(CHAT_SYSTEM_PROMPT).toContain('list_workouts');
    expect(CHAT_SYSTEM_PROMPT).toContain('get_workout');
  });

  it('instructs checking actual history and counts before answering', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain(
      'ALWAYS check history and verify actual counts with tools before answering rather than guessing or assuming.',
    );
  });

  it('explains dictating and editing past workouts with logPastWorkout and editPastWorkout', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('logPastWorkout');
    expect(CHAT_SYSTEM_PROMPT).toContain('editPastWorkout');
    expect(CHAT_SYSTEM_PROMPT).toContain('Ask for missing dates or weights rather than guessing.');
    expect(CHAT_SYSTEM_PROMPT).toContain('Both logPastWorkout and editPastWorkout ask the lifter first.');
  });
});

describe('CHAT_SYSTEM_PROMPT build and plan tools', () => {
  it('names every new tool and says they ask first', () => {
    for (const tool of ['createWorkout', 'updateWorkout', 'planWorkout', 'updateProfile', 'addExercise']) {
      expect(CHAT_SYSTEM_PROMPT).toContain(tool);
    }
    expect(CHAT_SYSTEM_PROMPT).toContain('All of these ask the lifter first.');
  });
  it('keeps updateProfile to display and training fields', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('updateProfile changes only the display name and training preferences');
  });
  it('turns a machine photo into an addExercise proposal', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('photo of a machine');
  });
});

describe('READ_MACHINE_SYSTEM_PROMPT', () => {
  it('answers with submitMachine and never invents a brand-specific name it cannot read', () => {
    expect(READ_MACHINE_SYSTEM_PROMPT).toContain('submitMachine');
    expect(READ_MACHINE_SYSTEM_PROMPT).toContain('setupCues');
    expect(READ_MACHINE_SYSTEM_PROMPT).toContain('defaultSets');
  });
});
