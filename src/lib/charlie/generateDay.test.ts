import { describe, it, expect } from 'vitest';
import { generateCharlieDay } from './generateDay';
import {
  PULL_HORIZONTAL_POOL,
  PULL_VERTICAL_POOL,
  type OneRmKey,
} from './definition';

const PUSH_1RM: Partial<Record<OneRmKey, number>> = { 'db-bench': 80, 'bb-bench': 225 };

function mainWeight(day: ReturnType<typeof generateCharlieDay>): number | undefined {
  return day.exercises[0].sets[0].weight;
}

describe('generateCharlieDay — Push', () => {
  it('seeds the 4-cycle main weights from the entered 1RM', () => {
    const weights = [0, 1, 2, 3].map(
      (ci) =>
        mainWeight(
          generateCharlieDay({ programId: 'p', dayType: 'push', cycleIndex: ci, cycleOrdinal: ci, oneRepMax: PUSH_1RM }),
        ),
    );
    // Vol-DB 0.65×80→50 · Str-BB 0.85×225→192.5 · Heavy-DB 0.84×80 micro→67.5 · Vol-BB 0.70×225→157.5
    expect(weights).toEqual([50, 192.5, 67.5, 157.5]);
  });

  it('names contain "Push" (for completed-cell coloring) and the variant label', () => {
    const day = generateCharlieDay({ programId: 'p', dayType: 'push', cycleIndex: 0, cycleOrdinal: 0, oneRepMax: PUSH_1RM });
    expect(day.name).toContain('Push');
    expect(day.name).toContain('Volume Dumbbell');
  });

  it('emits main + 3 paired supersets with correct superset wiring', () => {
    const day = generateCharlieDay({ programId: 'p', dayType: 'push', cycleIndex: 0, cycleOrdinal: 0, oneRepMax: PUSH_1RM });
    expect(day.exercises).toHaveLength(1 + 6); // main + 3×2
    const accessories = day.exercises.slice(1);
    // 3 distinct supersetIds, each pair index 0/1, first member carries the id list
    const pairs = new Map<string, typeof accessories>();
    for (const e of accessories) {
      expect(e.isSuperset).toBe(true);
      expect(e.supersetId).toBeDefined();
      const list = pairs.get(e.supersetId!) ?? [];
      list.push(e);
      pairs.set(e.supersetId!, list);
    }
    expect(pairs.size).toBe(3);
    for (const list of pairs.values()) {
      expect(list).toHaveLength(2);
      expect(list[0].supersetIndex).toBe(0);
      expect(list[1].supersetIndex).toBe(1);
      expect(list[0].supersetExerciseIds).toHaveLength(2);
      expect(list[1].supersetExerciseIds).toBeUndefined();
    }
  });
});

describe('generateCharlieDay — rep ranges (Task 2.1)', () => {
  it('accessory from a 10–15 scheme starts at the floor: carries repMin/repMax, reps === 10 (never the Math.round 13)', () => {
    const day = generateCharlieDay({ programId: 'p', dayType: 'push', cycleIndex: 0, cycleOrdinal: 0, oneRepMax: PUSH_1RM });
    // exercises[1] is ss1-a (overhead press, accScheme 10–15) — a non-alternating accessory.
    const acc = day.exercises[1].sets[0];
    expect(acc.repMin).toBe(10);
    expect(acc.repMax).toBe(15);
    expect(acc.reps).toBe(10);
    expect(acc.reps).not.toBe(13); // the old Math.round((10+15)/2) artifact
  });

  it('compound keeps its fixed targetReps as the default rep, but still carries the display range', () => {
    // Push cycle 0 = Volume Dumbbell: fixed targetReps 12 inside an 8–15 range.
    const day = generateCharlieDay({ programId: 'p', dayType: 'push', cycleIndex: 0, cycleOrdinal: 0, oneRepMax: PUSH_1RM });
    const main = day.exercises[0].sets[0];
    expect(main.reps).toBe(12); // deliberate fixed target, NOT the floor
    expect(main.repMin).toBe(8);
    expect(main.repMax).toBe(15);
  });

  it('heavy↔volume alternating roles use the active range floor, not a rounded midpoint', () => {
    const LEGS: Partial<Record<OneRmKey, number>> = { 'back-squat': 300, 'front-squat': 250, deadlift: 365 };
    // legs ss1-b (upper core) alternates: heavyReps [8,12], volumeReps [15,25].
    const heavy = generateCharlieDay({ programId: 'p', dayType: 'legs', cycleIndex: 0, cycleOrdinal: 1, oneRepMax: LEGS });
    const heavyCore = heavy.exercises[2].sets[0]; // ss1-b
    expect(heavyCore.repMin).toBe(8);
    expect(heavyCore.repMax).toBe(12);
    expect(heavyCore.reps).toBe(8);

    const volume = generateCharlieDay({ programId: 'p', dayType: 'legs', cycleIndex: 0, cycleOrdinal: 0, oneRepMax: LEGS });
    const volCore = volume.exercises[2].sets[0]; // ss1-b
    expect(volCore.repMin).toBe(15);
    expect(volCore.repMax).toBe(25);
    expect(volCore.reps).toBe(15);
  });

  it('time-based sets carry no rep range', () => {
    const LEGS: Partial<Record<OneRmKey, number>> = { 'back-squat': 300, 'front-squat': 250, deadlift: 365 };
    const day = generateCharlieDay({ programId: 'p', dayType: 'legs', cycleIndex: 0, cycleOrdinal: 0, oneRepMax: LEGS });
    const sidePlank = day.exercises.find((e) => e.sets[0].time != null)!;
    expect(sidePlank.sets[0].repMin).toBeUndefined();
    expect(sidePlank.sets[0].repMax).toBeUndefined();
  });
});

