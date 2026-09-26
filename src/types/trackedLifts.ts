/**
 * Tracked lifts — a running, user-curated list of the lifts someone wants to
 * keep an eye on (Build page), grouped under user-defined categories.
 *
 * Load and target are discriminated unions on purpose: progress isn't always
 * "more plates". A lift can progress by weight, by added load on bodyweight,
 * by a named step on a non-linear ladder (medicine balls, bands, machine
 * levels), or by time under tension instead of reps.
 */

export type WeightUnit = 'lb' | 'kg';

export type TrackedLoad =
  | { kind: 'weight'; value: number; unit: WeightUnit }
  | { kind: 'bodyweight'; plus?: { value: number; unit: WeightUnit } }
  /** Free-text progression step, e.g. "Med ball 6 kg", "Band: red", "Level 3". */
  | { kind: 'level'; label: string };

export type TrackedTarget =
  /** A rep count (`max` omitted) or a rep range (`min`–`max`). */
  | { kind: 'reps'; min: number; max?: number }
  /** An N-rep max, e.g. reps: 1 → a 1-rep max. */
  | { kind: 'repMax'; reps: number }
  /** Time under tension, optionally with a tempo such as "3-1-3". */
  | { kind: 'time'; seconds: number; tempo?: string }
  | { kind: 'none' };

export interface TrackedLift {
  id: string;
  name: string;
  /** Must match one of `TrackedLiftsData.categories` (unknowns still render). */
  category: string;
  load: TrackedLoad;
  target: TrackedTarget;
}

export interface TrackedLiftsData {
  /** User-defined, ordered category names. */
  categories: string[];
  lifts: TrackedLift[];
}
