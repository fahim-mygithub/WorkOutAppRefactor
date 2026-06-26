/**
 * The Charlie Split declared as data. Push / Pull / Legs are realized; the
 * generator (generateDay.ts) turns a (program-position, 1RMs, history) into a
 * concrete workout from these tables. All exercise ids are pinned & verified
 * against dist/exercises.json (a startup validator resolves them at runtime).
 *
 * Progression rules per role come from research (see the design plan); the data
 * here only declares structure, rep ranges, RIR, increments, and pools.
 */
import type { EquipmentType } from '../../types/progression';

export type DayType = 'push' | 'pull' | 'legs';

/** Daily rotation: index 0 = push. Advances one calendar day, wraps every 3. */
export const ROTATION: ReadonlyArray<DayType> = ['push', 'pull', 'legs'];

/** Length of each day-type's compound cycle (push/pull = 4, legs = 6). */
export const CYCLE_LEN: Record<DayType, number> = { push: 4, pull: 4, legs: 6 };

/** Lifts that carry an entered/estimated barbell 1RM. Pull-ups use added-load. */
export type OneRmKey =
  | 'bb-bench'
  | 'db-bench'
  | 'seal-row'
  | 'back-squat'
  | 'front-squat'
  | 'deadlift';

export type LoadMode = 'percent1rm' | 'added-load';
export type Plane = 'vertical' | 'horizontal';

export interface RepScheme {
  id: string;
  /** Human label, e.g. "Volume Dumbbell". */
  focus: string;
  sets: number;
  minReps: number;
  maxReps: number;
  targetReps: number;
  /** 0–1 for %1RM lifts; 0 for accessories with no 1RM. */
  percentOf1RM: number;
  restSeconds: number;
  /** Target reps-in-reserve range [min,max]. */
  rir?: readonly [number, number];
  /** Volume compound: pause on every odd rep. */
  pauseOddReps?: boolean;
  /** Deadlift volume: reset on the floor (no touch-and-go). */
  deadStop?: boolean;
  /** Use micro-loading increments (e.g. Heavy-DB to keep a narrow range). */
  microLoad?: boolean;
}

export interface MainLift {
  oneRmKey?: OneRmKey;
  loadMode: LoadMode;
  exerciseId: string;
  exerciseName: string;
  equipment: EquipmentType;
  /** Movement plane (drives Pull accessory plane selection). */
  plane?: Plane;
}

export interface CompoundEntry {
  cycleIndex: number;
  lift: MainLift;
  scheme: RepScheme;
}

export type ProgressionStyle =
  | 'standard' // double progression on load
  | 'reps-first-added-load' // weighted bodyweight (push-ups/dips/pull-ups)
  | 'isolation' // rep-driven + technique ladder, then micro-load
  | 'eccentric-ladder' // Nordic / GHD
  | 'time-ladder' // side plank
  | 'bodyweight-variation' // dragon flag
  | 'retest-ladder';

export interface AccessoryOption {
  exerciseId: string;
  exerciseName: string;
  equipment: EquipmentType;
  /** Weighted-bodyweight: WorkoutSet.weight is the ADDED load (base 0). */
  addedLoad?: boolean;
  /** Per-option override of the role's default progression style. */
  progressionStyle?: ProgressionStyle;
}

export interface AccessoryRole {
  roleKey: string;
  label: string;
  scheme: RepScheme;
  progressionStyle: ProgressionStyle;
  micro?: boolean;
  techniqueLadder?: ReadonlyArray<string>;
  /** Alternates heavy↔volume by the day's compound ordinal parity. */
  heavyVolumeAlternates?: boolean;
  /** Heavy/Volume rep ranges when heavyVolumeAlternates is set. */
  heavyReps?: readonly [number, number];
  volumeReps?: readonly [number, number];
  /** Fixed pool of options (most roles). */
  pool?: ReadonlyArray<AccessoryOption>;
  /** Pull back-pull roles: pick the pool by the compound's plane. */
  planeFromCompound?: 'opposite' | 'same';
}

