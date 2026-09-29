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
