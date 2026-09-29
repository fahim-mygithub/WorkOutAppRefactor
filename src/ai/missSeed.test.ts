import { describe, it, expect } from 'vitest';
import { buildMissSeed } from './missSeed';

describe('buildMissSeed', () => {
  it('describes the last logged set against the target', () => {
    expect(
      buildMissSeed('Bench Press', { reps: 3, weight: 225, unit: 'lbs' }, { reps: 5 }),
    ).toBe('I just did 3 reps at 225 lbs on Bench Press; the target was 5. What should I do for the rest?');
  });

  it('uses the prescribed range floor–ceiling when there is one', () => {
    expect(
      buildMissSeed('Row', { reps: 6, weight: 60 }, { reps: 10, repMin: 8, repMax: 12 }),
    ).toBe('I just did 6 reps at 60 on Row; the target was 8–12. What should I do for the rest?');
  });

  it('leaves the load out for bodyweight sets', () => {
    expect(buildMissSeed('Pull-up', { reps: 4, weight: 0 }, { reps: 8 })).toBe(
      'I just did 4 reps on Pull-up; the target was 8. What should I do for the rest?',
    );
  });

  it('falls back to the last set as the target when nothing is planned', () => {
    expect(buildMissSeed('Dip', { reps: 7 }, undefined)).toBe(
      'I just did 7 reps on Dip; the target was 7. What should I do for the rest?',
    );
  });

  it('asks for an alternative when nothing is logged yet', () => {
    expect(buildMissSeed('Squat', undefined, { reps: 5 })).toBe(
      "I can't do Squat today. What should I do instead?",
    );
  });
});
