import { describe, it, expect } from 'vitest';
import * as progression from './index';

describe('progression barrel', () => {
  it('re-exports every public function from the five core modules', () => {
    expect(typeof progression.effortAdjustedE1RM).toBe('function');
    expect(typeof progression.bestSetE1RM).toBe('function');
    expect(typeof progression.smoothedSessionE1RM).toBe('function');
    expect(typeof progression.nextDoubleProgression).toBe('function');
    expect(typeof progression.inSessionDecision).toBe('function');
    expect(typeof progression.returnFromLayoffSuggestion).toBe('function');
  });
});
