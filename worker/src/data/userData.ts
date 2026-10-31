/**
 * One signed-in user's data. The service account bypasses Firestore security
 * rules, so this class IS the access rule: every path starts with
 * `users/{uid}` where uid comes from the verified OAuth grant, and document
 * ids from tool input must look like Firestore auto-ids (no `/`, no `..`).
 */
import { docId, FirestoreError, type FirestoreRest, type FsDocument } from './firestore';
import { fromFields, toFields } from './firestoreValue';
import type { QueryFilter } from './firestore';
import {
  resolveExercise,
  matchExerciseInList,
  matchCustomExercise,
  getCachedLibrary,
  searchExerciseIndex,
  type CustomExerciseLike,
  type HistoryExerciseLike,
} from './exerciseIndex';
import {
  isMediaSizeAllowed,
  maxBytesForKind,
  sniffMediaType,
} from '../media/sniff';
import { generateMediaId } from '../media/storage';
import { createUploadToken } from '../media/uploadToken';
import type { UpdateExerciseInput } from './shapes';
import {
  buildCustomExerciseDoc,
  buildExerciseHistoryDoc,
  buildPlan,
  buildPlansDoc,
  buildProfileUpdate,
  buildSavedWorkoutDoc,
  buildWorkoutHistoryDoc,
  buildWorkoutUpdate,
  checkPersonalRecords,
  computeExerciseStats,
  generateConfigurationString,
  isFutureDate,
  mergePlan,
  readExerciseHistory,
  readPlans,
  readProfile,
  readSavedWorkout,
  readWorkoutSummary,
  toParsedWorkout,
  toWorkoutExercises,
  updateExerciseStatsDoc,
  type CustomExerciseInput,
  type ExerciseInput,
  type LogWorkoutInput,
  type ParsedWorkout,
  type PerformedSetInput,
  type PlannedWorkout,
  type ProfilePatch,
  type RawExerciseHistory,
  type StoredPerformedSet,
  type UpdateHistoryEntryInput,
  type WorkoutInput,
  type WorkoutPatch,
} from './shapes';

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

export class DataError extends Error {
  constructor(
    public readonly code: 'not-found' | 'invalid-argument' | 'conflict',
    message: string,
  ) {
    super(message);
    this.name = 'DataError';
  }
}

export interface ExerciseMatchInfo {
  id: string;
  name: string;
  isCustom: boolean;
  muscleGroups?: string[];
  equipment?: string;
  [key: string]: unknown;
}

export class DuplicateExerciseError extends DataError {
  constructor(public readonly match: ExerciseMatchInfo) {
    super(
      'conflict',
      `Exercise "${match.name}" already exists as a ${match.isCustom ? 'custom' : 'library'} exercise.`,
    );
    this.name = 'DuplicateExerciseError';
  }
}

export interface UserDataOptions {
  now?: () => Date;
  newId?: () => string;
  r2?: R2Bucket;
  kv?: KVNamespace;
  origin?: string;
  fetchImpl?: typeof fetch;
}

function safeId(id: string, what: string): string {
  if (!SAFE_ID.test(id)) throw new DataError('invalid-argument', `Invalid ${what} id.`);
  return id;
}

export interface Page<T> { items: T[]; nextPageToken?: string }

function offsetFrom(token: string | undefined): number {
  if (!token) return 0;
  const n = Number(token);
  if (!Number.isSafeInteger(n) || n < 0) throw new DataError('invalid-argument', 'Invalid pageToken.');
  return n;
}

const data = (doc: FsDocument) => fromFields(doc.fields ?? {});

function parseCustomExercises(docs: FsDocument[]): (CustomExerciseLike & { videoLinks?: string[] })[] {
  return docs.map((d) => {
    const docData = data(d);
    return {
      id: docId(d),
      name: String(docData.name ?? ''),
      muscleGroups: Array.isArray(docData.muscleGroups) ? (docData.muscleGroups as string[]) : undefined,
      muscleGroup: typeof docData.muscleGroup === 'string' ? docData.muscleGroup : undefined,
      equipment: typeof docData.equipment === 'string' ? docData.equipment : undefined,
      searchKeywords: Array.isArray(docData.searchKeywords) ? (docData.searchKeywords as string[]) : undefined,
      videoLinks: Array.isArray(docData.videoLinks) ? (docData.videoLinks as string[]) : undefined,
    };
  });
}

export interface PlanRequest {
  dateKey: string;
  name?: string;
  workoutId?: string;
  exercises?: ExerciseInput[];
  supersets?: ExerciseInput[][];
  planId?: string;
}

const PLAN_WRITE_ATTEMPTS = 4;

export class UserData {
  readonly uid: string;
  readonly now: () => Date;
  readonly newId: () => string;
  readonly options: UserDataOptions;

  constructor(
    private readonly fs: FirestoreRest,
    uid: string,
    nowOrOptions?: (() => Date) | UserDataOptions,
    newId?: () => string,
    options?: UserDataOptions,
  ) {
    this.uid = safeId(uid, 'user');
    if (typeof nowOrOptions === 'object' && nowOrOptions !== null) {
      this.options = nowOrOptions;
      this.now = nowOrOptions.now ?? (() => new Date());
      this.newId = nowOrOptions.newId ?? (() => crypto.randomUUID());
    } else {
      this.now = typeof nowOrOptions === 'function' ? nowOrOptions : () => new Date();
      this.newId = newId ?? (() => crypto.randomUUID());
      this.options = options ?? {};
    }
  }

  private path(...rest: string[]): string[] {
    return ['users', this.uid, ...rest];
  }

  async getProfile() {
    const doc = await this.fs.get(this.path());
    return readProfile(doc ? data(doc) : null);
  }

  async updateProfile(patch: ProfilePatch) {
    const { data: fields, mask } = buildProfileUpdate(patch, this.now());
    try {
      await this.fs.patch(this.path(), toFields(fields), { mask, exists: true });
    } catch (err) {
      if (err instanceof FirestoreError && err.status === 404) {
        throw new DataError('not-found', 'No profile yet: sign in to the app once first.');
      }
      throw err;
    }
    return this.getProfile();
  }