export interface AccessoryBlock {
  blockKey: string;
  label: string;
  isSuperset: boolean;
  roles: ReadonlyArray<AccessoryRole>;
}

export interface DayTemplate {
  dayType: DayType;
  title: string;
  isStub: boolean;
  cycle: ReadonlyArray<CompoundEntry>;
  accessories: ReadonlyArray<AccessoryBlock>;
}

// ---------- helpers ----------

function accScheme(
  id: string,
  minReps: number,
  maxReps: number,
  extra: Partial<RepScheme> = {},
): RepScheme {
  return {
    id,
    focus: '',
    sets: 4,
    minReps,
    maxReps,
    targetReps: Math.round((minReps + maxReps) / 2),
    percentOf1RM: 0,
    restSeconds: 75,
    rir: [0, 2],
    ...extra,
  };
}

// ============================================================ PUSH

const BB_BENCH: MainLift = {
  oneRmKey: 'bb-bench',
  loadMode: 'percent1rm',
  exerciseId: 'exercise-1335',
  exerciseName: 'Barbell Bench Press',
  equipment: 'barbell',
};
const DB_BENCH: MainLift = {
  oneRmKey: 'db-bench',
  loadMode: 'percent1rm',
  exerciseId: 'exercise-1174',
  exerciseName: 'Dumbbell Bench Press',
  equipment: 'dumbbell',
};

export const PUSH_CYCLE: ReadonlyArray<CompoundEntry> = [
  { cycleIndex: 0, lift: DB_BENCH, scheme: { id: 'vol-db', focus: 'Volume Dumbbell', sets: 4, minReps: 8, maxReps: 15, targetReps: 12, percentOf1RM: 0.65, restSeconds: 120, rir: [0, 2] } },
  { cycleIndex: 1, lift: BB_BENCH, scheme: { id: 'str-bb', focus: 'Strength Barbell', sets: 4, minReps: 3, maxReps: 5, targetReps: 4, percentOf1RM: 0.85, restSeconds: 180, rir: [1, 3] } },
  { cycleIndex: 2, lift: DB_BENCH, scheme: { id: 'heavy-db', focus: 'Heavy Dumbbell', sets: 4, minReps: 3, maxReps: 5, targetReps: 4, percentOf1RM: 0.84, restSeconds: 180, rir: [1, 3], microLoad: true } },
  { cycleIndex: 3, lift: BB_BENCH, scheme: { id: 'vol-bb', focus: 'Volume Barbell', sets: 4, minReps: 8, maxReps: 12, targetReps: 10, percentOf1RM: 0.7, restSeconds: 120, rir: [0, 2] } },
];

