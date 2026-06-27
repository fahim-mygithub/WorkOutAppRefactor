/**
 * Turn a generated Charlie day (the launch-ready WorkoutExercise[]) into a
 * display model for the planned-day card: grouped into a featured compound,
 * superset pairs, and standalone accessories, each slot carrying its rep range,
 * prescribed load, coaching cues, reroll pool, and last-performed numbers.
 *
 * Pure: the generated exercises and the template share one canonical order
 * (compound first, then block-by-block / role-by-role — see generateDay), so we
 * walk both in lockstep by a running index. No re-derivation of picks or weights.
 */
import type { Exercise, WorkoutExercise } from '../../types/exercise';
import type { WorkoutSummary } from '../../types/exerciseHistory';
import { toDateKey } from '../dateKey';
import { CHARLIE_TEMPLATES, type AccessoryOption, type DayType } from './definition';
import { accessoryRolesForDay } from './generateDay';

/** Coaching cues that describe HOW to load — surfaced as the weight, not a chip. */
const LOAD_CUES = new Set(['Weighted (added load)']);

export interface PerformedLast {
  sets: number;
  /** Total reps across all sets in that session. */
  reps: number;
  volume: number;
  /** Mean working load (volume / reps), null when bodyweight / time-based. */
  avgWeight: number | null;
  dateKey: string;
}

export interface PlanSlot {
  exerciseId: string;
  exercise: Exercise;
  title: string;
  equipment: string;
  kind: 'compound' | 'accessory';
  /** Accessory only: the role this fills, for per-row reroll. */
  roleKey?: string;
  /** Accessory only: the rotation pool (for "n options" affordance). */
  pool?: ReadonlyArray<AccessoryOption>;
  /** Position within a superset (0 = A, 1 = B); undefined when not paired. */
  position?: number;
  setsCount: number;
  repMin: number;
  repMax: number;
  isTime: boolean;
  timeSeconds?: number;
  /** Prescribed working load (added load for weighted-bodyweight); 0/undefined = bodyweight. */
  weight?: number;
  /** Weighted-bodyweight movement (push-up / dip / pull-up): weight is ADDED load. */
  addedLoad: boolean;
  cues: string[];
  last: PerformedLast | null;
}

export interface PlanGroup {
  kind: 'compound' | 'superset' | 'standalone';
  /** Descriptive header for supersets ("Lateral raise + lower-chest press"). */
  label?: string;
  slots: PlanSlot[];
}

/** Index the local performed history by exerciseId → most-recent session numbers. */
export function buildPerformedMap(summaries: WorkoutSummary[]): Map<string, PerformedLast> {
  const sorted = [...summaries].sort((a, b) => b.endTime.getTime() - a.endTime.getTime());
  const map = new Map<string, PerformedLast>();
  for (const s of sorted) {
    for (const e of s.exercisesSummary) {
      if (map.has(e.exerciseId)) continue; // first = most recent
      map.set(e.exerciseId, {
        sets: e.sets,
        reps: e.reps,
        volume: e.volume,
        avgWeight: e.reps > 0 && e.volume > 0 ? Math.round(e.volume / e.reps) : null,
        dateKey: toDateKey(s.endTime),
      });
    }
  }
  return map;
}

export function buildPlanDetail(
  dayType: DayType,
  cycleIndex: number,
  exercises: WorkoutExercise[],
  performed: Map<string, PerformedLast>,
): PlanGroup[] {
  const template = CHARLIE_TEMPLATES[dayType];
  const entry = template.cycle[cycleIndex];
  const poolByRole = new Map(
    accessoryRolesForDay(dayType, cycleIndex).map((r) => [r.roleKey, r.pool] as const),
  );

  const cuesOf = (we: WorkoutExercise): string[] => {
    const raw = we.notes ? we.notes.split(' · ') : [];
    // Drop load-describing cues (shown as the weight) and the pull-up note
    // ("Bodyweight" / "<lift> + N lb") which we render as the prescribed load.
    return raw.filter(
      (c) => !LOAD_CUES.has(c) && c !== 'Bodyweight' && !/\+\s*\d+\s*lb$/i.test(c),
    );
  };

  const groups: PlanGroup[] = [];
  let idx = 0;

  // ---- featured compound (exercises[0]) ----
  {
    const we = exercises[idx++];
    if (we) {
      const s0 = we.sets[0];
      groups.push({
        kind: 'compound',
        slots: [
          {
            exerciseId: we.exercise.id,
            exercise: we.exercise,
            title: we.customTitle || we.exercise.name,
            equipment: we.exercise.equipment,
            kind: 'compound',
            setsCount: we.sets.length,
            repMin: entry.scheme.minReps,
            repMax: entry.scheme.maxReps,
            isTime: s0?.time != null,
            timeSeconds: s0?.time,
            weight: s0?.weight,
            addedLoad: entry.lift.loadMode === 'added-load',
            cues: cuesOf(we),
            last: performed.get(we.exercise.id) ?? null,
          },
        ],
      });
    }
  }

  // ---- accessory blocks (walk template + generated exercises in lockstep) ----
  for (const block of template.accessories) {
    const slots: PlanSlot[] = [];
    block.roles.forEach((role, roleIdx) => {
      const we = exercises[idx++];
      if (!we) return;
      const s0 = we.sets[0];
      const pool = poolByRole.get(role.roleKey);
      const opt = pool?.find((o) => o.exerciseId === we.exercise.id);
      slots.push({
        exerciseId: we.exercise.id,
        exercise: we.exercise,
        title: we.customTitle || we.exercise.name,
        equipment: we.exercise.equipment,
        kind: 'accessory',
        roleKey: role.roleKey,
        pool,
        position: block.isSuperset ? roleIdx : undefined,
        setsCount: we.sets.length,
        repMin: role.scheme.minReps,
        repMax: role.scheme.maxReps,
        isTime: s0?.time != null || role.progressionStyle === 'time-ladder',
        timeSeconds: s0?.time,
        weight: s0?.weight,
        addedLoad: opt?.addedLoad ?? false,
        cues: cuesOf(we),
        last: performed.get(we.exercise.id) ?? null,
      });
    });
    if (slots.length === 0) continue;
    groups.push({
      kind: block.isSuperset ? 'superset' : 'standalone',
      label: block.label,
      slots,
    });
  }

  return groups;
}
