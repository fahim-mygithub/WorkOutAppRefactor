/**
 * One signed-in user's data. The service account bypasses Firestore security
 * rules, so this class IS the access rule: every path starts with
 * `users/{uid}` where uid comes from the verified OAuth grant, and document
 * ids from tool input must look like Firestore auto-ids (no `/`, no `..`).
 */
import { docId, FirestoreError, type FirestoreRest, type FsDocument } from './firestore';
import { fromFields, toFields } from './firestoreValue';
import {
  buildCustomExerciseDoc,
  buildPlan,
  buildPlansDoc,
  buildProfileUpdate,
  buildSavedWorkoutDoc,
  buildWorkoutUpdate,
  mergePlan,
  readExerciseHistory,
  readPlans,
  readProfile,
  readSavedWorkout,
  readWorkoutSummary,
  toParsedWorkout,
  toWorkoutExercises,
  type CustomExerciseInput,
  type ExerciseInput,
  type ParsedWorkout,
  type PlannedWorkout,
  type ProfilePatch,
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

  async listHistory(opts: { kind: 'workouts' | 'exercises'; pageSize: number; pageToken?: string }) {
    const offset = offsetFrom(opts.pageToken);
    const workouts = opts.kind === 'workouts';
    const docs = await this.fs.query(this.path(), workouts ? 'workout_history' : 'exercise_history', {
      orderBy: workouts ? 'endTime' : 'workoutDate',
      direction: 'DESCENDING',
      limit: opts.pageSize,
      offset,
    });
    const items = docs.map((doc) =>
      workouts ? readWorkoutSummary(docId(doc), data(doc)) : readExerciseHistory(docId(doc), data(doc)),
    );
    return { items, ...(docs.length === opts.pageSize ? { nextPageToken: String(offset + docs.length) } : {}) };
  }

  async addExercise(input: CustomExerciseInput) {
    const fields = buildCustomExerciseDoc(this.uid, input, this.now());
    const doc = await this.fs.create(this.path('customExercises'), toFields(fields));
    return { id: docId(doc), name: fields.name, muscleGroup: fields.muscleGroup, equipment: fields.equipment };
  }
}