  async listWorkouts(opts: { pageSize: number; pageToken?: string }): Promise<Page<Record<string, unknown>>> {
    const offset = offsetFrom(opts.pageToken);
    const docs = await this.fs.query(this.path(), 'savedWorkouts', {
      orderBy: 'updatedAt',
      direction: 'DESCENDING',
      limit: opts.pageSize,
      offset,
    });
    const items = docs.map((doc) => {
      const w = readSavedWorkout(docId(doc), data(doc));
      return {
        id: w.id,
        name: w.name,
        ...(w.description ? { description: w.description } : {}),
        exerciseCount: w.exercises.length + w.supersets.flat().length,
        exerciseNames: [...w.exercises, ...w.supersets.flat()].map((e) => e.name),
        tags: w.tags,
        updatedAt: w.updatedAt,
        lastPerformedAt: w.lastPerformedAt,
      };
    });
    return { items, ...(docs.length === opts.pageSize ? { nextPageToken: String(offset + docs.length) } : {}) };
  }

  async getWorkout(id: string) {
    const doc = await this.fs.get(this.path('savedWorkouts', safeId(id, 'workout')));
    if (!doc) throw new DataError('not-found', `No saved workout with id ${id}.`);
    return readSavedWorkout(docId(doc), data(doc));
  }

  /** Saves each workout as its own document; returns ids in input order. */
  async createWorkouts(inputs: WorkoutInput[]): Promise<{ id: string; name: string }[]> {
    const created: { id: string; name: string }[] = [];
    for (const input of inputs) {
      const doc = await this.fs.create(
        this.path('savedWorkouts'),
        toFields(buildSavedWorkoutDoc(this.uid, input, this.now())),
      );
      created.push({ id: docId(doc), name: input.name.trim() });
    }
    return created;
  }

  async updateWorkout(id: string, patch: WorkoutPatch) {
    const current = await this.getWorkout(id);
    const { data: fields, mask } = buildWorkoutUpdate(patch, { exercises: current.exercises, supersets: current.supersets }, this.now());
    await this.fs.patch(this.path('savedWorkouts', safeId(id, 'workout')), toFields(fields), { mask, exists: true });
    return this.getWorkout(id);
  }

  async listPlans(range: { from?: string; to?: string } = {}) {
    const doc = await this.fs.get(this.path('schedule', 'plannedWorkouts'));
    return readPlans(doc ? data(doc) : null)
      .filter((p) => (!range.from || p.dateKey >= range.from) && (!range.to || p.dateKey <= range.to))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }

  /**
   * Adds (or, with planId, replaces) one plan in the plans document. The write
   * is conditional on the document's updateTime, so a concurrent write from
   * the phone makes us re-read and merge again instead of overwriting it.
   */
  async planWorkout(req: PlanRequest): Promise<PlannedWorkout> {
    let name = req.name?.trim();
    let parsed: ParsedWorkout;
    if (req.workoutId) {
      const saved = await this.getWorkout(req.workoutId);
      parsed = { exercises: saved.exercises, supersets: saved.supersets };
      name = name || saved.name;
    } else if (req.exercises?.length || req.supersets?.length) {
      parsed = toParsedWorkout({ exercises: req.exercises ?? [], supersets: req.supersets });
    } else {
      throw new DataError('invalid-argument', 'Give a saved workoutId or a list of exercises.');
    }
    if (!name) throw new DataError('invalid-argument', 'Give the planned workout a name.');
    const planId = req.planId ? safeId(req.planId, 'plan') : this.newId();
    const path = this.path('schedule', 'plannedWorkouts');

    for (let attempt = 0; attempt < PLAN_WRITE_ATTEMPTS; attempt++) {
      const doc = await this.fs.get(path);
      const plans = readPlans(doc ? data(doc) : null);
      const existing = plans.find((p) => p.id === planId);
      if (req.planId && !existing) throw new DataError('not-found', `No plan with id ${req.planId}.`);
      const nowIso = this.now().toISOString();
      const plan = buildPlan(
        {
          id: planId,
          dateKey: req.dateKey,
          name,
          exercises: toWorkoutExercises(parsed, nowIso, `${Date.parse(nowIso)}-${planId.slice(0, 8)}`),
          createdAt: existing?.createdAt,
        },
        nowIso,
      );
      const fields = toFields(buildPlansDoc(mergePlan(plans, plan), nowIso));
      try {
        await this.fs.patch(path, fields, doc?.updateTime ? { updateTime: doc.updateTime } : { exists: false });
        return plan;
      } catch (err) {
        if (err instanceof FirestoreError && err.isConflict) continue;
        throw err;
      }
    }
    throw new DataError('conflict', 'The schedule kept changing while saving; try again.');
  }

  async listHistory(opts: {
    kind: 'workouts' | 'exercises';
    pageSize: number;
    pageToken?: string;
    cursor?: string;
    from?: string;
    to?: string;
  }) {
    const token = opts.cursor ?? opts.pageToken;
    const offset = offsetFrom(token);
    const workouts = opts.kind === 'workouts';
    const dateField = workouts ? 'endTime' : 'workoutDate';
    const filters: QueryFilter[] = [];
    if (opts.from) {
      filters.push({
        field: dateField,
        op: 'GREATER_THAN_OR_EQUAL',
        value: { timestampValue: `${opts.from}T00:00:00.000Z` },
      });
    }
    if (opts.to) {
      filters.push({
        field: dateField,
        op: 'LESS_THAN_OR_EQUAL',
        value: { timestampValue: `${opts.to}T23:59:59.999Z` },
      });
    }

    const docs = await this.fs.query(this.path(), workouts ? 'workout_history' : 'exercise_history', {
      orderBy: dateField,
      direction: 'DESCENDING',
      limit: opts.pageSize,
      offset,
      ...(filters.length ? { filters } : {}),
    });
    const items = docs.map((doc) =>
      workouts ? readWorkoutSummary(docId(doc), data(doc)) : readExerciseHistory(docId(doc), data(doc)),
    );
    const hasMore = docs.length === opts.pageSize;
    const nextToken = hasMore ? String(offset + docs.length) : undefined;
    return {
      items,
      ...(nextToken ? { nextPageToken: nextToken, nextCursor: nextToken } : {}),
    };
  }

