// worker/src/tools.test.ts
import { describe, it, expect } from 'vitest';
import { buildToolDefs, toolValidators } from './tools';

describe('tool catalog', () => {
  it('exposes exactly the applied tools', () => {
    expect(buildToolDefs().map((t) => t.name).sort()).toEqual(
      ['addTrackedLift', 'adjustSet', 'logSet', 'removeTrackedLift', 'swapExercise', 'updateBenchmark'],
    );
  });
  it('validates adjustSet', () => {
    expect(toolValidators.adjustSet.safeParse({ exerciseId: 'e1', fromSetIndex: 2, weight: 205, reason: 'missed' }).success).toBe(true);
    expect(toolValidators.adjustSet.safeParse({ exerciseId: 'e1', fromSetIndex: -1 }).success).toBe(false);
  });
  it('validates a flat benchmark', () => {
    expect(toolValidators.updateBenchmark.safeParse({
      liftId: 'l1', loadKind: 'weight', weight: 250, unit: 'lb', targetKind: 'reps', reps: 3, reason: 'rep PR',
    }).success).toBe(true);
  });
  it('emits JSON schemas with required fields', () => {
    const logSet = buildToolDefs().find((t) => t.name === 'logSet')!;
    expect(logSet.input_schema.required).toEqual(expect.arrayContaining(['exerciseId', 'reps']));
  });
});
