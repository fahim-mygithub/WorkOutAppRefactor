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
  fallbackExerciseId,
  generateConfigurationString,
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
  type ExerciseHistoryInput,
  type ExerciseInput,
  type LogWorkoutInput,
  type ParsedWorkout,
  type PlannedWorkout,
  type ProfilePatch,
  type RawExerciseHistory,
  type StoredPerformedSet,
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

  constructor(
    private readonly fs: FirestoreRest,
    uid: string,
    private readonly now: () => Date = () => new Date(),
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {
    this.uid = safeId(uid, 'user');
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

    const exDocs = await this.fs.query(this.path(), 'exercise_history', {
      filters: [{ field: 'workoutId', op: 'EQUAL', value: { stringValue: linkedWorkoutId } }],
      orderBy: 'workoutDate',
      direction: 'ASCENDING',
    });

    let allExDocs = exDocs;
    if (linkedWorkoutId !== id) {
      const extraDocs = await this.fs.query(this.path(), 'exercise_history', {
        filters: [{ field: 'workoutId', op: 'EQUAL', value: { stringValue: id } }],
        orderBy: 'workoutDate',
        direction: 'ASCENDING',
      });
      const seen = new Set(allExDocs.map((d) => docId(d)));
      for (const d of extraDocs) {
        if (!seen.has(docId(d))) allExDocs.push(d);
      }
    }

    const exercises = allExDocs.map((d) => {
      const dData = data(d);
      return {
        id: docId(d),
        exerciseId: String(dData.exerciseId ?? ''),
        exerciseName: String(dData.exerciseName ?? ''),
        configuration: String(dData.configuration ?? ''),
        totalVolume: typeof dData.totalVolume === 'number' ? dData.totalVolume : 0,
        sets: Array.isArray(dData.sets) ? (dData.sets as StoredPerformedSet[]) : [],
        ...(dData.notes ? { notes: String(dData.notes) } : {}),
        ...(dData.personalRecords ? { personalRecords: dData.personalRecords as Record<string, unknown> } : {}),
      };
    });

    return {
      ...summary,
      exercises,
    };
  }

  async logWorkout(input: LogWorkoutInput) {
    const todayStr = this.now().toISOString().slice(0, 10);
    if (input.date > todayStr) {
      throw new DataError('invalid-argument', 'Cannot log a workout in the future.');
    }
    if (!input.exercises || input.exercises.length === 0) {
      throw new DataError('invalid-argument', 'Workout must have at least one exercise.');
    }
    for (const e of input.exercises) {
      if (!e.sets || e.sets.length === 0) {
        throw new DataError('invalid-argument', `Exercise "${e.name}" must have at least one set.`);
      }
      const completed = e.sets.filter((s) => s.completed !== false);
      if (completed.length === 0) {
        throw new DataError('invalid-argument', `Exercise "${e.name}" must have at least one completed set.`);
      }
    }

    const now = this.now();
    const workoutDate = new Date(`${input.date}T12:00:00.000Z`);
    const workoutName = input.name?.trim() || 'Workout';

    // 1. Create the workout_history summary document first to obtain its auto id
    const initialSummary = buildWorkoutHistoryDoc(this.uid, '', input, now);
    const summaryDoc = await this.fs.create(this.path('workout_history'), toFields(initialSummary));
    const workoutId = docId(summaryDoc);

    // Update workoutId field on summary doc so it mirrors activeWorkout.id
    await this.fs.patch(this.path('workout_history', workoutId), toFields({ workoutId }), { mask: ['workoutId'] });

    // 2. Create an exercise_history document for each exercise and update exercise_stats
    for (const e of input.exercises) {
      const exerciseId = fallbackExerciseId(e.name);
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

      const exDocFields = buildExerciseHistoryDoc(this.uid, workoutId, workoutName, workoutDate, e, prs, now);
      await this.fs.create(this.path('exercise_history'), toFields(exDocFields));

      const nextStats = updateExerciseStatsDoc(
        exerciseId,
        e.name.trim(),
        currentStats,
        completedSets,
        totalVolume,
        prs,
        workoutDate,
      );
      await this.fs.patch(this.path('exercise_stats', exerciseId), toFields(nextStats));
    }

    return this.getHistoryEntry(workoutId);
  }

  async updateHistoryEntry(input: {
    workoutId: string;
    date?: string;
    name?: string;
    durationMinutes?: number;
    notes?: string;
    exercises?: ExerciseHistoryInput[];
  }) {
    const workoutId = safeId(input.workoutId, 'workout history');
    const workoutDoc = await this.fs.get(this.path('workout_history', workoutId));
    if (!workoutDoc) throw new DataError('not-found', `No workout history entry with id ${workoutId}.`);
    const currentWorkout = data(workoutDoc);

    if (input.date) {
      const todayStr = this.now().toISOString().slice(0, 10);
      if (input.date > todayStr) {
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

    // Validate any exercise ids in input belong to this workout, and validate completed sets
    const affectedExerciseIds = new Set<string>();
    if (input.exercises) {
      for (const ex of input.exercises) {
        if (ex.id) {
          safeId(ex.id, 'exercise history');
          if (!existingById.has(ex.id)) {
            throw new DataError('invalid-argument', `Exercise history id ${ex.id} does not belong to this workout.`);
          }
        }
        if (!ex.sets || ex.sets.length === 0) {
          throw new DataError('invalid-argument', `Exercise "${ex.name}" must have at least one set.`);
        }
        const completed = ex.sets.filter((s) => s.completed !== false);
        if (completed.length === 0) {
          throw new DataError('invalid-argument', `Exercise "${ex.name}" must have at least one completed set.`);
        }
      }
    }

    const now = this.now();
    const workoutDate = input.date
      ? new Date(`${input.date}T12:00:00.000Z`)
      : new Date((currentWorkout.startTime as string | Date) || now);
    const workoutName = input.name?.trim() ?? ((currentWorkout.name as string) || 'Workout');

    if (input.exercises) {
      const newExIds = new Set(input.exercises.map((e) => e.id).filter(Boolean));

      // 1. Delete exercises not in input
      for (const d of existingDocs) {
        const id = docId(d);
        if (!newExIds.has(id)) {
          await this.fs.delete(this.path('exercise_history', id));
          const exId = data(d).exerciseId as string;
          if (exId) affectedExerciseIds.add(exId);
        }
      }

      // 2. Update existing or add new exercises
      for (const ex of input.exercises) {
        const exerciseId = fallbackExerciseId(ex.name);
        affectedExerciseIds.add(exerciseId);

        const completedSets: StoredPerformedSet[] = ex.sets
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

        const configuration = generateConfigurationString(completedSets);
        const totalVolume = completedSets.reduce((sum, s) => sum + s.weight * s.actualReps, 0);

        const statsDoc = await this.fs.get(this.path('exercise_stats', exerciseId));
        const currentStats = statsDoc ? data(statsDoc) : null;
        const prs = checkPersonalRecords(currentStats, completedSets, totalVolume);

        if (ex.id && existingById.has(ex.id)) {
          const prevExId = data(existingById.get(ex.id)!).exerciseId as string;
          if (prevExId) affectedExerciseIds.add(prevExId);

          const fields: Record<string, unknown> = {
            exerciseId,
            exerciseName: ex.name.trim(),
            sets: completedSets,
            configuration,
            totalVolume,
            workoutDate,
            workoutName,
            personalRecords: prs,
            updatedAt: now,
            ...(ex.notes?.trim() !== undefined ? { notes: ex.notes.trim() } : {}),
          };
          const mask = ['exerciseId', 'exerciseName', 'sets', 'configuration', 'totalVolume', 'workoutDate', 'workoutName', 'personalRecords', 'updatedAt'];
          if (ex.notes !== undefined) mask.push('notes');
          await this.fs.patch(this.path('exercise_history', ex.id), toFields(fields), { mask });
        } else {
          const newDoc = buildExerciseHistoryDoc(this.uid, linkedWorkoutId, workoutName, workoutDate, ex, prs, now);
          await this.fs.create(this.path('exercise_history'), toFields(newDoc));
        }
      }
    } else if (input.date || input.name) {
      for (const d of existingDocs) {
        const id = docId(d);
        const exId = data(d).exerciseId as string;
        if (exId) affectedExerciseIds.add(exId);
        const patchFields: Record<string, unknown> = { updatedAt: now };
        const mask = ['updatedAt'];
        if (input.date) {
          patchFields.workoutDate = workoutDate;
          mask.push('workoutDate');
        }
        if (input.name) {
          patchFields.workoutName = workoutName;
          mask.push('workoutName');
        }
        await this.fs.patch(this.path('exercise_history', id), toFields(patchFields), { mask });
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

    const duration = input.durationMinutes !== undefined
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
      ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
    };
    const summaryMask = ['name', 'startTime', 'endTime', 'duration', 'totalExercises', 'totalSets', 'totalReps', 'totalVolume', 'exercisesSummary', 'updatedAt'];
    if (input.notes !== undefined) summaryMask.push('notes');
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

  async addExercise(input: CustomExerciseInput) {
    const fields = buildCustomExerciseDoc(this.uid, input, this.now());
    const doc = await this.fs.create(this.path('customExercises'), toFields(fields));
    return { id: docId(doc), name: fields.name, muscleGroup: fields.muscleGroup, equipment: fields.equipment };
  }
}