describe('generateCharlieDay — Pull', () => {
  const SEAL: Partial<Record<OneRmKey, number>> = { 'seal-row': 230 };

  it('volume pull-up seeds at bodyweight (+0); heavy pull-up at +35', () => {
    const vol = generateCharlieDay({ programId: 'p', dayType: 'pull', cycleIndex: 0, cycleOrdinal: 0, oneRepMax: SEAL });
    expect(mainWeight(vol)).toBe(0);
    expect(vol.exercises[0].notes).toContain('Bodyweight');

    const heavy = generateCharlieDay({ programId: 'p', dayType: 'pull', cycleIndex: 2, cycleOrdinal: 2, oneRepMax: SEAL });
    expect(mainWeight(heavy)).toBe(35);
    expect(heavy.exercises[0].notes).toContain('35 lb');
  });

  it('heavy seal row seeds from %1RM', () => {
    const day = generateCharlieDay({ programId: 'p', dayType: 'pull', cycleIndex: 1, cycleOrdinal: 1, oneRepMax: SEAL });
    expect(mainWeight(day)).toBe(192.5); // 0.84×230 → round 2.5
  });

  it('SS1 is opposite-plane and SS2 is same-plane (Pull-up day → Row then Pulldown)', () => {
    const day = generateCharlieDay({ programId: 'p', dayType: 'pull', cycleIndex: 0, cycleOrdinal: 0, oneRepMax: SEAL });
    const horizontalIds = new Set(PULL_HORIZONTAL_POOL.map((o) => o.exerciseId));
    const verticalIds = new Set(PULL_VERTICAL_POOL.map((o) => o.exerciseId));
    // exercises: [main, ss1-a, ss1-b, ss2-a, ss2-b, ss3-a, ss3-b, finisher]
    const ss1a = day.exercises[1].exercise.id;
    const ss2a = day.exercises[3].exercise.id;
    expect(horizontalIds.has(ss1a)).toBe(true); // opposite of vertical compound = horizontal row
    expect(verticalIds.has(ss2a)).toBe(true); // same plane = vertical pulldown
  });

  it('Seal-Row day flips the planes (Pulldown then Row), and the finisher is not a superset', () => {
    const day = generateCharlieDay({ programId: 'p', dayType: 'pull', cycleIndex: 1, cycleOrdinal: 1, oneRepMax: SEAL });
    const horizontalIds = new Set(PULL_HORIZONTAL_POOL.map((o) => o.exerciseId));
    const verticalIds = new Set(PULL_VERTICAL_POOL.map((o) => o.exerciseId));
    expect(verticalIds.has(day.exercises[1].exercise.id)).toBe(true); // opposite of horizontal = vertical
    expect(horizontalIds.has(day.exercises[3].exercise.id)).toBe(true); // same = horizontal
    const finisher = day.exercises[day.exercises.length - 1];
    expect(finisher.isSuperset).toBeUndefined();
    expect(finisher.supersetId).toBeUndefined();
    expect(day.exercises).toHaveLength(1 + 7); // main + 3 supersets(2 each) + 1 finisher
  });
});

describe('generateCharlieDay — Legs', () => {
  const LEGS: Partial<Record<OneRmKey, number>> = { 'back-squat': 300, 'front-squat': 250, deadlift: 365 };

  it('back-squat heavy seeds at ~0.80×1RM', () => {
    const day = generateCharlieDay({ programId: 'p', dayType: 'legs', cycleIndex: 0, cycleOrdinal: 0, oneRepMax: LEGS });
    expect(mainWeight(day)).toBe(240); // 0.80×300
    expect(day.name).toContain('Legs');
  });

  it('volume sets carry a pause-on-odd-rep cue', () => {
    const day = generateCharlieDay({ programId: 'p', dayType: 'legs', cycleIndex: 1, cycleOrdinal: 1, oneRepMax: LEGS });
    expect(day.exercises[0].notes).toContain('Pause');
  });

  it('stability finisher uses time-based sets', () => {
    const day = generateCharlieDay({ programId: 'p', dayType: 'legs', cycleIndex: 0, cycleOrdinal: 0, oneRepMax: LEGS });
    // last superset block: ss3-a side plank (time-ladder)
    const sidePlank = day.exercises.find((e) => e.sets[0].time != null);
    expect(sidePlank).toBeDefined();
    expect(sidePlank!.sets[0].time).toBe(20);
    expect(day.exercises).toHaveLength(1 + 6); // main + 3 supersets×2
  });
});
