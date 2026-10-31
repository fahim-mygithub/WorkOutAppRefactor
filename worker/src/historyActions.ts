/**
 * The `history` action: Apply and Undo for a dictated or corrected past
 * workout, run through the reviewed data layer (`runAgentTool` on `UserData`)
 * so exercise names resolve against the library and custom exercises, records
 * link the way the app's own do (`linkedWorkoutId`) and stats / PRs stay right.
 *
 *   log       -> log_workout; returns the created workout id and exercise ids.
 *   edit      -> get_history_entry (the prior snapshot), then
 *                update_history_entry; returns `{ prior }` for undoEdit.
 *   undoLog   -> deletes the summary and exercise documents `log` created and
 *                recomputes the stats of the exercises it touched.
 *   undoEdit  -> update_history_entry with replaceAllExercises from `prior`
 *                (name, date, every set), recreating removed exercises.
 *
 * The user is `data.uid`, which comes from the verified token in index.ts; no
 * input names one (every tool schema is strict).
 */
import { z } from 'zod';
import { runAgentTool } from './agentTools/registry';
import { performedSetInput } from './agentTools/schemas';
import type { FirestoreRest } from './data/firestore';
import { fromFields, toFields } from './data/firestoreValue';
import { computeExerciseStats, type RawExerciseHistory } from './data/shapes';
import type { UserData } from './data/userData';

export type HistoryResult = { ok: true; [key: string]: unknown } | { ok: false; error: string };

const fail = (error: string): HistoryResult => ({ ok: false, error });

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const safeDocId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);

/** A past workout as update_history_entry takes it back: what undoEdit restores. */
const priorSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    date: dateKey,
    durationMinutes: z.number().int().min(1).max(1440).optional(),
    exercises: z
      .array(
        z
          .object({
            id: safeDocId,
            name: z.string().trim().min(1).max(120),
            sets: z.array(performedSetInput).min(1).max(30),
            notes: z.string().max(500).optional(),
            customTitle: z.string().trim().max(120).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(40),
  })
  .strict();

export type PriorSnapshot = z.infer<typeof priorSchema>;

const undoEditInput = z.object({ workoutId: safeDocId, prior: priorSchema }).strict();
const undoLogInput = z.object({ workoutId: safeDocId, exerciseIds: z.array(safeDocId).min(1).max(40) }).strict();
const editInput = z.object({ workoutId: safeDocId, update: z.record(z.unknown()) }).strict();

interface StoredSet {
  setNumber?: number;
  targetReps?: number;
  actualReps?: number;
  weight?: number;
  unit?: string;
  rpe?: number;
  time?: number;
  rir?: number;
  notes?: string;
}

interface EntryExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  sets: StoredSet[];
  notes?: string;
  customTitle?: string;
}

