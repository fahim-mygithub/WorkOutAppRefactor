/**
 * Pure Strength Markers calculator: turns logged ExerciseHistory into per-lift
 * best sets, 3-session smoothed effort-adjusted e1RMs, and heavy / moderate /
 * volume working weights using the app's existing 1RM math.
 */
import { WEIGHT_STEP } from '../components/workout/list/workoutCardUtils';
import type { ExerciseHistory, PerformedSet } from '../types/exerciseHistory';
import type { EquipmentType } from '../types/progression';
import { loadForReps, roundToIncrement } from './oneRepMax';
import { effortAdjustedE1RM } from './progression/e1rm';
import { smoothedSessions } from './progression/sessionE1RM';

export type StrengthMarkerSource = 'estimate' | 'Claude-reviewed' | 'stated';

export interface StatedMaxOverride {
  exerciseKey: string;
  exerciseName: string;
  weight: number;
  unit: 'lbs' | 'kg';
  updatedAt: string;
}

export interface AiMarkerReview {
  exerciseKey: string;
  e1RM: number;
  note: string;
  reviewedAt: string;
  formulaE1RM: number;
}

export interface WorkingWeightRange {
  label: string;
  repRange: string;
  minReps: number;
  maxReps: number;
  weight: number;
  minWeight: number;
  maxWeight: number;
}

export interface BestLoggedSet {
  weight: number;
  reps: number;
  rir?: number;
  unit: 'lbs' | 'kg';
  e1RM: number;
  workoutDate: string;
}

export interface SessionBestEntry {
  workoutDate: string;
  weight: number;
  reps: number;
  rir?: number;
  e1RM: number;
}

export interface BaseStrengthMarker {
  exerciseKey: string;
  exerciseId: string;
  exerciseName: string;
  equipment: string;
  unit: 'lbs' | 'kg';
  bestSet: BestLoggedSet;
  bestE1RM: number;
  formulaE1RM: number;
  rawFormulaE1RM: number;
  sessionCount: number;
  sessionBests: SessionBestEntry[];
}

export interface StrengthMarker extends BaseStrengthMarker {
  e1RM: number;
  source: StrengthMarkerSource;
  note?: string;
  workingWeights: {
    heavy: WorkingWeightRange;
    moderate: WorkingWeightRange;
    volume: WorkingWeightRange;
  };
}

export interface MarkerOverrideOptions {
  statedMaxes?: Readonly<Record<string, StatedMaxOverride>>;
  aiReviews?: Readonly<Record<string, AiMarkerReview>>;
}

const WEIGHTED_EQUIPMENT_MAP: Readonly<Record<string, EquipmentType>> = {
  barbell: 'barbell',
  'smith machine': 'smith-machine',
  'smith-machine': 'smith-machine',
  dumbbell: 'dumbbell',
  dumbbells: 'dumbbell',
  cable: 'cable',
  plate: 'plate',
  machine: 'machine',
  kettlebell: 'kettlebell',
};

const REP_ZONES = [
  { key: 'heavy', label: 'Heavy', repRange: '5-6', minReps: 5, maxReps: 6 },
  { key: 'moderate', label: 'Moderate', repRange: '8-10', minReps: 8, maxReps: 10 },
  { key: 'volume', label: 'Volume', repRange: '12-15', minReps: 12, maxReps: 15 },
] as const;

/** Stable per-exercise key used across history aggregation and stated/AI overrides. */
export function exerciseMarkerKey(entry: { exerciseId?: string; exerciseName: string }): string {
  const raw = entry.exerciseId?.trim() || entry.exerciseName.trim();
  return raw.toLowerCase();
}