  async getHistoryEntry(workoutId: string) {
    const id = safeId(workoutId, 'workout history');
    const doc = await this.fs.get(this.path('workout_history', id));
    if (!doc) throw new DataError('not-found', `No workout history entry with id ${id}.`);
    const summary = readWorkoutSummary(docId(doc), data(doc));
    const linkedWorkoutId = (data(doc).workoutId as string) || id;

    // Do NOT orderBy in the query to avoid composite index requirements in Firestore; sort in memory instead.
    const exDocs = await this.fs.query(this.path(), 'exercise_history', {
      filters: [{ field: 'workoutId', op: 'EQUAL', value: { stringValue: linkedWorkoutId } }],
    });

    let allExDocs = exDocs;
    if (linkedWorkoutId !== id) {
      const extraDocs = await this.fs.query(this.path(), 'exercise_history', {
        filters: [{ field: 'workoutId', op: 'EQUAL', value: { stringValue: id } }],
      });
      const seen = new Set(allExDocs.map((d) => docId(d)));
      for (const d of extraDocs) {
        if (!seen.has(docId(d))) allExDocs.push(d);
      }
    }

    const summaryList = Array.isArray(data(doc).exercisesSummary)
      ? (data(doc).exercisesSummary as Array<Record<string, unknown>>)
      : [];

    const usedIndices = new Set<number>();
    const docOrder = new Map<string, number>();

    for (const d of allExDocs) {
      const dData = data(d);
      const exId = String(dData.exerciseId ?? '');
      const exName = String(dData.exerciseName ?? '');
      let matchIdx = summaryList.findIndex(
        (s, idx) => !usedIndices.has(idx) && (s.exerciseId === exId || s.exerciseName === exName),
      );
      if (matchIdx === -1) {
        matchIdx = summaryList.findIndex((_s, idx) => !usedIndices.has(idx));
      }
      if (matchIdx >= 0) {
        usedIndices.add(matchIdx);
        docOrder.set(docId(d), matchIdx);
      } else {
        docOrder.set(docId(d), 999999);
      }
    }

    allExDocs.sort((a, b) => {
      const idxA = docOrder.get(docId(a)) ?? 999999;
      const idxB = docOrder.get(docId(b)) ?? 999999;
      if (idxA !== idxB) return idxA - idxB;
      const timeA = String(a.createTime ?? data(a).createdAt ?? '');
      const timeB = String(b.createTime ?? data(b).createdAt ?? '');
      return timeA.localeCompare(timeB);
    });

    const exercises = allExDocs.map((d) => {
      const dData = data(d);
      return {
        id: docId(d),
        exerciseId: String(dData.exerciseId ?? ''),
        exerciseName: String(dData.exerciseName ?? ''),
        configuration: String(dData.configuration ?? ''),
        totalVolume: typeof dData.totalVolume === 'number' ? dData.totalVolume : 0,
        sets: Array.isArray(dData.sets) ? (dData.sets as StoredPerformedSet[]) : [],
        muscleGroups: Array.isArray(dData.muscleGroups) ? (dData.muscleGroups as string[]) : ['Unknown'],
        equipment: String(dData.equipment ?? 'Unknown'),
        ...(dData.notes ? { notes: String(dData.notes) } : {}),
        ...(dData.customTitle ? { customTitle: String(dData.customTitle) } : {}),
        ...(dData.personalRecords ? { personalRecords: dData.personalRecords as Record<string, unknown> } : {}),
      };
    });

    return {
      ...summary,
      exercises,
    };
  }

  async loadHistoryExercises(): Promise<HistoryExerciseLike[]> {
    const [historyDocs, statsDocs] = await Promise.all([
      this.fs.query(this.path(), 'exercise_history', {}),
      this.fs.query(this.path(), 'exercise_stats', {}),
    ]);

    const result: HistoryExerciseLike[] = [];

    for (const doc of historyDocs) {
      const d = data(doc);
      const exerciseId = (d.exerciseId as string) || docId(doc);
      const exerciseName = (d.exerciseName as string) || '';
      if (!exerciseId || !exerciseName) continue;
      result.push({
        exerciseId,
        exerciseName,
        workoutDate: d.workoutDate ? new Date(d.workoutDate as string | Date) : undefined,
        muscleGroups: Array.isArray(d.muscleGroups) ? (d.muscleGroups as string[]) : undefined,
        equipment: d.equipment ? String(d.equipment) : undefined,
      });
    }

    for (const doc of statsDocs) {
      const d = data(doc);
      const exerciseId = (d.exerciseId as string) || docId(doc);
      const exerciseName = (d.exerciseName as string) || '';
      if (!exerciseId || !exerciseName) continue;
      const dateVal = d.lastPerformed || d.updatedAt || d.firstPerformed;
      result.push({
        exerciseId,
        exerciseName,
        workoutDate: dateVal ? new Date(dateVal as string | Date) : undefined,
      });
    }

    return result;
  }

