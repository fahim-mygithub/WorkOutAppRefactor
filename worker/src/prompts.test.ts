import { describe, it, expect } from 'vitest';
import { CHAT_SYSTEM_PROMPT } from './prompts';

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