const PUSH_ACCESSORY_BLOCKS: ReadonlyArray<AccessoryBlock> = [
  {
    blockKey: 'ss1',
    label: 'Overhead + chest push',
    isSuperset: true,
    roles: [
      {
        roleKey: 'ss1-a',
        label: 'Overhead press',
        scheme: accScheme('push-ohp', 10, 15, { rir: [2, 3] }),
        progressionStyle: 'standard',
        pool: [
          { exerciseId: 'exercise-1003', exerciseName: 'Barbell Overhead Press', equipment: 'barbell' },
          { exerciseId: 'exercise-1016', exerciseName: 'Dumbbell Overhead Press', equipment: 'dumbbell' },
          { exerciseId: 'exercise-1092', exerciseName: 'Smith Machine Seated Overhead Press', equipment: 'smith-machine' },
        ],
      },
      {
        roleKey: 'ss1-b',
        label: 'Chest push',
        scheme: accScheme('push-chest', 10, 15, { rir: [1, 2] }),
        progressionStyle: 'standard',
        pool: [
          { exerciseId: 'exercise-1341', exerciseName: 'Push Up', equipment: 'bodyweight', addedLoad: true, progressionStyle: 'reps-first-added-load' },
          { exerciseId: 'exercise-1237', exerciseName: 'Machine Chest Press', equipment: 'machine' },
          { exerciseId: 'exercise-1235', exerciseName: 'Parallel Bar Dips', equipment: 'bodyweight', addedLoad: true, progressionStyle: 'reps-first-added-load' },
        ],
      },
    ],
  },
  {
    blockKey: 'ss2',
    label: 'Lateral raise + lower-chest press',
    isSuperset: true,
    roles: [
      {
        roleKey: 'ss2-a',
        label: 'Lateral raise',
        scheme: accScheme('push-lat', 12, 20, { rir: [1, 2], restSeconds: 60 }),
        progressionStyle: 'isolation',
        micro: true,
        techniqueLadder: ['clean', 'eccentric-2s', 'bottom-pause', 'myo-rep-finisher'],
        pool: [
          { exerciseId: 'exercise-980', exerciseName: 'Dumbbell Lateral Raise', equipment: 'dumbbell' },
          { exerciseId: 'exercise-995', exerciseName: 'Cable Low Single Arm Lateral Raise', equipment: 'cable' },
          { exerciseId: 'exercise-1028', exerciseName: 'Plate Lateral Raise', equipment: 'plate' },
        ],
      },
      {
        roleKey: 'ss2-b',
        label: 'Lower-chest press',
        scheme: accScheme('push-lower-chest', 10, 15, { rir: [2, 3] }),
        progressionStyle: 'standard',
        pool: [
          { exerciseId: 'exercise-1249', exerciseName: 'Machine Plate Loaded Decline Chest Press', equipment: 'machine' },
          { exerciseId: 'exercise-1122', exerciseName: 'Cable Decline Bench Press', equipment: 'cable' },
          { exerciseId: 'exercise-1176', exerciseName: 'Dumbbell Decline Bench Press', equipment: 'dumbbell' },
        ],
      },
    ],
  },
  {
    blockKey: 'ss3',
    label: 'Fly + rear delt',
    isSuperset: true,
    roles: [
      {
        roleKey: 'ss3-a',
        label: 'Fly',
        scheme: accScheme('push-fly', 15, 20, { rir: [0, 2] }),
        progressionStyle: 'isolation',
        micro: true,
        heavyVolumeAlternates: true,
        heavyReps: [8, 10],
        volumeReps: [15, 20],
        techniqueLadder: ['clean', 'eccentric-2s', 'lengthened-partials', 'myo-rep-finisher'],
        pool: [
          { exerciseId: 'exercise-1374', exerciseName: 'Machine Pec Fly', equipment: 'machine' },
          { exerciseId: 'exercise-1342', exerciseName: 'Cable Pec Fly', equipment: 'cable' },
          { exerciseId: 'exercise-1344', exerciseName: 'Dumbbell Chest Fly', equipment: 'dumbbell' },
        ],
      },
      {
        roleKey: 'ss3-b',
        label: 'Rear delt',
        scheme: accScheme('push-rear-delt', 15, 25, { rir: [0, 2], restSeconds: 60 }),
        progressionStyle: 'isolation',
        micro: true,
        techniqueLadder: ['clean', 'peak-hold', 'myo-rep-finisher'],
        pool: [
          { exerciseId: 'exercise-981', exerciseName: 'Dumbbell Rear Delt Fly', equipment: 'dumbbell' },
          { exerciseId: 'exercise-996', exerciseName: 'Cable High Single Arm Rear Delt Fly', equipment: 'cable' },
          { exerciseId: 'exercise-982', exerciseName: 'Cable Rope Face Pulls', equipment: 'cable' },
        ],
      },
    ],
  },
];

// ============================================================ PULL