  async logWorkout(input: LogWorkoutInput) {
    if (isFutureDate(input.date, this.now(), input.tz, input.utcOffset)) {
      throw new DataError('invalid-argument', 'Cannot log a workout in the future.');
    }
    if (!input.exercises || input.exercises.length === 0) {
      throw new DataError('invalid-argument', 'Workout must have at least one exercise.');
    }
    for (const e of input.exercises) {
      const exIdentifier = e.name || e.id || 'Exercise';
      if (!e.sets || e.sets.length === 0) {
        throw new DataError('invalid-argument', `Exercise "${exIdentifier}" must have at least one set.`);
      }
      const completed = e.sets.filter((s) => s.completed !== false);
      if (completed.length === 0) {
        throw new DataError('invalid-argument', `Exercise "${exIdentifier}" must have at least one completed set.`);
      }
    }

    // Resolve exercise names/ids against user's history/stats, custom exercises and the app library
    const [historyExercises, customDocs] = await Promise.all([
      this.loadHistoryExercises(),
      this.fs.query(this.path(), 'customExercises', {}),
    ]);
    const customExercises = parseCustomExercises(customDocs);
    const resolvedExercises = input.exercises.map((e) => {
      if (e.id) {
        const custom = customExercises.find((c) => c.id === e.id);
        if (custom) {
          const muscleGroups =
            custom.muscleGroups && custom.muscleGroups.length > 0
              ? custom.muscleGroups
              : custom.muscleGroup
                ? custom.muscleGroup.split(',').map((s) => s.trim()).filter(Boolean)
                : ['Custom'];
          return {
            id: custom.id,
            name: e.name || custom.name,
            matchedName: custom.name,
            muscleGroups,
            equipment: custom.equipment || 'Custom',
            isFallback: false,
            matchedBy: 'custom' as const,
          };
        }
        const lib = getCachedLibrary().find((l) => l.id === e.id);
        if (lib) {
          return {
            id: lib.id,
            name: e.name || lib.name,
            matchedName: lib.name,
            muscleGroups: lib.muscleGroups && lib.muscleGroups.length > 0 ? lib.muscleGroups : ['Unknown'],
            equipment: lib.equipment || 'Unknown',
            isFallback: false,
            matchedBy: 'library' as const,
          };
        }
      }
      return resolveExercise(e.name || e.id || 'Exercise', customExercises, undefined, historyExercises);
    });

    const now = this.now();
    const workoutDate = new Date(`${input.date}T12:00:00.000Z`);
    const workoutName = input.name?.trim() || 'Workout';

    // 1. Create the workout_history summary document with its generated ID upfront in ONE write
    const workoutId = this.newId();
    const initialSummary = buildWorkoutHistoryDoc(this.uid, workoutId, input, now, resolvedExercises);
    await this.fs.create(this.path('workout_history'), toFields(initialSummary), workoutId);

    // 2. Create an exercise_history document for each exercise and update exercise_stats
    for (let i = 0; i < input.exercises.length; i++) {
      const e = input.exercises[i];
      const resolved = resolvedExercises[i];
      const exerciseId = resolved.id;
      const statsDoc = await this.fs.get(this.path('exercise_stats', exerciseId));
      const currentStats = statsDoc ? data(statsDoc) : null;

      const completedSets: StoredPerformedSet[] = e.sets
        .filter((s) => s.completed !== false)
        .map((s, idx) => ({
          setNumber: idx + 1,
          targetReps: s.reps,
          actualReps: s.reps,
          weight: s.weight ?? 0,
          unit: s.unit ?? 'lbs',
          completed: true,
          ...(s.rpe !== undefined ? { rpe: s.rpe } : {}),
          ...(s.time !== undefined ? { time: s.time } : {}),
          ...(s.rir !== undefined ? { rir: s.rir } : {}),
          ...(s.notes?.trim() ? { notes: s.notes.trim() } : {}),
        }));

      const totalVolume = completedSets.reduce((sum, s) => sum + s.weight * s.actualReps, 0);
      const prs = checkPersonalRecords(currentStats, completedSets, totalVolume);

      const exDocFields = buildExerciseHistoryDoc(this.uid, workoutId, workoutName, workoutDate, e, prs, now, resolved);
      await this.fs.create(this.path('exercise_history'), toFields(exDocFields));

      const nextStats = updateExerciseStatsDoc(
        exerciseId,
        resolved.matchedName,
        currentStats,
        completedSets,
        totalVolume,
        prs,
        workoutDate,
      );
      await this.fs.patch(this.path('exercise_stats', exerciseId), toFields(nextStats));
    }

    const entry = await this.getHistoryEntry(workoutId);
    const unmatched = resolvedExercises.filter((r) => r.isFallback).map((r) => r.name);
    return {
      ...entry,
      ...(unmatched.length > 0
        ? {
            unmatchedExercises: unmatched,
            fallbackNotice: `Unmatched exercise(s) [${unmatched.join(', ')}] were saved with fallback IDs and Unknown muscle groups. Use add_exercise to add them to your custom library.`,
          }
        : {}),
    };
  }

