/**
 * Turn a program position + 1RMs into a concrete Charlie-Split workout
 * (WorkoutExercise[] ready for sanitizeWorkoutExercisesForRedux → startWorkout).
 *
 * Pure & deterministic: weights are Regime-A seeds from the entered 1RM (the
 * performance-gated engine takes over once history exists — later phase); ids are
 * derived from the program position so the same projected day renders identically.
 */
import type { Exercise, WorkoutExercise, WorkoutSet } from '../../types/exercise';
import type { EquipmentType } from '../../types/progression';
import type {
  AccessoryBlock,
  AccessoryOption,
  AccessoryRole,
  CompoundEntry,
  DayType,
  OneRmKey,
  RepScheme,
} from './definition';
import {
  CHARLIE_TEMPLATES,
  PULL_HORIZONTAL_POOL,
  PULL_VERTICAL_POOL,
} from './definition';
import { accessoryPickForOrdinal } from './accessories';
import { seedWorkingWeight } from './progression';

const EQUIP_DISPLAY: Record<EquipmentType, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbells',
  machine: 'Machine',
  cable: 'Cables',
  bodyweight: 'Bodyweight',
  band: 'Band',
  plate: 'Plate',
  kettlebell: 'Kettlebells',
  'smith-machine': 'Smith-Machine',
  trx: 'TRX',
};

const DAY_LABEL: Record<DayType, string> = { push: 'Push', pull: 'Pull', legs: 'Legs' };

export interface PullupSeeds {
  heavyAddedLoad?: number;
  volumeAddedLoad?: number;
  bodyweight?: number;
}

export interface CharlieDayInputs {
  programId: string;
  dayType: DayType;
  /** Position within the day-type's compound cycle. */
  cycleIndex: number;
  /** How many times this day-type has occurred (m): seeds avoid-chain + heavy/volume parity. */
  cycleOrdinal: number;
  oneRepMax: Partial<Record<OneRmKey, number>>;
  pullup?: PullupSeeds;
  /** Resolve a pinned id/name to a full catalog Exercise (app supplies the catalog). */
  resolveExercise?: (opt: { id: string; name: string; equipment: EquipmentType }) => Exercise;
  /** roleKey → last performed exerciseId, to seed the avoid-chain from real history. */
  lastPicks?: Record<string, string>;
  /** roleKey → chosen exerciseId (reroll / manual swap). */
  overridePicks?: Record<string, string>;
}

export interface GeneratedDay {
  dayType: DayType;
  cycleIndex: number;
  name: string;
  variantLabel: string;
  exercises: WorkoutExercise[];
}

function minimalExercise(id: string, name: string, equipment: EquipmentType): Exercise {
  return {
    id,
    name,
    muscleGroup: '',
    muscleGroups: [],
    equipment: EQUIP_DISPLAY[equipment],
    videoLinks: [],
    instructions: [],
    difficulty: 'Intermediate',
    force: null,
    grips: null,
    mechanic: null,
    searchKeywords: [name.toLowerCase()],
    createdAt: '',
    updatedAt: '',
  };
}

function buildSets(
  scheme: RepScheme,
  opts: {
    reps?: number;
    repMin?: number;
    repMax?: number;
    weight?: number;
    timeSeconds?: number;
    idScope: string;
  },
): WorkoutSet[] {
  const isTime = opts.timeSeconds != null;
  const reps = opts.reps ?? scheme.targetReps;
  const repMin = opts.repMin ?? scheme.minReps;
  const repMax = opts.repMax ?? scheme.maxReps;
  return Array.from({ length: scheme.sets }, (_, i) => {
    const set: WorkoutSet = {
      id: `${opts.idScope}|s${i}`,
      reps: isTime ? 1 : reps,
      unit: 'lbs',
      completed: false,
    };
    // Non-time sets carry the prescribed range so the UI shows it and double
    // progression knows the ceiling to earn up to. Time sets have no rep range.
    if (!isTime) {
      set.repMin = repMin;
      set.repMax = repMax;
    }
    if (opts.weight != null) set.weight = opts.weight;
    if (opts.timeSeconds != null) set.time = opts.timeSeconds;
    return set;
  });
}

function poolForRole(role: AccessoryRole, compound: CompoundEntry): ReadonlyArray<AccessoryOption> {
  if (role.pool) return role.pool;
  // Plane-driven (Pull SS1/SS2): opposite/same plane vs the compound.
  const compoundVertical = compound.lift.plane === 'vertical';
  if (role.planeFromCompound === 'opposite') {
    return compoundVertical ? PULL_HORIZONTAL_POOL : PULL_VERTICAL_POOL;
  }
  return compoundVertical ? PULL_VERTICAL_POOL : PULL_HORIZONTAL_POOL;
}

