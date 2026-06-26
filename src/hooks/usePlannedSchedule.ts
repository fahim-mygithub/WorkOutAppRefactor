/**
 * UI facade over the Charlie-Split schedule: hydration + local-first persistence,
 * the COMPLETION-DRIVEN projection of planned days, autofill, and the actions the
 * calendar / wizard / player need. Planned days are recomputed from the
 * completion pointer (never stored), so carry-forward falls out for free.
 */
import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  templateActivated,
  monthFilled,
  dayOverrideSet,
  retestAdvanced,
} from '../store/slices/scheduleSlice';
import { slotType, cycleOrdinalForSlot, cycleIndexForSlot, cycleIndex } from '../lib/charlie/rotation';
import { CYCLE_LEN, variantLabel, type DayType, type OneRmKey } from '../lib/charlie/definition';
import { generateCharlieDay, accessoryRolesForDay, type GeneratedDay } from '../lib/charlie/generateDay';
import {
  toDateKey,
  addDaysKey,
  lastOfMonthKey,
  maxKey,
  type DateKey,
} from '../lib/dateKey';
import type { Exercise, WorkoutSet } from '../types/exercise';
import type {
  CharlieProgram,
  DayOverride,
  OneRepMax,
  PlannedDay,
  PlannedSlotPreview,
  PullupSeed,
  RetestLift,
  ScheduleState,
} from '../types/schedule';

const PROGRAM_ID = 'charlie-split';

/** Each retest lift's HEAVY session = (dayType, cycleIndex within that day's cycle). */
const RETEST_TARGET: Record<RetestLift, { dayType: DayType; cycleIndex: number }> = {
  'bb-bench': { dayType: 'push', cycleIndex: 1 },
  'db-bench': { dayType: 'push', cycleIndex: 2 },
  'seal-row': { dayType: 'pull', cycleIndex: 1 },
  pullup: { dayType: 'pull', cycleIndex: 2 },
  'back-squat': { dayType: 'legs', cycleIndex: 0 },
  'front-squat': { dayType: 'legs', cycleIndex: 4 },
  deadlift: { dayType: 'legs', cycleIndex: 2 },
};

function oneRmMap(oneRepMax: ScheduleState['oneRepMax']): Partial<Record<OneRmKey, number>> {
  const out: Partial<Record<OneRmKey, number>> = {};
  (Object.entries(oneRepMax) as Array<[OneRmKey, OneRepMax | undefined]>).forEach(([k, v]) => {
    if (v && v.value > 0) out[k] = v.value;
  });
  return out;
}

function schemeString(sets: WorkoutSet[]): string {
  const n = sets.length;
  const s0 = sets[0];
  if (!s0) return '';
  if (s0.time != null) return `${n} × ${s0.time}s`;
  return `${n} × ${s0.reps}`;
}

function previewFromGenerated(gen: GeneratedDay): PlannedSlotPreview[] {
  return gen.exercises.map((ex, i) => {
    const w = ex.sets[0]?.weight;
    return {
      kind: i === 0 ? 'compound' : 'accessory',
      title: ex.customTitle || ex.exercise.name,
      equipment: ex.exercise.equipment,
      scheme: schemeString(ex.sets),
      targetWeight: w && w > 0 ? w : undefined,
      isBodyweight: !w,
      supersetId: ex.supersetId,
    };
  });
}

export interface ActivateArgs {
  oneRepMax: Partial<Record<OneRmKey, OneRepMax>>;
  pullup: PullupSeed | null;
}

export interface UsePlannedSchedule {
  plannedByDate: Map<DateKey, PlannedDay>;
  hasActivePlan: boolean;
  isReady: boolean;
  getPlannedDay: (date: Date) => PlannedDay | null;
  activateCharlieSplit: (args: ActivateArgs) => void;
  autofillMonth: (monthDate: Date) => void;
  markCompleted: (
    dateKey: DateKey,
    summaryId: string,
    dayType: DayType,
    cycleOrdinal: number,
    picks?: Record<string, string>,
  ) => void;
  /** Build the full launch-ready workout for a planned date (uses the real catalog). */
  generatePlannedWorkout: (dateKey: DateKey, catalog: Exercise[]) => GeneratedDay | null;
  /** Re-randomize a planned day's accessory picks (persisted as a picks override). */
  rerollAccessories: (dateKey: DateKey) => void;
}