const PULLUP: MainLift = {
  loadMode: 'added-load',
  exerciseId: 'exercise-177',
  exerciseName: 'Pull Ups',
  equipment: 'bodyweight',
  plane: 'vertical',
};
const SEAL_ROW: MainLift = {
  oneRmKey: 'seal-row',
  loadMode: 'percent1rm',
  exerciseId: 'exercise-976',
  exerciseName: 'Machine Plate Loaded Seal Row',
  equipment: 'barbell',
  plane: 'horizontal',
};

export const PULL_CYCLE: ReadonlyArray<CompoundEntry> = [
  { cycleIndex: 0, lift: PULLUP, scheme: { id: 'vol-pullup', focus: 'Volume Pull-up', sets: 4, minReps: 10, maxReps: 15, targetReps: 12, percentOf1RM: 0, restSeconds: 150, rir: [0, 2] } },
  { cycleIndex: 1, lift: SEAL_ROW, scheme: { id: 'heavy-seal', focus: 'Heavy Seal Row', sets: 4, minReps: 3, maxReps: 5, targetReps: 5, percentOf1RM: 0.84, restSeconds: 180, rir: [1, 3] } },
  { cycleIndex: 2, lift: PULLUP, scheme: { id: 'heavy-pullup', focus: 'Heavy Pull-up', sets: 4, minReps: 4, maxReps: 6, targetReps: 5, percentOf1RM: 0, restSeconds: 180, rir: [1, 3] } },
  { cycleIndex: 3, lift: SEAL_ROW, scheme: { id: 'vol-seal', focus: 'Volume Seal Row', sets: 4, minReps: 8, maxReps: 15, targetReps: 12, percentOf1RM: 0.68, restSeconds: 150, rir: [0, 2] } },
];

/** Horizontal back-pull pool (Cable Row), grip-rotated. */
export const PULL_HORIZONTAL_POOL: ReadonlyArray<AccessoryOption> = [
  { exerciseId: 'exercise-87', exerciseName: 'Cable Single Arm Neutral Grip Row', equipment: 'cable' },
  { exerciseId: 'exercise-84', exerciseName: 'Cable Supinating Row', equipment: 'cable' },
  { exerciseId: 'exercise-80', exerciseName: 'Cable Archer Row', equipment: 'cable' },
];
/** Vertical back-pull pool (Pulldown), grip-rotated. */
export const PULL_VERTICAL_POOL: ReadonlyArray<AccessoryOption> = [
  { exerciseId: 'exercise-94', exerciseName: 'Neutral Pulldown', equipment: 'machine' },
  { exerciseId: 'exercise-95', exerciseName: 'Underhand Pulldown', equipment: 'machine' },
  { exerciseId: 'exercise-110', exerciseName: 'Narrow Pulldown', equipment: 'machine' },
];

const TRICEPS_POOL: ReadonlyArray<AccessoryOption> = [
  { exerciseId: 'exercise-1149', exerciseName: 'Cable Rope Overhead Tricep Extension', equipment: 'cable' },
  { exerciseId: 'exercise-1146', exerciseName: 'Cable Rope Pushdown', equipment: 'cable' },
  { exerciseId: 'exercise-1154', exerciseName: 'Barbell Skullcrusher', equipment: 'barbell' },
];

