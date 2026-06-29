import { describe, it, expect } from 'vitest';
import { returnFromLayoffSuggestion } from './layoff';

describe('returnFromLayoffSuggestion', () => {
  it('returns null under 21 days off (strength is well preserved short-term)', () => {
    expect(returnFromLayoffSuggestion({ daysSinceLastWorkout: 20, lastWeight: 100 })).toBeNull();
  });

  it('suggests an optional 10% lighter for a 21–34 day gap', () => {
    const s = returnFromLayoffSuggestion({ daysSinceLastWorkout: 21, lastWeight: 100 });
    expect(s).not.toBeNull();
    expect(s!.reductionPct).toBe(10);
    expect(s!.suggestedWeight).toBe(90);
    expect(s!.optional).toBe(true);
    expect(s!.message).toMatch(/3 weeks/i);
    expect(s!.message).toMatch(/10%/);
  });

  it('still uses 10% at the top of the band (34 days)', () => {
    const s = returnFromLayoffSuggestion({ daysSinceLastWorkout: 34, lastWeight: 100 });
    expect(s!.reductionPct).toBe(10);
  });

  it('suggests an optional 20% lighter at 35+ days', () => {
    const s = returnFromLayoffSuggestion({ daysSinceLastWorkout: 35, lastWeight: 100 });
    expect(s!.reductionPct).toBe(20);
    expect(s!.suggestedWeight).toBe(80);
    expect(s!.message).toMatch(/5 weeks/i);
    expect(s!.message).toMatch(/20%/);
  });

  it('rounds the suggested weight to the nearest 5 lb off the real percentage', () => {
    const s = returnFromLayoffSuggestion({ daysSinceLastWorkout: 21, lastWeight: 95 });
    expect(s!.suggestedWeight).toBe(85); // round5(95 * 0.9) = round5(85.5) = 85
  });

  it('returns null for a non-positive last weight (never a zero/negative suggestion)', () => {
    expect(returnFromLayoffSuggestion({ daysSinceLastWorkout: 100, lastWeight: 0 })).toBeNull();
  });
});
