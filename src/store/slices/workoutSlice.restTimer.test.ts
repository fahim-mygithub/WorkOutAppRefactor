import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import reducer, {
  startRestTimer,
  updateRestTimer,
  pauseRestTimer,
  stopRestTimer,
} from './workoutSlice';
import { remainingSeconds } from '../../lib/restTimer';

// Reducer-level coverage for the timestamp-anchored rest timer. The pure clock
// math lives in src/lib/restTimer.test.ts; here we assert the slice wires that
// math into state correctly (anchor set on start, cleared on pause/stop/elapse).

const FIXED_NOW = 1_700_000_000_000;

describe('workoutSlice rest timer (timestamp anchoring)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseState = () => reducer(undefined, { type: '@@INIT' });

  it('startRestTimer anchors targetEndTime to now + duration and activates', () => {
    const state = reducer(baseState(), startRestTimer({ duration: 90 }));
    expect(state.restTimer.isActive).toBe(true);
    expect(state.restTimer.duration).toBe(90);
    expect(state.restTimer.timeRemaining).toBe(90);
    expect(state.restTimer.targetEndTime).toBe(FIXED_NOW + 90_000);
  });

  it('startRestTimer falls back to the 120s default when no duration given', () => {
    const state = reducer(baseState(), startRestTimer({}));
    expect(state.restTimer.duration).toBe(120);
    expect(state.restTimer.targetEndTime).toBe(FIXED_NOW + 120_000);
  });

  it('remaining derived from the anchor is correct after a simulated background gap', () => {
    const state = reducer(baseState(), startRestTimer({ duration: 90 }));
    // Simulate the tab being backgrounded for 30s; the anchor is unchanged so
    // the derived remaining is the source of truth, not a decremented counter.
    const resumedAt = FIXED_NOW + 30_000;
    expect(remainingSeconds(state.restTimer.targetEndTime!, resumedAt)).toBe(60);
    // And well past the end it floors at 0 (no negative drift).
    expect(remainingSeconds(state.restTimer.targetEndTime!, FIXED_NOW + 600_000)).toBe(0);
  });

  it('updateRestTimer reaching 0 deactivates and clears the anchor', () => {
    const started = reducer(baseState(), startRestTimer({ duration: 90 }));
    const ticked = reducer(started, updateRestTimer(45));
    expect(ticked.restTimer.isActive).toBe(true);
    expect(ticked.restTimer.timeRemaining).toBe(45);
    expect(ticked.restTimer.targetEndTime).toBe(FIXED_NOW + 90_000);

    const elapsed = reducer(ticked, updateRestTimer(0));
    expect(elapsed.restTimer.isActive).toBe(false);
    expect(elapsed.restTimer.timeRemaining).toBe(0);
    expect(elapsed.restTimer.targetEndTime).toBe(null);
  });

  it('updateRestTimer is a no-op when the timer is inactive', () => {
    const idle = baseState();
    const next = reducer(idle, updateRestTimer(42));
    expect(next.restTimer.timeRemaining).toBe(0);
    expect(next.restTimer.targetEndTime).toBe(null);
  });

  it('pauseRestTimer freezes remaining-on-pause and drops the anchor', () => {
    const started = reducer(baseState(), startRestTimer({ duration: 90 }));
    const paused = reducer(started, pauseRestTimer(60));
    expect(paused.restTimer.isActive).toBe(false);
    expect(paused.restTimer.timeRemaining).toBe(60);
    expect(paused.restTimer.targetEndTime).toBe(null);
    // Duration is preserved so the progress bar keeps its scale.
    expect(paused.restTimer.duration).toBe(90);
  });

  it('resuming re-anchors a fresh targetEndTime from the paused remaining', () => {
    const started = reducer(baseState(), startRestTimer({ duration: 90 }));
    const paused = reducer(started, pauseRestTimer(60));
    // Advance the clock to simulate time spent paused.
    vi.setSystemTime(FIXED_NOW + 500_000);
    const resumed = reducer(paused, startRestTimer({ duration: paused.restTimer.timeRemaining }));
    expect(resumed.restTimer.isActive).toBe(true);
    expect(resumed.restTimer.targetEndTime).toBe(FIXED_NOW + 500_000 + 60_000);
  });

  it('stopRestTimer clears everything (skip-rest path)', () => {
    const started = reducer(baseState(), startRestTimer({ duration: 90 }));
    const stopped = reducer(started, stopRestTimer());
    expect(stopped.restTimer.isActive).toBe(false);
    expect(stopped.restTimer.timeRemaining).toBe(0);
    expect(stopped.restTimer.targetEndTime).toBe(null);
  });
});
