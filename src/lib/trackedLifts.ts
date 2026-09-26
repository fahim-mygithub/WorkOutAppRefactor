/**
 * Pure helpers for tracked lifts: display formatting, the starter template,
 * and category grouping. See src/types/trackedLifts.ts for the data model.
 */
import type {
  TrackedLift,
  TrackedLiftsData,
  TrackedLoad,
  TrackedTarget,
} from '../types/trackedLifts';

/** Round away float noise (0.1 + 0.2) without forcing trailing zeros. */
function num(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export function formatLoad(load: TrackedLoad): string {
  switch (load.kind) {
    case 'weight':
      return `${num(load.value)} ${load.unit}`;
    case 'bodyweight':
      return load.plus ? `Bodyweight + ${num(load.plus.value)} ${load.plus.unit}` : 'Bodyweight';
    case 'level':
      return load.label.trim() || '—';
  }
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${num(seconds)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatTarget(target: TrackedTarget): string {
  switch (target.kind) {
    case 'reps': {
      const { min, max } = target;
      if (max !== undefined && max > min) return `${min}–${max} reps`;
      return `${min} ${min === 1 ? 'rep' : 'reps'}`;
    }
    case 'repMax':
      return `${target.reps}-rep max`;
    case 'time': {
      const base = `${formatSeconds(target.seconds)} under tension`;
      const tempo = target.tempo?.trim();
      return tempo ? `${base}, tempo ${tempo}` : base;
    }
    case 'none':
      return '';
  }
}

/** Collision-resistant id without a dependency (crypto where available). */
export function newTrackedLiftId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `lift-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** The starter list shown until the user saves their own. */
export function seedTrackedLifts(): TrackedLiftsData {
  return {
    categories: ['Push', 'Pull', 'Legs'],
    lifts: [
      {
        id: 'seed-bench-press',
        name: 'Bench Press',
        category: 'Push',
        load: { kind: 'weight', value: 265, unit: 'lb' },
        target: { kind: 'repMax', reps: 1 },
      },
      {
        id: 'seed-seal-row',
        name: 'Seal Row',
        category: 'Pull',
        load: { kind: 'weight', value: 160, unit: 'lb' },
        target: { kind: 'none' },
      },
      {
        id: 'seed-front-squat',
        name: 'Front Squat',
        category: 'Legs',
        load: { kind: 'weight', value: 250, unit: 'lb' },
        target: { kind: 'reps', min: 3 },
      },
    ],
  };
}

export interface TrackedLiftGroup {
  category: string;
  lifts: TrackedLift[];
}

/**
 * Group lifts by category in the user's category order. Empty categories are
 * kept (so a new category shows up with its "Add lift" affordance); lifts in a
 * category that isn't listed are appended rather than silently hidden.
 */
export function groupByCategory(data: TrackedLiftsData): TrackedLiftGroup[] {
  const order = [...data.categories];
  for (const lift of data.lifts) {
    if (!order.includes(lift.category)) order.push(lift.category);
  }
  return order.map((category) => ({
    category,
    lifts: data.lifts.filter((l) => l.category === category),
  }));
}