  async updateHistoryEntry(input: UpdateHistoryEntryInput) {
    const workoutId = safeId(input.workoutId, 'workout history');
    const workoutDoc = await this.fs.get(this.path('workout_history', workoutId));
    if (!workoutDoc) throw new DataError('not-found', `No workout history entry with id ${workoutId}.`);
    const currentWorkout = data(workoutDoc);

    if (input.date) {
      if (isFutureDate(input.date, this.now(), input.tz, input.utcOffset)) {
        throw new DataError('invalid-argument', 'Cannot log a workout in the future.');
      }
    }

    const linkedWorkoutId = (currentWorkout.workoutId as string) || workoutId;
    let existingDocs = await this.fs.query(this.path(), 'exercise_history', {
      filters: [{ field: 'workoutId', op: 'EQUAL', value: { stringValue: linkedWorkoutId } }],
    });
    if (linkedWorkoutId !== workoutId) {
      const extraDocs = await this.fs.query(this.path(), 'exercise_history', {
        filters: [{ field: 'workoutId', op: 'EQUAL', value: { stringValue: workoutId } }],
      });
      const seen = new Set(existingDocs.map((d) => docId(d)));
      for (const d of extraDocs) {
        if (!seen.has(docId(d))) existingDocs.push(d);
      }
    }
    const existingById = new Map(existingDocs.map((d) => [docId(d), d]));

    // Validate removeExerciseIds belong to this workout
    if (input.removeExerciseIds && input.removeExerciseIds.length > 0) {
      for (const remId of input.removeExerciseIds) {
        safeId(remId, 'exercise history');
        if (!existingById.has(remId)) {
          throw new DataError('invalid-argument', `Exercise history id ${remId} does not belong to this workout.`);
        }
      }
    }

    interface PreparedExercise {
      isNew: boolean;
      existingDoc?: FsDocument;
      name: string;
      id?: string;
      customTitle?: string;
      notes?: string;
      inputSets?: PerformedSetInput[];
      completedSets: StoredPerformedSet[];
      resolved: { id: string; matchedName: string; muscleGroups: string[]; equipment: string };
    }

    const preparedExercises: PreparedExercise[] = [];
    const [historyExercises, customDocs] = await Promise.all([
      this.loadHistoryExercises(),
      this.fs.query(this.path(), 'customExercises', {}),
    ]);
    const customExercises = parseCustomExercises(customDocs);

    if (input.exercises && input.exercises.length > 0) {
      for (const ex of input.exercises) {
        const resolved = resolveExercise(ex.name, customExercises, undefined, historyExercises);
        if (ex.id) {
          safeId(ex.id, 'exercise history');
          if (!existingById.has(ex.id)) {
            throw new DataError('invalid-argument', `Exercise history id ${ex.id} does not belong to this workout.`);
          }
          const currentDoc = existingById.get(ex.id)!;
          const currentSets = (Array.isArray(data(currentDoc).sets) ? data(currentDoc).sets : []) as StoredPerformedSet[];

          let completedSets: StoredPerformedSet[];
          if (ex.sets) {
            completedSets = ex.sets
              .filter((s) => s.completed !== false)
              .map((s, idx) => ({
                setNumber: idx + 1,
                targetReps: s.reps,
                actualReps: s.reps,
                weight: s.weight ?? 0,
                unit: s.unit ?? 'lbs',
                completed: true,
                ...(s.rpe !== undefined ? { rpe: s.rpe } : {}),
                ...(s.time !== undefined ? { time: s.time } : {}),
                ...(s.rir !== undefined ? { rir: s.rir } : {}),
                ...(s.notes?.trim() ? { notes: s.notes.trim() } : {}),
              }));
          } else {
            let workingSets = currentSets.slice();
            if (ex.removeSetNumbers && ex.removeSetNumbers.length > 0) {
              const removeSet = new Set(ex.removeSetNumbers);
              workingSets = workingSets.filter((s, idx) => !removeSet.has(s.setNumber ?? idx + 1));
            }
            if (ex.addSets && ex.addSets.length > 0) {
              const newSets: StoredPerformedSet[] = ex.addSets
                .filter((s) => s.completed !== false)
                .map((s) => ({
                  setNumber: 0,
                  targetReps: s.reps,
                  actualReps: s.reps,
                  weight: s.weight ?? 0,
                  unit: s.unit ?? 'lbs',
                  completed: true,
                  ...(s.rpe !== undefined ? { rpe: s.rpe } : {}),
                  ...(s.time !== undefined ? { time: s.time } : {}),
                  ...(s.rir !== undefined ? { rir: s.rir } : {}),
                  ...(s.notes?.trim() ? { notes: s.notes.trim() } : {}),
                }));
              workingSets.push(...newSets);
            }
            completedSets = workingSets.map((s, idx) => ({ ...s, setNumber: idx + 1 }));
          }

          if (completedSets.length === 0) {
            throw new DataError('invalid-argument', `Exercise "${ex.name}" must have at least one completed set.`);
          }

          preparedExercises.push({
            isNew: false,
            existingDoc: currentDoc,
            name: ex.name,
            id: ex.id,
            customTitle: ex.customTitle,
            notes: ex.notes,
            completedSets,
            resolved,
          });
        } else {
          // New exercise to add
          if (!ex.sets || ex.sets.length === 0) {
            throw new DataError('invalid-argument', `New exercise "${ex.name}" must have at least one set.`);
          }
          const completedSets = ex.sets
            .filter((s) => s.completed !== false)
            .map((s, idx) => ({
              setNumber: idx + 1,
              targetReps: s.reps,
              actualReps: s.reps,
              weight: s.weight ?? 0,
              unit: s.unit ?? 'lbs',
              completed: true,
              ...(s.rpe !== undefined ? { rpe: s.rpe } : {}),
              ...(s.time !== undefined ? { time: s.time } : {}),
              ...(s.rir !== undefined ? { rir: s.rir } : {}),
              ...(s.notes?.trim() ? { notes: s.notes.trim() } : {}),
            }));

          if (completedSets.length === 0) {
            throw new DataError('invalid-argument', `Exercise "${ex.name}" must have at least one completed set.`);
          }

          preparedExercises.push({
            isNew: true,
            name: ex.name,
            customTitle: ex.customTitle,
            notes: ex.notes,
            inputSets: ex.sets,
            completedSets,
            resolved,
          });
        }
      }
    }

    // All validations passed; start writes
    const now = this.now();
    const dateChanged = Boolean(input.date);
    const nameChanged = Boolean(input.name);
    const workoutDate = input.date
      ? new Date(`${input.date}T12:00:00.000Z`)
      : new Date((currentWorkout.startTime as string | Date) || now);
    const workoutName = input.name?.trim() ?? ((currentWorkout.name as string) || 'Workout');

    const affectedExerciseIds = new Set<string>();

    // 1. Explicit removals via removeExerciseIds
    if (input.removeExerciseIds && input.removeExerciseIds.length > 0) {
      for (const remId of input.removeExerciseIds) {
        await this.fs.delete(this.path('exercise_history', remId));
        const exId = data(existingById.get(remId)!).exerciseId as string;
        if (exId) affectedExerciseIds.add(exId);
        existingById.delete(remId);
      }
    }

    // 2. If replaceAllExercises is true, remove any unlisted exercises
    if (input.replaceAllExercises === true && input.exercises) {
      const keptIds = new Set(input.exercises.map((e) => e.id).filter(Boolean));
      for (const [id, doc] of existingById.entries()) {
        if (!keptIds.has(id)) {
          await this.fs.delete(this.path('exercise_history', id));
          const exId = data(doc).exerciseId as string;
          if (exId) affectedExerciseIds.add(exId);
          existingById.delete(id);
        }
      }
    }

    // 3. Update or add exercises from preparedExercises
    const updatedExistingDocIds = new Set<string>();
    for (const prep of preparedExercises) {
      const exerciseId = prep.resolved.id;
      affectedExerciseIds.add(exerciseId);

      const totalVolume = prep.completedSets.reduce((sum, s) => sum + s.weight * s.actualReps, 0);
      const configuration = generateConfigurationString(prep.completedSets);

      const statsDoc = await this.fs.get(this.path('exercise_stats', exerciseId));
      const currentStats = statsDoc ? data(statsDoc) : null;
      const prs = checkPersonalRecords(currentStats, prep.completedSets, totalVolume);

      if (!prep.isNew && prep.id && prep.existingDoc) {
        updatedExistingDocIds.add(prep.id);
        const prevExId = data(prep.existingDoc).exerciseId as string;
        if (prevExId && prevExId !== exerciseId) affectedExerciseIds.add(prevExId);

        const fields: Record<string, unknown> = {
          exerciseId,
          exerciseName: prep.name.trim(),
          sets: prep.completedSets,
          configuration,
          totalVolume,
          workoutDate,
          workoutName,
          personalRecords: prs,
          updatedAt: now,
          muscleGroups: prep.resolved.muscleGroups,
          equipment: prep.resolved.equipment,
          ...(prep.notes?.trim() !== undefined ? { notes: prep.notes.trim() } : {}),
          ...(prep.customTitle?.trim() !== undefined ? { customTitle: prep.customTitle.trim() } : {}),
        };
        const mask = [
          'exerciseId',
          'exerciseName',
          'sets',
          'configuration',
          'totalVolume',
          'workoutDate',
          'workoutName',
          'personalRecords',
          'updatedAt',
          'muscleGroups',
          'equipment',
        ];
        if (prep.notes !== undefined) mask.push('notes');
        if (prep.customTitle !== undefined) mask.push('customTitle');
        await this.fs.patch(this.path('exercise_history', prep.id), toFields(fields), { mask });
      } else {
        // Add new exercise
        const newDoc = buildExerciseHistoryDoc(
          this.uid,
          linkedWorkoutId,
          workoutName,
          workoutDate,
          {
            name: prep.name,
            sets:
              prep.inputSets ||
              prep.completedSets.map((s) => ({
                reps: s.actualReps,
                weight: s.weight,
                unit: s.unit,
                rpe: s.rpe,
                time: s.time,
                rir: s.rir,
                completed: s.completed,
                notes: s.notes,
              })),
            notes: prep.notes,
            customTitle: prep.customTitle,
          },
          prs,
          now,
          prep.resolved,
        );
        await this.fs.create(this.path('exercise_history'), toFields(newDoc));
      }
    }

    // 4. Update unlisted preserved exercises when date or name changed
    if (dateChanged || nameChanged) {
      for (const [id, doc] of existingById.entries()) {
        if (!updatedExistingDocIds.has(id)) {
          const exId = data(doc).exerciseId as string;
          if (exId && dateChanged) affectedExerciseIds.add(exId);
          const patchFields: Record<string, unknown> = { updatedAt: now };
          const mask = ['updatedAt'];
          if (dateChanged) {
            patchFields.workoutDate = workoutDate;
            mask.push('workoutDate');
          }
          if (nameChanged) {
            patchFields.workoutName = workoutName;
            mask.push('workoutName');
          }
          await this.fs.patch(this.path('exercise_history', id), toFields(patchFields), { mask });
        }
      }
    }

    // Recompute workout summary totals
    let finalExDocs = await this.fs.query(this.path(), 'exercise_history', {
      filters: [{ field: 'workoutId', op: 'EQUAL', value: { stringValue: linkedWorkoutId } }],
    });
    if (linkedWorkoutId !== workoutId) {
      const extraDocs = await this.fs.query(this.path(), 'exercise_history', {
        filters: [{ field: 'workoutId', op: 'EQUAL', value: { stringValue: workoutId } }],
      });
      const seen = new Set(finalExDocs.map((d) => docId(d)));
      for (const d of extraDocs) {
        if (!seen.has(docId(d))) finalExDocs.push(d);
      }
    }

    // Order finalExDocs deterministically
    const prevSummary = Array.isArray(currentWorkout.exercisesSummary)
      ? (currentWorkout.exercisesSummary as Array<Record<string, unknown>>)
      : [];

    finalExDocs.sort((a, b) => {
      const idA = docId(a);
      const idB = docId(b);
      const dataA = data(a);
      const dataB = data(b);

      if (input.replaceAllExercises && input.exercises) {
        const idxA = input.exercises.findIndex(
          (e) => e.id === idA || e.name.toLowerCase() === String(dataA.exerciseName).toLowerCase(),
        );
        const idxB = input.exercises.findIndex(
          (e) => e.id === idB || e.name.toLowerCase() === String(dataB.exerciseName).toLowerCase(),
        );
        return (idxA >= 0 ? idxA : 999) - (idxB >= 0 ? idxB : 999);
      }

      const exIdA = String(dataA.exerciseId ?? '');
      const exIdB = String(dataB.exerciseId ?? '');
      const prevIdxA = prevSummary.findIndex((s) => s.exerciseId === exIdA || s.exerciseName === dataA.exerciseName);
      const prevIdxB = prevSummary.findIndex((s) => s.exerciseId === exIdB || s.exerciseName === dataB.exerciseName);

      const rankA = prevIdxA >= 0 ? prevIdxA : 1000;
      const rankB = prevIdxB >= 0 ? prevIdxB : 1000;
      if (rankA !== rankB) return rankA - rankB;

      const timeA = String(a.createTime ?? dataA.createdAt ?? '');
      const timeB = String(b.createTime ?? dataB.createdAt ?? '');
      return timeA.localeCompare(timeB);
    });

    let totalSets = 0;
    let totalReps = 0;
    let totalVolume = 0;

    const exercisesSummary = finalExDocs.map((d) => {
      const dData = data(d);
      const setsArr = Array.isArray(dData.sets) ? (dData.sets as StoredPerformedSet[]) : [];
      const sets = setsArr.length;
      const reps = setsArr.reduce((sum, s) => sum + (s.actualReps || 0), 0);
      const volume = typeof dData.totalVolume === 'number' ? dData.totalVolume : 0;
      totalSets += sets;
      totalReps += reps;
      totalVolume += volume;
      return {
        exerciseId: String(dData.exerciseId ?? ''),
        exerciseName: String(dData.exerciseName ?? ''),
        sets,
        reps,
        volume,
      };
    });

    const duration =
      input.durationMinutes !== undefined
        ? input.durationMinutes
        : (typeof currentWorkout.duration === 'number' ? currentWorkout.duration : 0);
    const startDate = workoutDate;
    const endDate = duration > 0 ? new Date(startDate.getTime() + duration * 60000) : startDate;

    const summaryPatch: Record<string, unknown> = {
      name: workoutName,
      startTime: startDate,
      endTime: endDate,
      duration,
      totalExercises: exercisesSummary.length,
      totalSets,
      totalReps,
      totalVolume,
      exercisesSummary,
      updatedAt: now,
    };
    const summaryMask = [
      'name',
      'startTime',
      'endTime',
      'duration',
      'totalExercises',
      'totalSets',
      'totalReps',
      'totalVolume',
      'exercisesSummary',
      'updatedAt',
    ];
    await this.fs.patch(this.path('workout_history', workoutId), toFields(summaryPatch), { mask: summaryMask });

    // Recompute stats and PRs for all affected exercises
    for (const exId of affectedExerciseIds) {
      const exHistories = await this.fs.query(this.path(), 'exercise_history', {
        filters: [{ field: 'exerciseId', op: 'EQUAL', value: { stringValue: exId } }],
      });
      if (exHistories.length === 0) {
        await this.fs.delete(this.path('exercise_stats', exId));
      } else {
        const rawHistories: RawExerciseHistory[] = exHistories.map((d) => {
          const dData = data(d);
          return {
            workoutDate: new Date(dData.workoutDate as string | Date),
            sets: (Array.isArray(dData.sets) ? dData.sets : []) as Array<{ actualReps: number; weight: number }>,
            totalVolume: typeof dData.totalVolume === 'number' ? dData.totalVolume : 0,
          };
        });
        const exName = String(data(exHistories[0]).exerciseName ?? '');
        const computedStats = computeExerciseStats(exId, exName, rawHistories);
        await this.fs.patch(this.path('exercise_stats', exId), toFields(computedStats));
      }
    }

    return this.getHistoryEntry(workoutId);
  }