function toIsoDate(value: Date | string): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function toTimestamp(value: Date | string): number {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isCompletedWeightedSet(set: PerformedSet): boolean {
  return (
    set.completed === true &&
    Number.isFinite(set.weight) &&
    set.weight > 0 &&
    Number.isFinite(set.actualReps) &&
    set.actualReps > 0
  );
}

/**
 * Round a computed working weight to the real-world plate increment for its
 * equipment (`oneRepMax.roundToIncrement`), falling back to `WEIGHT_STEP`.
 */
export function roundMarkerWeight(
  weight: number,
  equipment: string,
  unit: 'lbs' | 'kg' = 'lbs',
): number {
  if (!Number.isFinite(weight) || weight <= 0) return 0;
  const normalized = equipment.trim().toLowerCase();
  const mapped = WEIGHTED_EQUIPMENT_MAP[normalized];
  if (mapped && unit === 'lbs') {
    return roundToIncrement(weight, mapped);
  }
  const step = unit === 'kg' ? WEIGHT_STEP / 2 : WEIGHT_STEP;
  return Math.round(weight / step) * step;
}

function buildWorkingZone(
  e1RM: number,
  zone: (typeof REP_ZONES)[number],
  equipment: string,
  unit: 'lbs' | 'kg',
): WorkingWeightRange {
  const midReps = (zone.minReps + zone.maxReps) / 2;
  const minWeight = roundMarkerWeight(loadForReps(e1RM, zone.maxReps), equipment, unit);
  const maxWeight = roundMarkerWeight(loadForReps(e1RM, zone.minReps), equipment, unit);
  const weight = roundMarkerWeight(loadForReps(e1RM, midReps), equipment, unit);
  return {
    label: zone.label,
    repRange: zone.repRange,
    minReps: zone.minReps,
    maxReps: zone.maxReps,
    weight,
    minWeight: Math.min(minWeight, maxWeight),
    maxWeight: Math.max(minWeight, maxWeight),
  };
}

/** Compute heavy (5-6), moderate (8-10), and volume (12-15) working weights for an e1RM. */
export function computeWorkingWeights(
  e1RM: number,
  equipment: string,
  unit: 'lbs' | 'kg' = 'lbs',
): StrengthMarker['workingWeights'] {
  return {
    heavy: buildWorkingZone(e1RM, REP_ZONES[0], equipment, unit),
    moderate: buildWorkingZone(e1RM, REP_ZONES[1], equipment, unit),
    volume: buildWorkingZone(e1RM, REP_ZONES[2], equipment, unit),
  };
}

/** Format a WorkingWeightRange as a compact label such as "195–200" or "195". */
export function formatWeightRange(range: WorkingWeightRange): string {
  return range.minWeight === range.maxWeight
    ? `${range.minWeight}`
    : `${range.minWeight}–${range.maxWeight}`;
}

function setE1RM(set: PerformedSet): number {
  const rir = set.rir !== undefined && Number.isFinite(set.rir) ? Math.max(0, set.rir) : 0;
  return effortAdjustedE1RM(set.weight, set.actualReps, rir);
}

/**
 * Compute base formula markers (no overrides applied) from exercise history.
 * Exercises with no completed weighted sets (e.g. bodyweight / timed) are skipped.
 */
export function computeBaseStrengthMarkers(
  history: ReadonlyArray<ExerciseHistory>,
): BaseStrengthMarker[] {
  const grouped = new Map<string, ExerciseHistory[]>();

  for (const entry of history) {
    const weightedSets = (entry.sets ?? []).filter(isCompletedWeightedSet);
    if (weightedSets.length === 0) continue;
    const key = exerciseMarkerKey(entry);
    if (!key) continue;
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      grouped.set(key, [entry]);
    }
  }

  const markers: BaseStrengthMarker[] = [];

  for (const [exerciseKey, entries] of grouped.entries()) {
    // Sort chronologically ascending so `smoothedSessions` takes the LAST 3 sessions.
    const sorted = [...entries].sort((a, b) => toTimestamp(a.workoutDate) - toTimestamp(b.workoutDate));
    const sessionSetLists: PerformedSet[][] = [];
    const sessionBests: SessionBestEntry[] = [];

    let bestSet: BestLoggedSet | null = null;
    let latestEntry = sorted[sorted.length - 1];
    let latestUnit: 'lbs' | 'kg' = 'lbs';

    for (const entry of sorted) {
      const weighted = entry.sets.filter(isCompletedWeightedSet);
      if (weighted.length === 0) continue;
      sessionSetLists.push(weighted);
      latestEntry = entry;

      let sessionBestSet = weighted[0];
      let sessionBestScore = setE1RM(weighted[0]);
      latestUnit = weighted[weighted.length - 1].unit || latestUnit;

      for (const s of weighted) {
        const score = setE1RM(s);
        if (
          score > sessionBestScore ||
          (score === sessionBestScore && s.weight > sessionBestSet.weight)
        ) {
          sessionBestSet = s;
          sessionBestScore = score;
        }
      }

      const isoDate = toIsoDate(entry.workoutDate);
      const rir =
        sessionBestSet.rir !== undefined && Number.isFinite(sessionBestSet.rir)
          ? Math.max(0, sessionBestSet.rir)
          : undefined;

      sessionBests.push({
        workoutDate: isoDate,
        weight: sessionBestSet.weight,
        reps: sessionBestSet.actualReps,
        ...(rir !== undefined ? { rir } : {}),
        e1RM: Math.round(sessionBestScore),
      });

      if (
        !bestSet ||
        sessionBestScore > bestSet.e1RM ||
        (sessionBestScore === bestSet.e1RM && sessionBestSet.weight > bestSet.weight)
      ) {
        bestSet = {
          weight: sessionBestSet.weight,
          reps: sessionBestSet.actualReps,
          ...(rir !== undefined ? { rir } : {}),
          unit: sessionBestSet.unit || 'lbs',
          e1RM: sessionBestScore,
          workoutDate: isoDate,
        };
      }
    }

    if (!bestSet || sessionSetLists.length === 0) continue;

    const smoothed = smoothedSessions(sessionSetLists, setE1RM, 3);
    if (smoothed === null || smoothed <= 0) continue;

    markers.push({
      exerciseKey,
      exerciseId: latestEntry.exerciseId,
      exerciseName: latestEntry.customTitle || latestEntry.exerciseName,
      equipment: latestEntry.equipment || 'Unknown',
      unit: latestUnit,
      bestSet: {
        ...bestSet,
        e1RM: Math.round(bestSet.e1RM),
      },
      bestE1RM: Math.round(bestSet.e1RM),
      formulaE1RM: Math.round(smoothed),
      rawFormulaE1RM: smoothed,
      sessionCount: sessionSetLists.length,
      sessionBests,
    });
  }

  return markers.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}