/** Resolved accessory roles (roleKey + plane-aware pool) for a day — used by reroll. */
export function accessoryRolesForDay(
  dayType: DayType,
  cycleIndex: number,
): Array<{ roleKey: string; pool: ReadonlyArray<AccessoryOption> }> {
  const template = CHARLIE_TEMPLATES[dayType];
  const entry = template.cycle[cycleIndex];
  const out: Array<{ roleKey: string; pool: ReadonlyArray<AccessoryOption> }> = [];
  for (const block of template.accessories) {
    for (const role of block.roles) {
      out.push({ roleKey: role.roleKey, pool: poolForRole(role, entry) });
    }
  }
  return out;
}

export function generateCharlieDay(inputs: CharlieDayInputs): GeneratedDay {
  const { programId, dayType, cycleIndex, cycleOrdinal, oneRepMax, pullup } = inputs;
  const resolve =
    inputs.resolveExercise ?? ((o) => minimalExercise(o.id, o.name, o.equipment));
  const template = CHARLIE_TEMPLATES[dayType];
  const entry = template.cycle[cycleIndex];
  const label = entry.scheme.focus;
  const name = `${DAY_LABEL[dayType]} · ${label}`;
  const isHeavyParity = cycleOrdinal % 2 === 1;

  const exercises: WorkoutExercise[] = [];

  // ---- main compound ----
  {
    const lift = entry.lift;
    const scheme = entry.scheme;
    const ex = resolve({ id: lift.exerciseId, name: lift.exerciseName, equipment: lift.equipment });
    let weight: number | undefined;
    const noteParts: string[] = [];
    if (lift.loadMode === 'percent1rm') {
      const oneRm = lift.oneRmKey ? oneRepMax[lift.oneRmKey] : undefined;
      weight = oneRm && oneRm > 0 ? seedWorkingWeight(entry, oneRm) : undefined;
    } else {
      // weighted-bodyweight (pull-up): seed added load by heavy/volume
      const added = scheme.id.startsWith('heavy')
        ? pullup?.heavyAddedLoad ?? 35
        : pullup?.volumeAddedLoad ?? 0;
      weight = added;
      noteParts.push(added > 0 ? `${lift.exerciseName} + ${added} lb` : 'Bodyweight');
    }
    if (scheme.pauseOddReps) noteParts.push('Pause on every odd rep');
    if (scheme.deadStop) noteParts.push('Dead-stop reset (no touch-and-go)');
    exercises.push({
      id: `${programId}|${dayType}|c${cycleIndex}|main`,
      exercise: ex,
      sets: buildSets(scheme, {
        reps: scheme.targetReps,
        weight,
        idScope: `${programId}|${dayType}|c${cycleIndex}|main`,
      }),
      restTime: scheme.restSeconds,
      notes: noteParts.join(' · ') || undefined,
    });
  }

  // ---- accessory blocks ----
  for (const block of template.accessories) {
    const blockExercises: WorkoutExercise[] = [];
    const supersetId = `${programId}|${dayType}|c${cycleIndex}|${block.blockKey}`;
    block.roles.forEach((role, roleIdx) => {
      const pool = poolForRole(role, entry);
      const overrideId = inputs.overridePicks?.[role.roleKey];
      const pick =
        (overrideId && pool.find((o) => o.exerciseId === overrideId)) ||
        accessoryPickForOrdinal(
          programId,
          `${dayType}|${block.blockKey}|${role.roleKey}`,
          pool,
          cycleOrdinal,
          inputs.lastPicks?.[role.roleKey],
        );

      const ex = resolve({ id: pick.exerciseId, name: pick.exerciseName, equipment: pick.equipment });
      const isTime = role.progressionStyle === 'time-ladder';
      const noteParts: string[] = [];

      // Rep range for this role: the scheme's, unless heavy↔volume alternation
      // swaps in a parity-specific range. Double progression starts at the floor,
      // so the logged-rep default is repMin (never a rounded midpoint like 13).
      let repMin = role.scheme.minReps;
      let repMax = role.scheme.maxReps;
      if (role.heavyVolumeAlternates && role.heavyReps && role.volumeReps) {
        [repMin, repMax] = isHeavyParity ? role.heavyReps : role.volumeReps;
        noteParts.push(isHeavyParity ? 'Heavy' : 'Volume');
      }
      if (pick.addedLoad) noteParts.push('Weighted (added load)');

      const idScope = `${supersetId}|${role.roleKey}|${pick.exerciseId}`;
      const sets = buildSets(role.scheme, {
        reps: repMin,
        repMin,
        repMax,
        weight: pick.addedLoad ? 0 : undefined,
        timeSeconds: isTime ? 20 : undefined,
        idScope,
      });

      const we: WorkoutExercise = {
        id: idScope,
        exercise: ex,
        sets,
        restTime: role.scheme.restSeconds,
        notes: noteParts.join(' · ') || undefined,
      };
      if (block.isSuperset) {
        we.isSuperset = true;
        we.supersetId = supersetId;
        we.supersetIndex = roleIdx;
      }
      blockExercises.push(we);
    });

    if (block.isSuperset && blockExercises.length > 0) {
      blockExercises[0].supersetExerciseIds = blockExercises.map((e) => e.id);
    }
    exercises.push(...blockExercises);
  }

  return { dayType, cycleIndex, name, variantLabel: label, exercises };
}