    async searchExercises(query: string) {
    const customDocs = await this.fs.query(this.path(), 'customExercises', {});
    const customList = parseCustomExercises(customDocs);
    const exercises = searchExerciseIndex(query, customList, getCachedLibrary());
    return { exercises };
  }

  async addExercise(input: CustomExerciseInput) {
    // 1. Refuse near-duplicate of library exercise
    const libMatch = matchExerciseInList(input.name, getCachedLibrary());
    if (libMatch) {
      throw new DuplicateExerciseError({
        id: libMatch.id,
        name: libMatch.name,
        isCustom: false,
        muscleGroups: libMatch.muscleGroups,
        equipment: libMatch.equipment,
      });
    }

    // 2. Refuse near-duplicate of custom exercise
    const customDocs = await this.fs.query(this.path(), 'customExercises', {});
    const customList = parseCustomExercises(customDocs);
    const customMatch = matchCustomExercise(input.name, customList);
    if (customMatch) {
      const groups =
        customMatch.muscleGroups && customMatch.muscleGroups.length > 0
          ? customMatch.muscleGroups
          : customMatch.muscleGroup
            ? customMatch.muscleGroup.split(',').map((s) => s.trim()).filter(Boolean)
            : ['Custom'];
      throw new DuplicateExerciseError({
        id: customMatch.id,
        name: customMatch.name,
        isCustom: true,
        muscleGroups: groups,
        equipment: customMatch.equipment || 'Custom',
      });
    }

    const fields = buildCustomExerciseDoc(this.uid, input, this.now());
    const doc = await this.fs.create(this.path('customExercises'), toFields(fields));
    return {
      id: docId(doc),
      name: fields.name as string,
      muscleGroup: fields.muscleGroup as string,
      muscleGroups: input.muscleGroups,
      equipment: fields.equipment as string,
      media_url: input.media_url,
      videoLinks: fields.videoLinks as string[],
    };
  }