/**
 * Apply stated-max and Claude-review overrides onto computed base markers.
 * Precedence: stated > Claude-reviewed > formula estimate.
 */
export function applyMarkerOverrides(
  baseMarkers: ReadonlyArray<BaseStrengthMarker>,
  options: MarkerOverrideOptions = {},
): StrengthMarker[] {
  const statedMaxes = options.statedMaxes ?? {};
  const aiReviews = options.aiReviews ?? {};

  return baseMarkers.map((base) => {
    const stated = statedMaxes[base.exerciseKey];
    const ai = aiReviews[base.exerciseKey];

    let activeRawE1RM = base.rawFormulaE1RM;
    let e1RM = base.formulaE1RM;
    let source: StrengthMarkerSource = 'estimate';
    let note: string | undefined;

    if (stated && Number.isFinite(stated.weight) && stated.weight > 0) {
      activeRawE1RM = stated.weight;
      e1RM = Math.round(stated.weight);
      source = 'stated';
    } else if (ai && Number.isFinite(ai.e1RM) && ai.e1RM > 0) {
      activeRawE1RM = ai.e1RM;
      e1RM = Math.round(ai.e1RM);
      source = 'Claude-reviewed';
      note = ai.note || undefined;
    }

    return {
      ...base,
      e1RM,
      source,
      ...(note ? { note } : {}),
      workingWeights: computeWorkingWeights(activeRawE1RM, base.equipment, base.unit),
    };
  });
}

/** Compute full StrengthMarkers from exercise history and any stated / AI overrides. */
export function computeStrengthMarkers(
  history: ReadonlyArray<ExerciseHistory>,
  options: MarkerOverrideOptions = {},
): StrengthMarker[] {
  return applyMarkerOverrides(computeBaseStrengthMarkers(history), options);
}
