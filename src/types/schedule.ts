/**
 * Types for the Charlie-Split planned-schedule layer. The store persists only a
 * tiny durable kernel (program, 1RMs, watermark, sparse overrides, retest state);
 * planned days are RECOMPUTED on demand from the completion pointer (see
 * usePlannedSchedule), never stored fat.
 */
import type { DateKey } from '../lib/dateKey';
import type { DayType, OneRmKey } from '../lib/charlie/definition';

export type { DateKey } from '../lib/dateKey';
export type PlannedStatus = 'planned' | 'completed' | 'skipped';
export type RetestLift = OneRmKey | 'pullup';

export interface OneRepMax {
  key: OneRmKey;
  value: number;
  unit: 'lbs';
  source: 'entered' | 'progressed';
  enteredAt: string; // ISO
  updatedAt: string; // ISO
}

/** Weighted pull-up capability (no 1RM key — progresses via added load). */
export interface PullupSeed {
  heavyAddedLoad: number; // lbs added at ~5 reps
  volumeAddedLoad: number; // lbs added for 10–15 (often 0 = bodyweight)
  bodyweight: number; // for trainable-1RM netting on retest
  updatedAt: string;
}

/** Completion-driven source of truth: where the program began. */
export interface CharlieProgram {
  templateId: 'charlie-split';
  startedAtKey: DateKey;
  startRotation: number; // rotation index of slot 0 (0 = push)
  startPushCycle: number; // reserved; v1 = 0
}

/** The only per-day records we persist (sparse). Planned days need no record
 *  unless rerolled/edited (status 'planned' carries picks but stays projected). */
export interface DayOverride {
  dateKey: DateKey;
  status: PlannedStatus;
  slotOrdinal?: number;
  dayType?: DayType;
  cycleOrdinal?: number;
  completedSummaryId?: string;
  picks?: Record<string, string>; // roleKey -> chosen exerciseId
  updatedAt: string;
}

/** Lightweight row the calendar/modal render without hydrating a full workout. */
export interface PlannedSlotPreview {
  kind: 'compound' | 'accessory';
  title: string;
  equipment?: string;
  scheme: string; // "4 × 3-5" / "4 × 10-15" / "3 × 30s"
  targetWeight?: number; // projected working weight (lbs); undefined = bodyweight
  isBodyweight?: boolean;
  supersetId?: string;
}

export interface PlannedDay {
  dateKey: DateKey;
  templateId: 'charlie-split';
  dayType: DayType;
  cycleIndex: number;
  cycleOrdinal: number;
  variantLabel: string;
  status: PlannedStatus;
  isRetest?: boolean;
  retestLift?: RetestLift;
  preview: PlannedSlotPreview[];
}

/** Rotating 1RM-retest schedule (~2×/month, one lift per test day). */
export interface RetestState {
  rotation: RetestLift[];
  everyDays: number; // ~14
  lastTestedAtKey: DateKey | null;
  nextIndex: number;
}

export interface ScheduleState {
  program: CharlieProgram | null;
  oneRepMax: Partial<Record<OneRmKey, OneRepMax>>;
  pullup: PullupSeed | null;
  overrides: Record<DateKey, DayOverride>;
  filledThroughKey: DateKey | null;
  retest: RetestState;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  lastSyncedAt: string | null;
}

/** Subset persisted to localStorage / Firestore (status & error are transient). */
export type PersistedSchedule = Pick<
  ScheduleState,
  'program' | 'oneRepMax' | 'pullup' | 'overrides' | 'filledThroughKey' | 'retest'
> & { schemaVersion: number };
