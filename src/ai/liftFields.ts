/** The AI's flat load/target fields (see worker/src/tools.ts) as app types. */
import type { TrackedLoad, TrackedTarget, WeightUnit } from '../types/trackedLifts';

export interface FlatLift {
  loadKind: 'weight' | 'bodyweight' | 'level';
  weight?: number;
  unit?: WeightUnit;
  level?: string;
  targetKind: 'reps' | 'repMax' | 'time' | 'none';
  reps?: number;
  repsMax?: number;
  seconds?: number;
  tempo?: string;
}

/** A positive finite number, else undefined (the input is model output). */
const pos = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined;

/** `null` when a field the chosen kind needs is missing or not positive. */
export function fromFlatLift(f: FlatLift): { load: TrackedLoad; target: TrackedTarget } | null {
  const unit: WeightUnit = f.unit === 'kg' ? 'kg' : 'lb';
  const weight = pos(f.weight);

  let load: TrackedLoad;
  if (f.loadKind === 'weight') {
    if (weight === undefined) return null;
    load = { kind: 'weight', value: weight, unit };
  } else if (f.loadKind === 'bodyweight') {
    load = weight !== undefined ? { kind: 'bodyweight', plus: { value: weight, unit } } : { kind: 'bodyweight' };
  } else if (f.loadKind === 'level') {
    const label = typeof f.level === 'string' ? f.level.trim() : '';
    if (!label) return null;
    load = { kind: 'level', label };
  } else {
    return null;
  }

  const reps = pos(f.reps);
  let target: TrackedTarget;
  if (f.targetKind === 'reps') {
    if (reps === undefined) return null;
    const max = pos(f.repsMax);
    target = max !== undefined && max > reps ? { kind: 'reps', min: reps, max } : { kind: 'reps', min: reps };
  } else if (f.targetKind === 'repMax') {
    if (reps === undefined) return null;
    target = { kind: 'repMax', reps };
  } else if (f.targetKind === 'time') {
    const seconds = pos(f.seconds);
    if (seconds === undefined) return null;
    const tempo = typeof f.tempo === 'string' ? f.tempo.trim() : '';
    target = tempo ? { kind: 'time', seconds, tempo } : { kind: 'time', seconds };
  } else if (f.targetKind === 'none') {
    target = { kind: 'none' };
  } else {
    return null;
  }
  return { load, target };
}
