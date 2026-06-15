import { describe, it, expect } from 'vitest';
import {
  computeTargetEndTime,
  remainingSeconds,
  isElapsed,
} from './restTimer';

describe('computeTargetEndTime', () => {
  it('returns now plus the duration expressed in milliseconds', () => {
    expect(computeTargetEndTime(120, 1_000_000)).toBe(1_000_000 + 120_000);
  });

  it('treats a zero duration as ending immediately', () => {
    expect(computeTargetEndTime(0, 5_000)).toBe(5_000);
  });

  it('clamps negative durations to end immediately (never in the past)', () => {
    expect(computeTargetEndTime(-30, 5_000)).toBe(5_000);
  });
});

describe('remainingSeconds', () => {
  it('derives whole seconds remaining from the target end time', () => {
    // 90s out exactly.
    expect(remainingSeconds(1_090_000, 1_000_000)).toBe(90);
  });

  it('rounds a partial second up so the display never shows 0 early', () => {
    // 89.4s out -> still shows 90 (ceil), so the user never sees a premature 0.
    expect(remainingSeconds(1_089_400, 1_000_000)).toBe(90);
  });

  it('returns 0 exactly at the target end time', () => {
    expect(remainingSeconds(1_000_000, 1_000_000)).toBe(0);
  });

  it('never returns a negative value once the end time has passed (backgrounded overshoot)', () => {
    // Tab was backgrounded for 10 minutes past completion.
    expect(remainingSeconds(1_000_000, 1_600_000)).toBe(0);
  });
});

describe('isElapsed', () => {
  it('is false while time remains', () => {
    expect(isElapsed(1_100_000, 1_000_000)).toBe(false);
  });

  it('is true exactly at the target end time', () => {
    expect(isElapsed(1_000_000, 1_000_000)).toBe(true);
  });

  it('is true after the target end time (resume-after-background case)', () => {
    expect(isElapsed(1_000_000, 1_050_000)).toBe(true);
  });
});