  async updateExercise(input: UpdateExerciseInput) {
    const exId = input.exerciseId || input.exercise_id;
    if (!exId) throw new DataError('invalid-argument', 'exerciseId or exercise_id is required.');
    safeId(exId, 'custom exercise');
    const doc = await this.fs.get(this.path('customExercises', exId));
    if (!doc) {
      throw new DataError('not-found', `No custom exercise with id ${exId}.`);
    }
    const current = data(doc);

    // If name is updated, check duplicates against library and other custom exercises
    if (input.name && input.name.trim().toLowerCase() !== String(current.name).toLowerCase()) {
      const libMatch = matchExerciseInList(input.name, getCachedLibrary());
      if (libMatch) {
        throw new DuplicateExerciseError({
          id: libMatch.id,
          name: libMatch.name,
          isCustom: false,
          muscleGroups: libMatch.muscleGroups,
          equipment: libMatch.equipment,
        });
      }
      const customDocs = await this.fs.query(this.path(), 'customExercises', {});
      const otherCustoms = parseCustomExercises(customDocs).filter((c) => c.id !== exId);
      const customMatch = matchCustomExercise(input.name, otherCustoms);
      if (customMatch) {
        const groups =
          customMatch.muscleGroups && customMatch.muscleGroups.length > 0
            ? customMatch.muscleGroups
            : customMatch.muscleGroup
              ? customMatch.muscleGroup.split(',').map((s) => s.trim()).filter(Boolean)
              : ['Custom'];
        throw new DuplicateExerciseError({
          id: customMatch.id,
          name: customMatch.name,
          isCustom: true,
          muscleGroups: groups,
          equipment: customMatch.equipment || 'Custom',
        });
      }
    }

    const now = this.now();
    const patchData: Record<string, unknown> = { updatedAt: now };
    const mask = ['updatedAt'];

    if (input.name !== undefined) {
      patchData.name = input.name.trim();
      patchData.originalName = input.name.trim();
      mask.push('name', 'originalName');
    }

    const muscleGroups = input.muscles ?? input.muscleGroups;
    if (muscleGroups !== undefined) {
      patchData.muscleGroups = muscleGroups;
      patchData.muscleGroup = muscleGroups.join(', ');
      mask.push('muscleGroups', 'muscleGroup');
    }

    if (input.equipment !== undefined) {
      patchData.equipment = input.equipment.trim();
      mask.push('equipment');
    }

    const instructions = input.setupCues ?? input.instructions;
    if (instructions !== undefined) {
      patchData.instructions = instructions;
      mask.push('instructions');
    }

    if (input.notes !== undefined) {
      patchData.notes = input.notes.trim();
      mask.push('notes');
    }

    const mediaUrl = input.media ?? input.media_url;
    if (mediaUrl !== undefined) {
      patchData.videoLinks = [mediaUrl];
      mask.push('videoLinks');
    }

    if (input.name !== undefined || muscleGroups !== undefined || input.equipment !== undefined) {
      const finalName = (patchData.name as string) ?? String(current.name ?? '');
      const finalMuscle = (patchData.muscleGroup as string) ?? String(current.muscleGroup ?? '');
      const finalEquip = (patchData.equipment as string) ?? String(current.equipment ?? '');
      patchData.searchKeywords = [
        finalName.toLowerCase(),
        finalName.toLowerCase(),
        finalMuscle.toLowerCase(),
        finalEquip.toLowerCase(),
        ...finalName.toLowerCase().split(' '),
      ].filter(Boolean);
      mask.push('searchKeywords');
    }

    await this.fs.patch(this.path('customExercises', exId), toFields(patchData), { mask });

    return {
      id: exId,
      name: (patchData.name as string) ?? String(current.name ?? ''),
      muscleGroup: (patchData.muscleGroup as string) ?? String(current.muscleGroup ?? ''),
      equipment: (patchData.equipment as string) ?? String(current.equipment ?? ''),
      videoLinks: (patchData.videoLinks as string[]) ?? (Array.isArray(current.videoLinks) ? current.videoLinks : []),
      notes: (patchData.notes as string) ?? (typeof current.notes === 'string' ? current.notes : undefined),
    };
  }