interface Entry {
  id: string;
  name?: string;
  startTime?: string;
  durationMinutes?: number;
  exercises: EntryExercise[];
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** get_history_entry's result in the shape update_history_entry accepts. */
function snapshot(entry: Entry): PriorSnapshot {
  return {
    name: entry.name || 'Workout',
    date: String(entry.startTime ?? '').slice(0, 10),
    ...(num(entry.durationMinutes) && entry.durationMinutes >= 1 ? { durationMinutes: Math.round(entry.durationMinutes) } : {}),
    exercises: entry.exercises.map((e) => ({
      id: e.id,
      name: e.exerciseName,
      sets: e.sets.map((s) => ({
        reps: Math.max(1, Math.round(s.actualReps ?? s.targetReps ?? 1)),
        weight: num(s.weight) ? s.weight : 0,
        unit: s.unit === 'kg' ? ('kg' as const) : ('lbs' as const),
        ...(num(s.rpe) ? { rpe: s.rpe } : {}),
        ...(num(s.time) ? { time: s.time } : {}),
        ...(num(s.rir) ? { rir: s.rir } : {}),
        ...(typeof s.notes === 'string' && s.notes.trim() ? { notes: s.notes.trim() } : {}),
      })),
      ...(e.notes ? { notes: e.notes } : {}),
      ...(e.customTitle ? { customTitle: e.customTitle } : {}),
    })),
  };
}

async function readEntry(data: UserData, workoutId: string): Promise<{ entry: Entry } | { error: string }> {
  const r = await runAgentTool('get_history_entry', { workoutId }, { data });
  return r.ok ? { entry: r.result as Entry } : { error: r.error };
}

/** Recomputes (or removes) exercise_stats for exercises whose history changed. */
async function refreshStats(fs: FirestoreRest, uid: string, exerciseIds: Iterable<string>): Promise<void> {
  const user = ['users', uid];
  for (const exId of new Set(exerciseIds)) {
    if (!safeDocId.safeParse(exId).success) continue;
    const docs = await fs.query(user, 'exercise_history', {
      filters: [{ field: 'exerciseId', op: 'EQUAL', value: { stringValue: exId } }],
    });
    if (docs.length === 0) {
      await fs.delete([...user, 'exercise_stats', exId]);
      continue;
    }
    const histories: RawExerciseHistory[] = docs.map((d) => {
      const f = fromFields(d.fields ?? {});
      return {
        workoutDate: new Date(f.workoutDate as string | Date),
        sets: (Array.isArray(f.sets) ? f.sets : []) as Array<{ actualReps: number; weight: number }>,
        totalVolume: typeof f.totalVolume === 'number' ? f.totalVolume : 0,
      };
    });
    const name = String(fromFields(docs[0].fields ?? {}).exerciseName ?? '');
    await fs.patch([...user, 'exercise_stats', exId], toFields(computeExerciseStats(exId, name, histories)));
  }
}

async function log(data: UserData, input: unknown): Promise<HistoryResult> {
  const r = await runAgentTool('log_workout', input, { data });
  if (!r.ok) return fail(r.error);
  const entry = r.result as Entry & { unmatchedExercises?: string[] };
  return {
    ok: true,
    workoutId: entry.id,
    exerciseIds: entry.exercises.map((e) => e.id),
    ...(entry.unmatchedExercises?.length ? { unmatchedExercises: entry.unmatchedExercises } : {}),
  };
}

async function edit(data: UserData, input: unknown): Promise<HistoryResult> {
  const parsed = editInput.safeParse(input);
  if (!parsed.success) return fail('Invalid input for edit.');
  const { workoutId, update } = parsed.data;
  const current = await readEntry(data, workoutId);
  if ('error' in current) return fail(current.error);
  const prior = snapshot(current.entry);
  const r = await runAgentTool('update_history_entry', { ...update, workoutId }, { data });
  if (!r.ok) return fail(r.error);
  return { ok: true, workoutId, prior };
}

async function undoLog(data: UserData, fs: FirestoreRest, input: unknown): Promise<HistoryResult> {
  const parsed = undoLogInput.safeParse(input);
  if (!parsed.success) return fail('Invalid input for undoLog.');
  const { workoutId, exerciseIds } = parsed.data;
  const current = await readEntry(data, workoutId);
  if ('error' in current) return fail(current.error);
  const { entry } = current;
  // Only what the log created: each id must still belong to this workout.
  const owned = new Set(entry.exercises.map((e) => e.id));
  const stray = exerciseIds.find((id) => !owned.has(id));
  if (stray) return fail(`Exercise history id ${stray} does not belong to this workout.`);

  const user = ['users', data.uid];
  for (const e of entry.exercises) await fs.delete([...user, 'exercise_history', e.id]);
  await fs.delete([...user, 'workout_history', entry.id]);
  await refreshStats(fs, data.uid, entry.exercises.map((e) => e.exerciseId));
  return { ok: true, workoutId };
}

async function undoEdit(data: UserData, input: unknown): Promise<HistoryResult> {
  const parsed = undoEditInput.safeParse(input);
  if (!parsed.success) return fail('Invalid input for undoEdit.');
  const { workoutId, prior } = parsed.data;
  const current = await readEntry(data, workoutId);
  if ('error' in current) return fail(current.error);
  const { entry } = current;
  const now = new Map(entry.exercises.map((e) => [e.id, e]));

  const exercises = prior.exercises.map((p) => {
    const existing = now.get(p.id);
    // An exercise the edit removed is recreated (new document, same content).
    const notes = p.notes ?? (existing?.notes ? '' : undefined);
    const customTitle = p.customTitle ?? (existing?.customTitle ? '' : undefined);
    return {
      ...(existing ? { id: p.id } : {}),
      name: p.name,
      sets: p.sets,
      ...(notes !== undefined ? { notes } : {}),
      ...(customTitle !== undefined ? { customTitle } : {}),
    };
  });

  const currentDate = String(entry.startTime ?? '').slice(0, 10);
  const r = await runAgentTool(
    'update_history_entry',
    {
      workoutId,
      exercises,
      replaceAllExercises: true,
      // Only what the edit changed, so an untouched start time keeps its time of day.
      ...(prior.date !== currentDate ? { date: prior.date } : {}),
      ...(prior.name !== entry.name ? { name: prior.name } : {}),
      ...(prior.durationMinutes && prior.durationMinutes !== entry.durationMinutes
        ? { durationMinutes: prior.durationMinutes }
        : {}),
    },
    { data },
  );
  if (!r.ok) return fail(r.error);
  return { ok: true, workoutId };
}

/** Runs one `history` op for the verified user behind `data`. */
export async function runHistoryAction(
  op: 'log' | 'edit' | 'undoLog' | 'undoEdit',
  input: unknown,
  data: UserData,
  fs: FirestoreRest,
): Promise<HistoryResult> {
  switch (op) {
    case 'log':
      return log(data, input);
    case 'edit':
      return edit(data, input);
    case 'undoLog':
      return undoLog(data, fs, input);
    case 'undoEdit':
      return undoEdit(data, input);
  }
}