const PULL_ACCESSORY_BLOCKS: ReadonlyArray<AccessoryBlock> = [
  {
    blockKey: 'ss1',
    label: 'Back pull (opposite plane) + triceps',
    isSuperset: true,
    roles: [
      {
        roleKey: 'ss1-a',
        label: 'Back pull (opposite plane)',
        scheme: accScheme('pull-back-opp', 10, 15, { rir: [2, 3] }),
        progressionStyle: 'standard',
        planeFromCompound: 'opposite',
      },
      {
        roleKey: 'ss1-b',
        label: 'Triceps',
        scheme: accScheme('pull-tri-1', 10, 15, { rir: [0, 2] }),
        progressionStyle: 'isolation',
        micro: true,
        techniqueLadder: ['clean', 'eccentric-2s', 'lengthened-partials', 'myo-rep-finisher'],
        pool: TRICEPS_POOL,
      },
    ],
  },
  {
    blockKey: 'ss2',
    label: 'Back pull (same plane) + triceps',
    isSuperset: true,
    roles: [
      {
        roleKey: 'ss2-a',
        label: 'Back pull (same plane)',
        scheme: accScheme('pull-back-same', 10, 15, { rir: [2, 3] }),
        progressionStyle: 'standard',
        planeFromCompound: 'same',
      },
      {
        roleKey: 'ss2-b',
        label: 'Triceps',
        scheme: accScheme('pull-tri-2', 10, 15, { rir: [0, 2] }),
        progressionStyle: 'isolation',
        micro: true,
        techniqueLadder: ['clean', 'eccentric-2s', 'lengthened-partials', 'myo-rep-finisher'],
        pool: TRICEPS_POOL,
      },
    ],
  },
  {
    blockKey: 'ss3',
    label: 'Lower back + biceps',
    isSuperset: true,
    roles: [
      {
        roleKey: 'ss3-a',
        label: 'Lower back',
        scheme: accScheme('pull-lowerback', 12, 20, { rir: [3, 4], restSeconds: 90 }),
        progressionStyle: 'standard',
        pool: [
          { exerciseId: 'exercise-215', exerciseName: 'Machine 45 Degree Back Extension', equipment: 'machine' },
          { exerciseId: 'exercise-341', exerciseName: 'Machine Back Extension', equipment: 'machine' },
          { exerciseId: 'exercise-237', exerciseName: 'Barbell High Bar Good Morning', equipment: 'barbell' },
        ],
      },
      {
        roleKey: 'ss3-b',
        label: 'Biceps (hammer)',
        scheme: accScheme('pull-bi-hammer', 10, 15, { rir: [0, 2] }),
        progressionStyle: 'isolation',
        micro: true,
        techniqueLadder: ['clean', 'eccentric-2s', 'peak-hold', 'myo-rep-finisher'],
        pool: [
          { exerciseId: 'exercise-3', exerciseName: 'Dumbbell Hammer Curl', equipment: 'dumbbell' },
          { exerciseId: 'exercise-83', exerciseName: 'Cable Rope Hammer Curl', equipment: 'cable' },
          { exerciseId: 'exercise-1', exerciseName: 'Barbell Curl', equipment: 'barbell' },
        ],
      },
    ],
  },
  {
    blockKey: 'finisher',
    label: 'Biceps finisher',
    isSuperset: false,
    roles: [
      {
        roleKey: 'finisher-a',
        label: 'Biceps (curl)',
        scheme: accScheme('pull-bi-curl', 10, 15, { rir: [0, 2] }),
        progressionStyle: 'isolation',
        micro: true,
        techniqueLadder: ['clean', 'eccentric-2s', 'lengthened-partials', 'myo-rep-finisher'],
        pool: [
          { exerciseId: 'exercise-120', exerciseName: 'Dumbbell Preacher Curl', equipment: 'dumbbell' },
          { exerciseId: 'exercise-82', exerciseName: 'Cable Bayesian Curl', equipment: 'cable' },
          { exerciseId: 'exercise-149', exerciseName: 'Machine Seated Plate Loaded Preacher Curl', equipment: 'machine' },
        ],
      },
    ],
  },
];

// ============================================================ LEGS

const BACK_SQUAT: MainLift = { oneRmKey: 'back-squat', loadMode: 'percent1rm', exerciseId: 'exercise-557', exerciseName: 'Barbell Heels Up Back Squat', equipment: 'barbell' };
const FRONT_SQUAT: MainLift = { oneRmKey: 'front-squat', loadMode: 'percent1rm', exerciseId: 'exercise-551', exerciseName: 'Barbell Front Squat Olympic', equipment: 'barbell' };
const DEADLIFT: MainLift = { oneRmKey: 'deadlift', loadMode: 'percent1rm', exerciseId: 'exercise-176', exerciseName: 'Barbell Deadlift', equipment: 'barbell' };

