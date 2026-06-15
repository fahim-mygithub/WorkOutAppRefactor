// Muscle-group derivation for the Home calendar redesign (PWA hardening §4
// blocker #3). The calendar's existing data (`WorkoutCalendarDay.workouts`)
// only carries the workout *name* — there is no muscle-group field on the
// session summary. Rather than re-open the deleted in-house icon module or
// touch shared utils, this module maps a session NAME → one of the 7 token
// muscle-group hues and a matching lucide-react glyph, keyed by keyword.
//
// Design constraints honored:
//   - 7 hues exactly, matching the --muscle-* tokens in tokens.css.
//   - lucide-react only (no custom icon module).
//   - Deterministic + stable: same name always resolves to the same group,
//     falling back to a name-hash so unmatched names still spread across hues
//     instead of all collapsing to one.
import type { LucideIcon } from 'lucide-react';
import {
  Dumbbell,
  ArrowDownToLine,
  Footprints,
  Hexagon,
  HeartPulse,
  PersonStanding,
  StretchHorizontal,
} from 'lucide-react';

export type MuscleGroup =
  | 'push'
  | 'pull'
  | 'legs'
  | 'core'
  | 'cardio'
  | 'full-body'
  | 'mobility';

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'push',
  'pull',
  'legs',
  'core',
  'cardio',
  'full-body',
  'mobility',
];

interface MuscleGroupMeta {
  /** Token-driven text color class (resolves through tokens.css). */
  textClass: string;
  /** Token-driven background color class. */
  bgClass: string;
  /** Intensity-bar class (muscle hue at 60% alpha). */
  barClass: string;
  /** lucide-react glyph for the group. */
  icon: LucideIcon;
  /** Human-readable label for legends / aria. */
  label: string;
}

// NOTE: full literal class strings (no interpolation) so Tailwind's JIT keeps
// them — `text-muscle-${group}` would be invisible to the compiler.
export const MUSCLE_GROUP_META: Record<MuscleGroup, MuscleGroupMeta> = {
  push: {
    textClass: 'text-muscle-push',
    bgClass: 'bg-muscle-push',
    barClass: 'bg-muscle-push/60',
    icon: Dumbbell,
    label: 'Push',
  },
  pull: {
    textClass: 'text-muscle-pull',
    bgClass: 'bg-muscle-pull',
    barClass: 'bg-muscle-pull/60',
    icon: ArrowDownToLine,
    label: 'Pull',
  },
  legs: {
    textClass: 'text-muscle-legs',
    bgClass: 'bg-muscle-legs',
    barClass: 'bg-muscle-legs/60',
    icon: Footprints,
    label: 'Legs',
  },
  core: {
    textClass: 'text-muscle-core',
    bgClass: 'bg-muscle-core',
    barClass: 'bg-muscle-core/60',
    icon: Hexagon,
    label: 'Core',
  },
  cardio: {
    textClass: 'text-muscle-cardio',
    bgClass: 'bg-muscle-cardio',
    barClass: 'bg-muscle-cardio/60',
    icon: HeartPulse,
    label: 'Cardio',
  },
  'full-body': {
    textClass: 'text-muscle-full-body',
    bgClass: 'bg-muscle-full-body',
    barClass: 'bg-muscle-full-body/60',
    icon: PersonStanding,
    label: 'Full body',
  },
  mobility: {
    textClass: 'text-muscle-mobility',
    bgClass: 'bg-muscle-mobility',
    barClass: 'bg-muscle-mobility/60',
    icon: StretchHorizontal,
    label: 'Mobility',
  },
};

// Keyword → muscle-group table. Order matters: the first keyword found in the
// (lowercased) session name wins. Covers the common naming conventions plus the
// 11-group taxonomy from CustomExerciseModal, collapsed onto the 7 token hues
// (chest/shoulders/triceps → push; back/biceps → pull; quads/hamstrings/
// glutes/calves → legs; abs → core).
const KEYWORD_TABLE: Array<[string, MuscleGroup]> = [
  // push
  ['push', 'push'],
  ['chest', 'push'],
  ['shoulder', 'push'],
  ['triceps', 'push'],
  ['tricep', 'push'],
  ['press', 'push'],
  ['bench', 'push'],
  // pull
  ['pull', 'pull'],
  ['back', 'pull'],
  ['biceps', 'pull'],
  ['bicep', 'pull'],
  ['row', 'pull'],
  ['lat', 'pull'],
  ['deadlift', 'pull'],
  // legs
  ['leg', 'legs'],
  ['quad', 'legs'],
  ['hamstring', 'legs'],
  ['glute', 'legs'],
  ['calf', 'legs'],
  ['calves', 'legs'],
  ['squat', 'legs'],
  ['lower', 'legs'],
  // core
  ['core', 'core'],
  ['ab', 'core'],
  ['abs', 'core'],
  ['oblique', 'core'],
  ['plank', 'core'],
  // cardio
  ['cardio', 'cardio'],
  ['run', 'cardio'],
  ['hiit', 'cardio'],
  ['conditioning', 'cardio'],
  ['sprint', 'cardio'],
  ['bike', 'cardio'],
  ['row erg', 'cardio'],
  // full-body
  ['full', 'full-body'],
  ['total', 'full-body'],
  ['upper', 'full-body'],
  ['circuit', 'full-body'],
  ['crossfit', 'full-body'],
  ['wod', 'full-body'],
  // mobility
  ['mobility', 'mobility'],
  ['stretch', 'mobility'],
  ['yoga', 'mobility'],
  ['recovery', 'mobility'],
  ['warm', 'mobility'],
  ['flexibility', 'mobility'],
];

// Stable string hash (mirrors the old workoutColors hash) for deterministic
// fallback spread across the 7 hues when no keyword matches.
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash &= hash;
  }
  return Math.abs(hash);
}

/** Resolve a session name to one of the 7 muscle-group hues. */
export function getMuscleGroup(workoutName: string): MuscleGroup {
  const name = workoutName.toLowerCase();
  for (const [keyword, group] of KEYWORD_TABLE) {
    if (name.includes(keyword)) return group;
  }
  return MUSCLE_GROUPS[hashString(name) % MUSCLE_GROUPS.length];
}

/** Convenience: resolve straight to the metadata bundle. */
export function getMuscleGroupMeta(workoutName: string): MuscleGroupMeta {
  return MUSCLE_GROUP_META[getMuscleGroup(workoutName)];
}
