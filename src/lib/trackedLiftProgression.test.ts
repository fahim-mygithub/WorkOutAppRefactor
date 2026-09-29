import { describe, it, expect } from 'vitest';
import {
  benchmarkE1RM,
  buildTrackedWorkout,
  checkpointDue,
  currentEstimate,
  newBest,
  prescribe,
  progressionStatus,
  recordSession,
  roundLoad,
  SESSION_LOG_CAP,
} from '@/lib/trackedLiftProgression';
import type { SessionGoal, TrackedLift, TrackedSetLog } from '@/types/trackedLifts';

const bench: TrackedLift = {
  id: 'bench',
  name: 'Bench Press',
  category: 'Push',
  load: { kind: 'weight', value: 265, unit: 'lb' },
  target: { kind: 'repMax', reps: 1 },
  progression: true,
};
const squat: TrackedLift = {
  id: 'squat',
  name: 'Front Squat',
  category: 'Legs',
  load: { kind: 'weight', value: 250, unit: 'lb' },
  target: { kind: 'reps', min: 3 },
  progression: true,
};
const medBall: TrackedLift = {
  id: 'ball',
  name: 'Chest pass',
  category: 'Push',
  load: { kind: 'level', label: 'Med ball 6 kg' },
  target: { kind: 'reps', min: 10 },
  progression: true,
};
const plank: TrackedLift = {
  id: 'plank',
  name: 'Plank',
  category: 'Core',
  load: { kind: 'bodyweight' },
  target: { kind: 'time', seconds: 40 },
  progression: true,
};
const session = (goal: SessionGoal, sets: TrackedSetLog[]) => ({
  date: '2026-09-26T12:00:00.000Z',
  goal,
  sets,
});

describe('estimate', () => {
  it('reads the benchmark as a 1RM when there is no log', () => {
    expect(benchmarkE1RM(bench)).toBe(265);
    expect(benchmarkE1RM(squat)).toBeCloseTo(275); // Epley 250 x 3
    expect(currentEstimate(bench)).toEqual({ value: 265, fromLog: false });
  });

  it('prefers the median of the last 3 logged sessions', () => {
    const lift = {
      ...bench,
      sessions: [
        session('strength', [{ weight: 225, reps: 3 }]), // 247.5
        session('strength', [{ weight: 230, reps: 3 }]), // 253
        session('volume', [{ weight: 180, reps: 10 }]), // 240
      ],
    };
    expect(currentEstimate(lift)?.value).toBeCloseTo(247.5);
    expect(currentEstimate(lift)?.fromLog).toBe(true);
  });

  it('has no estimate for loads without a formula', () => {
    expect(currentEstimate(medBall)).toBeNull();
    expect(currentEstimate(plank)).toBeNull();
  });

  it('rounds to 5 lb / 2.5 kg', () => {
    expect(roundLoad(226, 'lb')).toBe(225);
    expect(roundLoad(101.4, 'kg')).toBe(102.5);
  });
});

describe('prescribe (weighted)', () => {
  it('strength: 4 x 3 at 85% of the estimate', () => {
    const ex = prescribe(bench, 'strength');
    expect(ex.sets).toEqual(Array(4).fill({ reps: 3, weight: 225, unit: 'lbs' }));
    expect(ex.restTime).toBe(180);
    expect(ex.tracked).toEqual({ liftId: 'bench', goal: 'strength' });
  });

  it('volume: 4 x 8-12 at ~67.5%', () => {
    const ex = prescribe(bench, 'volume');
    expect(ex.sets).toEqual(Array(4).fill({ reps: { min: 8, max: 12 }, weight: 180, unit: 'lbs' }));
  });

  it('checkpoint: warm-up ladder then a single just above the estimate', () => {
    const ex = prescribe(bench, 'checkpoint');
    expect(ex.sets.map((s) => [s.reps, s.weight])).toEqual([
      [5, 130],
      [3, 185],
      [1, 225],
      [1, 250],
      [1, 270],
    ]);
  });
});

describe('checkpoint attempt', () => {
  it('never attempts below the benchmark when logged sets read low', () => {
    const lift = { ...bench, sessions: [session('strength', [{ weight: 225, reps: 3 }])] }; // est 247.5
    const sets = prescribe(lift, 'checkpoint').sets;
    expect(sets.at(-1)?.weight).toBe(270);
    expect(sets[0].weight).toBe(130); // 50% of 270 / 1.02, rounded
  });

  it('follows the log when it is ahead of the benchmark', () => {
    const lift = { ...bench, sessions: [session('strength', [{ weight: 260, reps: 3 }])] }; // est 286
    expect(prescribe(lift, 'checkpoint').sets.at(-1)?.weight).toBe(290);
  });
});

describe('prescribe (exceptions)', () => {
  it('named step keeps the step and changes reps only', () => {
    expect(prescribe(medBall, 'volume')).toMatchObject({
      notes: 'Med ball 6 kg',
      sets: Array(4).fill({ reps: 12 }),
    });
    const strength = prescribe(medBall, 'strength');
    expect(strength.sets).toEqual(Array(5).fill({ reps: 5 }));
    expect(strength.notes).toMatch(/next step up/);
    expect(prescribe(medBall, 'checkpoint').notes).toMatch(/step after Med ball 6 kg for 10 reps/);
  });

  it('bodyweight keeps the added load', () => {
    const pullup: TrackedLift = {
      ...medBall,
      load: { kind: 'bodyweight', plus: { value: 20, unit: 'kg' } },
      target: { kind: 'reps', min: 6 },
    };
    expect(prescribe(pullup, 'strength').sets[0]).toEqual({ reps: 5, weight: 20, unit: 'kg' });
  });

  it('timed holds: more holds for volume, longer holds for strength', () => {
    expect(prescribe(plank, 'volume').sets).toEqual(Array(4).fill({ reps: 1, time: 40 }));
    expect(prescribe(plank, 'strength').sets).toEqual(Array(3).fill({ reps: 1, time: 50 }));
    expect(prescribe(plank, 'checkpoint').sets).toHaveLength(1);
  });
});