export const LEGS_CYCLE: ReadonlyArray<CompoundEntry> = [
  { cycleIndex: 0, lift: BACK_SQUAT, scheme: { id: 'bs-heavy', focus: 'Back Squat — Heavy', sets: 4, minReps: 4, maxReps: 6, targetReps: 5, percentOf1RM: 0.8, restSeconds: 210, rir: [1, 2] } },
  { cycleIndex: 1, lift: FRONT_SQUAT, scheme: { id: 'fs-volume', focus: 'Front Squat — Volume', sets: 4, minReps: 6, maxReps: 8, targetReps: 7, percentOf1RM: 0.68, restSeconds: 180, rir: [2, 2], pauseOddReps: true } },
  { cycleIndex: 2, lift: DEADLIFT, scheme: { id: 'dl-heavy', focus: 'Deadlift — Heavy', sets: 4, minReps: 4, maxReps: 6, targetReps: 5, percentOf1RM: 0.79, restSeconds: 240, rir: [2, 3] } },
  { cycleIndex: 3, lift: BACK_SQUAT, scheme: { id: 'bs-volume', focus: 'Back Squat — Volume', sets: 4, minReps: 6, maxReps: 8, targetReps: 7, percentOf1RM: 0.69, restSeconds: 180, rir: [1, 2], pauseOddReps: true } },
  { cycleIndex: 4, lift: FRONT_SQUAT, scheme: { id: 'fs-heavy', focus: 'Front Squat — Heavy', sets: 4, minReps: 4, maxReps: 6, targetReps: 5, percentOf1RM: 0.79, restSeconds: 210, rir: [1, 2] } },
  { cycleIndex: 5, lift: DEADLIFT, scheme: { id: 'dl-volume', focus: 'Deadlift — Volume', sets: 4, minReps: 6, maxReps: 8, targetReps: 7, percentOf1RM: 0.67, restSeconds: 180, rir: [3, 3], pauseOddReps: true, deadStop: true } },
];

