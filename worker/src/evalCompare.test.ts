import { describe, expect, it } from 'vitest';
import { compareLift, compareTools } from './evalCompare';

describe('compareLift', () => {
  it('passes when the listed fields match, ignoring unlisted ones', () => {
    expect(
      compareLift(
        { name: 'front squat', weight: 250, reps: 5 },
        { name: 'Front Squat', weight: 250, reps: 5, sets: 3, unit: 'lb' },
      ),
    ).toEqual([]);
  });

  it('requires numbers to match exactly', () => {
    expect(compareLift({ weight: 250 }, { weight: 250.5 })).toEqual(['weight: want 250, got 250.5']);
    expect(compareLift({ reps: 5 }, { reps: '5' })).toEqual(['reps: want 5, got "5"']);
  });

  it('reports missing fields', () => {
    expect(compareLift({ rir: 0 }, {})).toEqual(['rir: want 0, got missing']);
  });

  it('compares strings case-insensitively', () => {
    expect(compareLift({ level: 'pin 12' }, { level: 'Pin 12' })).toEqual([]);
    expect(compareLift({ level: 'Pin 12' }, { level: 'Pin 13' })).toHaveLength(1);
  });

  it('treats question: true as a non-empty question and false as none', () => {
    expect(compareLift({ question: true }, { question: 'How many reps?' })).toEqual([]);
    expect(compareLift({ question: true }, { question: '  ' })).toHaveLength(1);
    expect(compareLift({ question: true }, {})).toHaveLength(1);
    expect(compareLift({ question: false }, {})).toEqual([]);
    expect(compareLift({ question: false }, { question: 'Sets?' })).toHaveLength(1);
  });
});

describe('compareTools', () => {
  it('passes when every expected tool is called and no forbidden one is', () => {
    expect(
      compareTools(['adjustSet', 'logSet'], { expectTools: ['adjustSet'], forbidTools: ['swapExercise'] }),
    ).toEqual([]);
  });

  it('reports missing and forbidden tools', () => {
    expect(
      compareTools(['swapExercise'], { expectTools: ['adjustSet'], forbidTools: ['swapExercise'] }),
    ).toEqual(['missing adjustSet', 'forbidden swapExercise']);
  });

  it('expectAnyTools passes when at least one listed tool is called', () => {
    const any = { expectAnyTools: ['updateBenchmark', 'swapExercise'] };
    expect(compareTools(['swapExercise'], any)).toEqual([]);
    expect(compareTools(['updateBenchmark', 'swapExercise'], any)).toEqual([]);
    expect(compareTools(['adjustSet'], any)).toEqual(['missing any of updateBenchmark|swapExercise']);
    expect(compareTools([], any)).toHaveLength(1);
  });

  it('ignores an empty expectAnyTools', () => {
    expect(compareTools([], { expectAnyTools: [] })).toEqual([]);
  });

  it('defaults to no expectations', () => {
    expect(compareTools([], {})).toEqual([]);
  });
});