describe('buildTrackedWorkout', () => {
  it('prescribes progression lifts and copies accessories verbatim', () => {
    const row: TrackedLift = {
      id: 'row',
      name: 'Seal Row',
      category: 'Pull',
      load: { kind: 'weight', value: 160, unit: 'lb' },
      target: { kind: 'reps', min: 10 },
      sets: 4,
    };
    const { exercises } = buildTrackedWorkout([bench, row], 'strength');
    expect(exercises[0].sets[0].reps).toBe(3);
    expect(exercises[1]).toEqual({
      name: 'Seal Row',
      sets: Array(4).fill({ reps: 10, weight: 160, unit: 'lbs' }),
    });
  });
});

describe('cycle and checkpoints', () => {
  it('is due after 2 volume + 2 strength in any order, and a checkpoint resets it', () => {
    let lift = bench;
    for (const goal of ['strength', 'strength', 'volume'] as const) {
      lift = recordSession(lift, session(goal, [{ weight: 200, reps: 5 }])).lift;
    }
    expect(checkpointDue(lift)).toBe(false);
    lift = recordSession(lift, session('volume', [{ weight: 180, reps: 10 }])).lift;
    expect(checkpointDue(lift)).toBe(true);
    expect(progressionStatus(lift)).toBe('Checkpoint due');
    lift = recordSession(lift, session('checkpoint', [{ weight: 260, reps: 1 }])).lift;
    expect(lift.cycle).toEqual({ volume: 0, strength: 0 });
  });

  it('is never due for accessories', () => {
    expect(checkpointDue({ ...bench, progression: false, cycle: { volume: 5, strength: 5 } })).toBe(false);
  });

  it('caps the session log', () => {
    let lift = bench;
    for (let i = 0; i < SESSION_LOG_CAP + 3; i++) {
      lift = recordSession(lift, session('volume', [{ weight: 180, reps: 10 }])).lift;
    }
    expect(lift.sessions).toHaveLength(SESSION_LOG_CAP);
  });
});

describe('newBest', () => {
  it('a heavier single beats a 1-rep max', () => {
    expect(newBest(bench, [{ weight: 265, reps: 1 }])).toBeNull();
    expect(newBest(bench, [{ weight: 270, reps: 1 }])?.load).toEqual({ kind: 'weight', value: 270, unit: 'lb' });
  });

  it('heavier at >= the benchmark reps, or more reps at the same load', () => {
    expect(newBest(squat, [{ weight: 260, reps: 2 }])).toBeNull();
    expect(newBest(squat, [{ weight: 255, reps: 3 }])).toEqual({
      load: { kind: 'weight', value: 255, unit: 'lb' },
      target: { kind: 'reps', min: 3 },
    });
    expect(newBest(squat, [{ weight: 250, reps: 5 }])?.target).toEqual({ kind: 'reps', min: 5 });
  });

  it('longer holds and more bodyweight reps count; named steps never do', () => {
    expect(newBest(plank, [{ reps: 1, time: 55 }])?.target).toEqual({ kind: 'time', seconds: 55 });
    const dips: TrackedLift = { ...plank, target: { kind: 'reps', min: 12 } };
    expect(newBest(dips, [{ reps: 15 }])?.target).toEqual({ kind: 'reps', min: 15 });
    expect(newBest(medBall, [{ reps: 20 }])).toBeNull();
  });

  it('recordSession reports the best for Update / Keep', () => {
    const { best } = recordSession(
      bench,
      session('checkpoint', [{ weight: 135, reps: 5 }, { weight: 275, reps: 1 }]),
    );
    expect(best).toMatchObject({ liftId: 'bench', load: { value: 275 } });
  });
});

describe('equipment step', () => {
  it('rounds to a custom step', () => {
    expect(roundLoad(183, 'lb', 10)).toBe(180);
    expect(roundLoad(186, 'lb', 10)).toBe(190);
    expect(roundLoad(61.5, 'kg')).toBe(62.5);
  });
  it('prescribes on the lift step', () => {
    const lift: TrackedLift = {
      id: 'lat', name: 'Lat Pulldown', category: 'Pull', progression: true, step: 10,
      load: { kind: 'weight', value: 160, unit: 'lb' }, target: { kind: 'reps', min: 10 },
    };
    for (const goal of ['volume', 'strength', 'checkpoint'] as const) {
      for (const s of prescribe(lift, goal).sets) expect((s.weight ?? 0) % 10).toBe(0);
    }
  });
});

describe('fractional and invalid steps', () => {
  it('returns clean numbers for non-binary steps', () => {
    expect(roundLoad(0.7, 'kg', 0.1)).toBe(0.7);
    expect(roundLoad(1.2, 'kg', 0.2)).toBe(1.2);
  });
  it('ignores a non-finite step', () => {
    expect(roundLoad(226, 'lb', NaN)).toBe(225);
    expect(roundLoad(226, 'lb', Infinity)).toBe(225);
  });
});