export function usePlannedSchedule(): UsePlannedSchedule {
  const dispatch = useAppDispatch();
  const schedule = useAppSelector((s) => s.schedule);

  const { program, overrides, filledThroughKey, pullup, status, retest } = schedule;
  const oneRm = useMemo(() => oneRmMap(schedule.oneRepMax), [schedule.oneRepMax]);

  // Hydration + local-first persistence run ONCE in useScheduleSync (mounted in
  // the app shell) — NOT here — so the many usePlannedSchedule consumers on a
  // page can't race each other's debounced saves and clobber good data.

  // ---- completion-driven projection ----
  const plannedByDate = useMemo(() => {
    const map = new Map<DateKey, PlannedDay>();
    if (!program) return map;
    const todayKey = toDateKey(new Date());
    const horizon = filledThroughKey ?? todayKey;
    const completedCount = Object.values(overrides).filter((o) => o.status === 'completed').length;

    // Rotating 1RM retest: mark the due lift's next eligible heavy session.
    const dueLift: RetestLift | undefined = retest.rotation[retest.nextIndex];
    const dueTarget = dueLift ? RETEST_TARGET[dueLift] : undefined;
    const eligibleFromKey = retest.lastTestedAtKey
      ? addDaysKey(retest.lastTestedAtKey, retest.everyDays)
      : todayKey;
    let retestMarked = false;

    let slot = completedCount;
    let dk = todayKey;
    let guard = 0;
    while (dk <= horizon && guard < 400) {
      guard++;
      const ov = overrides[dk];
      if (ov?.status === 'completed') {
        const dt = ov.dayType ?? 'push';
        const ci = ov.cycleOrdinal != null ? cycleIndex(ov.cycleOrdinal, CYCLE_LEN[dt]) : 0;
        map.set(dk, {
          dateKey: dk,
          templateId: 'charlie-split',
          dayType: dt,
          cycleIndex: ci,
          cycleOrdinal: ov.cycleOrdinal ?? 0,
          variantLabel: variantLabel(dt, ci),
          status: 'completed',
          preview: [],
        });
        dk = addDaysKey(dk, 1);
        continue;
      }
      if (ov?.status === 'skipped') {
        const dt = ov.dayType ?? slotType(program.startRotation, slot);
        map.set(dk, {
          dateKey: dk,
          templateId: 'charlie-split',
          dayType: dt,
          cycleIndex: 0,
          cycleOrdinal: 0,
          variantLabel: '',
          status: 'skipped',
          preview: [],
        });
        dk = addDaysKey(dk, 1);
        continue; // skipped does NOT consume a slot (carry-forward)
      }
      const dayType = slotType(program.startRotation, slot);
      const cycleOrdinal = cycleOrdinalForSlot(slot);
      const ci = cycleIndexForSlot(dayType, slot);
      const isRetest =
        !retestMarked &&
        dueTarget != null &&
        dayType === dueTarget.dayType &&
        ci === dueTarget.cycleIndex &&
        dk >= eligibleFromKey;
      if (isRetest) retestMarked = true;
      const gen = generateCharlieDay({
        programId: PROGRAM_ID,
        dayType,
        cycleIndex: ci,
        cycleOrdinal,
        oneRepMax: oneRm,
        pullup: pullup ?? undefined,
        overridePicks: ov?.picks,
      });
      map.set(dk, {
        dateKey: dk,
        templateId: 'charlie-split',
        dayType,
        cycleIndex: ci,
        cycleOrdinal,
        variantLabel: gen.variantLabel,
        status: 'planned',
        isRetest: isRetest || undefined,
        retestLift: isRetest ? dueLift : undefined,
        preview: previewFromGenerated(gen),
      });
      slot++;
      dk = addDaysKey(dk, 1);
    }
    return map;
  }, [program, overrides, filledThroughKey, oneRm, pullup, retest]);

  const hasActivePlan = program != null;
  const isReady = status === 'ready';

  const getPlannedDay = useCallback(
    (date: Date) => plannedByDate.get(toDateKey(date)) ?? null,
    [plannedByDate],
  );

  const activateCharlieSplit = useCallback(
    (args: ActivateArgs) => {
      const todayKey = toDateKey(new Date());
      const newProgram: CharlieProgram = {
        templateId: 'charlie-split',
        startedAtKey: todayKey,
        startRotation: 0,
        startPushCycle: 0,
      };
      dispatch(templateActivated({ program: newProgram, oneRepMax: args.oneRepMax, pullup: args.pullup }));
    },
    [dispatch],
  );

  const autofillMonth = useCallback(
    (monthDate: Date) => {
      // No `program` guard: this is called immediately after activateCharlieSplit
      // (whose dispatch hasn't re-rendered this closure yet). Setting the watermark
      // is harmless without a program — the projection itself guards on `program`.
      const todayKey = toDateKey(new Date());
      const end = lastOfMonthKey(monthDate);
      if (end < todayKey) return; // entirely-past month → no-op
      dispatch(monthFilled({ filledThroughKey: maxKey(filledThroughKey, end) }));
    },
    [filledThroughKey, dispatch],
  );

  const markCompleted = useCallback<UsePlannedSchedule['markCompleted']>(
    (dateKey, summaryId, dayType, cycleOrdinal, picks) => {
      const override: DayOverride = {
        dateKey,
        status: 'completed',
        dayType,
        cycleOrdinal,
        completedSummaryId: summaryId,
        picks,
        updatedAt: new Date().toISOString(),
      };
      dispatch(dayOverrideSet(override));
      // Advance the rotating retest pointer if this day was a retest of the due lift.
      const retest = schedule.retest;
      if (retest.lastTestedAtKey !== dateKey) {
        // (Retest gating handled in Phase 8; pointer advance is a no-op until then.)
      }
    },
    [dispatch, schedule.retest],
  );

  const generatePlannedWorkout = useCallback<UsePlannedSchedule['generatePlannedWorkout']>(
    (dateKey, catalog) => {
      const pd = plannedByDate.get(dateKey);
      if (!pd || pd.status === 'completed') return null;
      const byId = new Map(catalog.map((e) => [e.id, e]));
      const resolve = (opt: { id: string; name: string; equipment: string }): Exercise =>
        byId.get(opt.id) ?? {
          id: opt.id,
          name: opt.name,
          muscleGroup: '',
          muscleGroups: [],
          equipment: opt.equipment,
          videoLinks: [],
          instructions: [],
          difficulty: 'Intermediate',
          force: null,
          grips: null,
          mechanic: null,
          searchKeywords: [opt.name.toLowerCase()],
          createdAt: '',
          updatedAt: '',
        };
      return generateCharlieDay({
        programId: PROGRAM_ID,
        dayType: pd.dayType,
        cycleIndex: pd.cycleIndex,
        cycleOrdinal: pd.cycleOrdinal,
        oneRepMax: oneRm,
        pullup: pullup ?? undefined,
        overridePicks: overrides[dateKey]?.picks,
        resolveExercise: resolve,
      });
    },
    [plannedByDate, oneRm, pullup, overrides],
  );

  const rerollAccessories = useCallback(
    (dateKey: DateKey) => {
      const pd = plannedByDate.get(dateKey);
      if (!pd || pd.status === 'completed') return;
      const roles = accessoryRolesForDay(pd.dayType, pd.cycleIndex);
      const current = overrides[dateKey]?.picks ?? {};
      const picks: Record<string, string> = {};
      for (const { roleKey, pool } of roles) {
        if (pool.length === 0) continue;
        const avoid = current[roleKey];
        const candidates = avoid ? pool.filter((o) => o.exerciseId !== avoid) : pool;
        const list = candidates.length > 0 ? candidates : pool;
        picks[roleKey] = list[Math.floor(Math.random() * list.length)].exerciseId;
      }
      dispatch(
        dayOverrideSet({
          dateKey,
          status: 'planned',
          dayType: pd.dayType,
          cycleOrdinal: pd.cycleOrdinal,
          picks,
          updatedAt: new Date().toISOString(),
        }),
      );
    },
    [plannedByDate, overrides, dispatch],
  );

  // retestAdvanced is dispatched by WorkoutPage on retest completion.
  void retestAdvanced;

  return {
    plannedByDate,
    hasActivePlan,
    isReady,
    getPlannedDay,
    activateCharlieSplit,
    autofillMonth,
    markCompleted,
    generatePlannedWorkout,
    rerollAccessories,
  };
}
