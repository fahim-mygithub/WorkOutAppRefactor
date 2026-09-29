import { describe, it, expect } from 'vitest';
import { CHAT_SYSTEM_PROMPT } from './prompts';

describe('CHAT_SYSTEM_PROMPT', () => {
  it('pairs an ongoing swap of a tracked lift with a benchmark update', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain(
      "When you propose swapExercise with scope 'ongoing' for a tracked lift, also propose updateBenchmark with a realistic starting benchmark for the new exercise.",
    );
  });
});