  async attachMediaToExercise(exerciseId: string, mediaUrl: string): Promise<void> {
    safeId(exerciseId, 'custom exercise');
    const now = this.now();
    await this.fs.patch(
      this.path('customExercises', exerciseId),
      toFields({ videoLinks: [mediaUrl], updatedAt: now }),
      { mask: ['videoLinks', 'updatedAt'] },
    );
  }

  async attachMediaFromUrl(exerciseId: string, url: string) {
    safeId(exerciseId, 'custom exercise');
    if (!url.startsWith('https://')) {
      throw new DataError('invalid-argument', 'URL must be https.');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new DataError('invalid-argument', 'Invalid URL.');
    }
    const host = parsedUrl.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      throw new DataError('invalid-argument', 'Private network URLs are not allowed.');
    }

    const doc = await this.fs.get(this.path('customExercises', exerciseId));
    if (!doc) {
      throw new DataError('not-found', `No custom exercise with id ${exerciseId}.`);
    }

    const fetchImpl = this.options.fetchImpl ?? fetch;
    let res: Response;
    try {
      res = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    } catch (err) {
      throw new DataError('invalid-argument', `Failed to fetch media from URL: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!res.ok) {
      throw new DataError('invalid-argument', `Failed to fetch media: server returned HTTP ${res.status}.`);
    }
    if (res.url && !res.url.startsWith('https://')) {
      throw new DataError('invalid-argument', 'Redirected to non-https URL.');
    }

    const contentLength = Number(res.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > 60 * 1024 * 1024) {
      throw new DataError('invalid-argument', 'Media file exceeds 60 MB limit.');
    }

    const arrayBuffer = await res.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    if (bytes.length === 0) {
      throw new DataError('invalid-argument', 'Fetched file is empty.');
    }
    if (bytes.length > 60 * 1024 * 1024) {
      throw new DataError('invalid-argument', 'Media file exceeds 60 MB limit.');
    }

    const sniffed = sniffMediaType(bytes);
    if (!sniffed) {
      throw new DataError(
        'invalid-argument',
        'Unsupported media type: file does not match photo (jpeg/png/webp/heic), gif, or video (mp4/webm/mov).',
      );
    }

    if (!isMediaSizeAllowed(sniffed.kind, bytes.length)) {
      throw new DataError(
        'invalid-argument',
        `File size (${bytes.length} bytes) exceeds limit for ${sniffed.kind} (${maxBytesForKind(sniffed.kind)} bytes).`,
      );
    }

    if (!this.options.r2) {
      throw new DataError('conflict', 'Media storage (R2) is not configured.');
    }

    const mediaId = generateMediaId();
    const key = `${this.uid}/${mediaId}.${sniffed.ext}`;
    await this.options.r2.put(key, bytes, {
      httpMetadata: { contentType: sniffed.mime, cacheControl: 'public, max-age=31536000, immutable' },
    });

    const origin = this.options.origin ?? 'https://workout-ai.test';
    const mediaUrl = `${origin}/media/${this.uid}/${mediaId}.${sniffed.ext}`;

    await this.attachMediaToExercise(exerciseId, mediaUrl);

    return { exerciseId, mediaUrl, kind: sniffed.kind, bytes: bytes.length };
  }

  async createMediaUploadLink(exerciseId: string) {
    safeId(exerciseId, 'custom exercise');
    const doc = await this.fs.get(this.path('customExercises', exerciseId));
    if (!doc) {
      throw new DataError('not-found', `No custom exercise with id ${exerciseId}.`);
    }

    if (!this.options.kv) {
      throw new DataError('conflict', 'Upload token storage (KV) is not configured.');
    }

    const { token, expiresSeconds } = await createUploadToken(this.options.kv, this.uid, exerciseId);
    const origin = this.options.origin ?? 'https://workout-ai.test';
    return {
      exerciseId,
      uploadUrl: `${origin}/upload/${token}`,
      token,
      expiresSeconds,
      expiresMinutes: Math.round(expiresSeconds / 60),
    };
  }
}