const LEGS_ACCESSORY_BLOCKS: ReadonlyArray<AccessoryBlock> = [
  {
    blockKey: 'ss1',
    label: 'Quad + upper core',
    isSuperset: true,
    roles: [
      {
        roleKey: 'ss1-a',
        label: 'Quad',
        scheme: accScheme('legs-quad', 8, 12, { rir: [1, 2], restSeconds: 120 }),
        progressionStyle: 'standard',
        pool: [
          { exerciseId: 'exercise-600', exerciseName: 'Dumbbell Bulgarian Split Squat', equipment: 'dumbbell' },
          { exerciseId: 'exercise-701', exerciseName: 'Walking Lunge', equipment: 'bodyweight', addedLoad: true },
          { exerciseId: 'exercise-714', exerciseName: 'Machine Leg Press', equipment: 'machine' },
        ],
      },
      {
        roleKey: 'ss1-b',
        label: 'Upper core',
        scheme: accScheme('legs-upper-core', 15, 25, { rir: [2, 3], restSeconds: 75 }),
        progressionStyle: 'isolation',
        micro: true,
        heavyVolumeAlternates: true,
        heavyReps: [8, 12],
        volumeReps: [15, 25],
        techniqueLadder: ['clean', 'eccentric-2s', 'peak-hold'],
        pool: [
          { exerciseId: 'exercise-401', exerciseName: 'Dumbbell Situp', equipment: 'dumbbell' },
          { exerciseId: 'exercise-407', exerciseName: 'Cable Rope Kneeling Crunch', equipment: 'cable' },
        ],
      },
    ],
  },
  {
    blockKey: 'ss2',
    label: 'Hamstring + lower core',
    isSuperset: true,
    roles: [
      {
        roleKey: 'ss2-a',
        label: 'Hamstring / glute',
        scheme: accScheme('legs-ham', 10, 15, { rir: [0, 2], restSeconds: 90 }),
        progressionStyle: 'standard',
        pool: [
          { exerciseId: 'exercise-896', exerciseName: 'Machine Hamstring Curl', equipment: 'machine' },
          { exerciseId: 'exercise-937', exerciseName: 'Machine Plate Loaded Kneeling Hamstring Curl', equipment: 'machine' },
          { exerciseId: 'exercise-901', exerciseName: 'Nordic Hamstring Curl', equipment: 'bodyweight', progressionStyle: 'eccentric-ladder' },
        ],
      },
      {
        roleKey: 'ss2-b',
        label: 'Lower core',
        scheme: accScheme('legs-lower-core', 15, 25, { rir: [2, 3], restSeconds: 75 }),
        progressionStyle: 'isolation',
        micro: true,
        heavyVolumeAlternates: true,
        heavyReps: [8, 12],
        volumeReps: [15, 25],
        techniqueLadder: ['clean', 'eccentric-2s'],
        pool: [
          { exerciseId: 'exercise-367', exerciseName: 'Laying Leg Raises', equipment: 'bodyweight', addedLoad: true },
          { exerciseId: 'exercise-363', exerciseName: 'Hanging Knee Raises', equipment: 'bodyweight', addedLoad: true },
          { exerciseId: 'exercise-390', exerciseName: 'Laying Alternating Leg Raise', equipment: 'bodyweight', addedLoad: true },
        ],
      },
    ],
  },
  {
    blockKey: 'ss3',
    label: 'Stability finisher',
    isSuperset: true,
    roles: [
      {
        roleKey: 'ss3-a',
        label: 'Side plank',
        scheme: accScheme('legs-side-plank', 1, 1, { rir: [3, 4], restSeconds: 45 }),
        progressionStyle: 'time-ladder',
        pool: [
          { exerciseId: 'exercise-1405', exerciseName: 'Hand Side Plank', equipment: 'bodyweight' },
          { exerciseId: 'exercise-1404', exerciseName: 'Elbow Side Plank', equipment: 'bodyweight' },
          { exerciseId: 'exercise-1409', exerciseName: 'Dumbbell Side Plank Up Down', equipment: 'dumbbell', addedLoad: true },
        ],
      },
      {
        roleKey: 'ss3-b',
        label: 'Dragon flag',
        scheme: accScheme('legs-dragon-flag', 3, 10, { rir: [1, 2], restSeconds: 60 }),
        progressionStyle: 'bodyweight-variation',
        pool: [
          { exerciseId: 'exercise-1504', exerciseName: 'Eccentric Dragonflag', equipment: 'bodyweight' },
        ],
      },
    ],
  },
];

// ============================================================ TEMPLATES

export const CHARLIE_TEMPLATES: Record<DayType, DayTemplate> = {
  push: { dayType: 'push', title: 'Charlie · Push', isStub: false, cycle: PUSH_CYCLE, accessories: PUSH_ACCESSORY_BLOCKS },
  pull: { dayType: 'pull', title: 'Charlie · Pull', isStub: false, cycle: PULL_CYCLE, accessories: PULL_ACCESSORY_BLOCKS },
  legs: { dayType: 'legs', title: 'Charlie · Legs', isStub: false, cycle: LEGS_CYCLE, accessories: LEGS_ACCESSORY_BLOCKS },
};

/** Variant label for a (dayType, cycleIndex) — for calendar/preview. */
export function variantLabel(dayType: DayType, cycleIndex: number): string {
  const cycle = CHARLIE_TEMPLATES[dayType].cycle;
  const len = CYCLE_LEN[dayType];
  const entry = cycle[((cycleIndex % len) + len) % len];
  return entry ? entry.scheme.focus : '';
}
