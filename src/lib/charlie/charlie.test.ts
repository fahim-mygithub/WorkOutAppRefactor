import { describe, it, expect } from 'vitest';
import {
  estimateOneRepMax,
  roundToIncrement,
  workingWeightFor1RM,
  percentForReps,
} from '../oneRepMax';
import { slotType, cycleIndexForSlot, cycleOrdinalForSlot } from './rotation';
import { accessoryPickForOrdinal, seededRandom } from './accessories';
import {
  PUSH_CYCLE,
  PULL_CYCLE,
  LEGS_CYCLE,
  CYCLE_LEN,
  variantLabel,
  CHARLIE_TEMPLATES,
  type AccessoryOption,
} from './definition';

describe('oneRepMax', () => {
  it('Epley estimate (225×5 → 262.5)', () => {
    expect(estimateOneRepMax(225, 5)).toBeCloseTo(262.5, 5);
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });

  it('rounds to equipment increments (and micro tier)', () => {
    expect(roundToIncrement(52, 'dumbbell')).toBe(50);
    expect(roundToIncrement(53, 'dumbbell')).toBe(55);
    expect(roundToIncrement(67.2, 'dumbbell', { micro: true })).toBe(67.5);
    expect(roundToIncrement(191.25, 'barbell')).toBe(192.5);
    expect(roundToIncrement(157.5, 'barbell')).toBe(157.5);
  });

  it('percentForReps is monotonically decreasing across the range', () => {
    let prev = Infinity;
    for (let r = 1; r <= 15; r++) {
      const p = percentForReps(r);
      expect(p).toBeLessThanOrEqual(prev);
      prev = p;
    }
    expect(percentForReps(1)).toBe(1);
    expect(percentForReps(15)).toBe(0.65);
  });

  it('Push session-1 working-weight seeds', () => {
    // db-bench 1RM 80, bb-bench 1RM 225
    expect(workingWeightFor1RM(80, 0.65, 'dumbbell')).toBe(50); // vol DB
    expect(workingWeightFor1RM(80, 0.84, 'dumbbell', { micro: true })).toBe(67.5); // heavy DB
    expect(workingWeightFor1RM(225, 0.7, 'barbell')).toBe(157.5); // vol BB
  });
});

describe('rotation (program-position math)', () => {
  it('maps slots to P,P,L day-types', () => {
    expect(slotType(0, 0)).toBe('push');
    expect(slotType(0, 1)).toBe('pull');
    expect(slotType(0, 2)).toBe('legs');
    expect(slotType(0, 3)).toBe('push');
  });

  it('a completed Pull is always followed by Legs (continuity across any boundary)', () => {
    for (let slot = 0; slot < 40; slot++) {
      if (slotType(0, slot) === 'pull') {
        expect(slotType(0, slot + 1)).toBe('legs');
      }
    }
  });

  it('push 4-cycle and legs 6-cycle indices', () => {
    expect(cycleIndexForSlot('push', 0)).toBe(0);
    expect(cycleIndexForSlot('push', 3)).toBe(1);
    expect(cycleIndexForSlot('push', 6)).toBe(2);
    expect(cycleIndexForSlot('push', 9)).toBe(3);
    expect(cycleIndexForSlot('push', 12)).toBe(0); // wraps every 4

    // legs slots are 2,5,8,11,14,17,20 → cycle 0..5,0
    const legsSlots = [2, 5, 8, 11, 14, 17, 20];
    expect(legsSlots.map((s) => cycleIndexForSlot('legs', s))).toEqual([0, 1, 2, 3, 4, 5, 0]);
  });

  it('cycle ordinal = floor(slot/3), independent of rotation offset', () => {
    expect(cycleOrdinalForSlot(0)).toBe(0);
    expect(cycleOrdinalForSlot(3)).toBe(1);
    expect(cycleOrdinalForSlot(11)).toBe(3);
  });
});

describe('accessory selection (seeded, avoid-last)', () => {
  const pool: AccessoryOption[] = [
    { exerciseId: 'a', exerciseName: 'A', equipment: 'cable' },
    { exerciseId: 'b', exerciseName: 'B', equipment: 'cable' },
    { exerciseId: 'c', exerciseName: 'C', equipment: 'cable' },
  ];

  it('is deterministic for the same (program, scope, m)', () => {
    const x = accessoryPickForOrdinal('prog1', 'push|ss1-a', pool, 5);
    const y = accessoryPickForOrdinal('prog1', 'push|ss1-a', pool, 5);
    expect(x.exerciseId).toBe(y.exerciseId);
  });

  it('never repeats the previous occurrence', () => {
    let prev = accessoryPickForOrdinal('prog1', 'push|ss1-a', pool, 0).exerciseId;
    for (let m = 1; m < 8; m++) {
      const cur = accessoryPickForOrdinal('prog1', 'push|ss1-a', pool, m).exerciseId;
      expect(cur).not.toBe(prev);
      prev = cur;
    }
  });

  it('a pool of one is returned unavoidably', () => {
    const single: AccessoryOption[] = [{ exerciseId: 'only', exerciseName: 'Only', equipment: 'bodyweight' }];
    expect(accessoryPickForOrdinal('p', 's', single, 4).exerciseId).toBe('only');
  });

  it('seededRandom is reproducible', () => {
    const r1 = seededRandom('k');
    const r2 = seededRandom('k');
    expect(r1()).toBe(r2());
  });
});

describe('definition', () => {
  it('cycle lengths match the rotation design', () => {
    expect(PUSH_CYCLE.length).toBe(4);
    expect(PULL_CYCLE.length).toBe(4);
    expect(LEGS_CYCLE.length).toBe(6);
    expect(CYCLE_LEN).toEqual({ push: 4, pull: 4, legs: 6 });
  });

  it('variant labels resolve', () => {
    expect(variantLabel('push', 1)).toBe('Strength Barbell');
    expect(variantLabel('legs', 5)).toBe('Deadlift — Volume');
    expect(variantLabel('pull', 0)).toBe('Volume Pull-up');
  });

  it('all three day-types are realized (no stubs)', () => {
    expect(CHARLIE_TEMPLATES.push.isStub).toBe(false);
    expect(CHARLIE_TEMPLATES.pull.isStub).toBe(false);
    expect(CHARLIE_TEMPLATES.legs.isStub).toBe(false);
  });

  it('every accessory pool / plane role is non-empty and id-pinned', () => {
    for (const day of Object.values(CHARLIE_TEMPLATES)) {
      for (const block of day.accessories) {
        for (const role of block.roles) {
          if (role.pool) {
            expect(role.pool.length).toBeGreaterThan(0);
            for (const opt of role.pool) {
              expect(opt.exerciseId).toMatch(/^exercise-\d+$/);
            }
          } else {
            // plane-driven role (Pull SS1/SS2 back-pull)
            expect(role.planeFromCompound).toBeDefined();
          }
        }
      }
    }
  });
});
