/**
 * Server-side read-only tools for the chat loop in handlers.ts.
 *
 * Executes reads for the verified uid (from the Firebase ID token checked in
 * index.ts). Never allows the model to choose or override the uid.
 * Missing FIREBASE_SERVICE_ACCOUNT fails soft with an informative error.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { runAgentTool } from './agentTools/registry';
import { docId, type FirestoreRest } from './data/firestore';
import { fromFields } from './data/firestoreValue';
import { readExerciseHistory, readWorkoutSummary } from './data/shapes';
import { UserData } from './data/userData';
import { toToolDef } from './tools';

export interface ChatReadContext {
  uid?: string;
  data?: UserData;
  fs?: FirestoreRest;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const listHistorySchema = z
  .object({
    kind: z
      .enum(['workouts', 'exercises'])
      .default('workouts')
      .describe('workouts: finished sessions with totals. exercises: per-exercise logs with every set.'),
    from: z.string().regex(dateRegex, 'Use YYYY-MM-DD.').optional().describe('First day to include, YYYY-MM-DD.'),
    to: z.string().regex(dateRegex, 'Use YYYY-MM-DD.').optional().describe('Last day to include, YYYY-MM-DD.'),
    startDate: z.string().regex(dateRegex, 'Use YYYY-MM-DD.').optional().describe('Alias for from.'),
    endDate: z.string().regex(dateRegex, 'Use YYYY-MM-DD.').optional().describe('Alias for to.'),
    pageSize: z.number().int().min(1).max(50).default(20).describe('How many items to return (1-50).'),
    pageToken: z.string().optional().describe('nextPageToken from previous call to get the next page.'),
  })
  .strict();

export const getHistoryEntrySchema = z
  .object({
    id: z.string().min(1).describe('The history entry id (from list_history).'),
  })
  .strict();

export const listWorkoutsSchema = z
  .object({
    pageSize: z.number().int().min(1).max(50).default(20).describe('How many items to return (1-50).'),
    pageToken: z.string().optional().describe('nextPageToken from previous call.'),
  })
  .strict();

export const getWorkoutSchema = z
  .object({
    workoutId: z.string().min(1).describe('The saved workout id from list_workouts.'),
  })
  .strict();

// ---------------------------------------------------------------------------
// Anthropic Tool Definitions
// ---------------------------------------------------------------------------

export const chatReadTools: Anthropic.Tool[] = [
  toToolDef(
    'list_history',
    listHistorySchema.describe(
      'Read finished workouts or exercises, newest first (read-only). kind "workouts" gives sessions with totals; kind "exercises" gives per-exercise logs with sets. Filter with from/to (YYYY-MM-DD) and page with pageToken.',
    ),
  ),
  toToolDef(
    'get_history_entry',
    getHistoryEntrySchema.describe(
      'Read one workout history entry or exercise history entry in full with all sets by id.',
    ),
  ),
  toToolDef(
    'list_workouts',
    listWorkoutsSchema.describe("List the user's saved workout templates, newest first, with ids and exercise names."),
  ),
  toToolDef(
    'get_workout',
    getWorkoutSchema.describe('Read one saved workout template in full with every exercise, set, rep, weight and note.'),
  ),
];

export const READ_TOOL_NAMES = new Set([
  'list_history',
  'listHistory',
  'get_history_entry',
  'getHistoryEntry',
  'list_workouts',
  'listWorkouts',
  'get_workout',
  'getWorkout',
]);

export function isReadTool(name: string): boolean {
  return READ_TOOL_NAMES.has(name);
}

function normalizeToolName(name: string): 'list_history' | 'get_history_entry' | 'list_workouts' | 'get_workout' | null {
  if (name === 'list_history' || name === 'listHistory') return 'list_history';
  if (name === 'get_history_entry' || name === 'getHistoryEntry') return 'get_history_entry';
  if (name === 'list_workouts' || name === 'listWorkouts') return 'list_workouts';
  if (name === 'get_workout' || name === 'getWorkout') return 'get_workout';
  return null;
}

function extractDateKey(item: Record<string, unknown>, kind: 'workouts' | 'exercises'): string {
  if (kind === 'workouts') {
    const val = item.endTime || item.startTime;
    return typeof val === 'string' ? val.slice(0, 10) : '';
  }
  const val = item.workoutDate;
  return typeof val === 'string' ? val.slice(0, 10) : '';
}

// ---------------------------------------------------------------------------
// Tool Execution
// ---------------------------------------------------------------------------

export async function executeChatRead(
  rawName: string,
  rawInput: unknown,
  ctx: ChatReadContext,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const name = normalizeToolName(rawName);
  if (!name) return { ok: false, error: `Unknown read tool ${rawName}.` };

  if (!ctx.uid || (!ctx.data && !ctx.fs)) {
    return { ok: false, error: 'Workout history is unavailable: service account is not configured.' };
  }

  const data = ctx.data ?? new UserData(ctx.fs!, ctx.uid);
  const fs = ctx.fs;

  if (name === 'list_history') {
    const parsed = listHistorySchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { ok: false, error: `Invalid input: ${parsed.error.message}` };
    const { kind, from, to, startDate, endDate, pageSize, pageToken } = parsed.data;
    const minDate = from || startDate;
    const maxDate = to || endDate;

    // runAgentTool listHistoryInput is strict ({ kind, pageSize, pageToken })
    const res = await runAgentTool('list_history', { kind, pageSize, pageToken }, { data });
    if (!res.ok) return res;

    const page = res.result as { items?: Record<string, unknown>[]; nextPageToken?: string };
    let items = page.items ?? [];
    if (minDate || maxDate) {
      items = items.filter((item) => {
        const d = extractDateKey(item, kind);
        if (!d) return true;
        if (minDate && d < minDate) return false;
        if (maxDate && d > maxDate) return false;
        return true;
      });
    }
    return { ok: true, result: { items, ...(page.nextPageToken ? { nextPageToken: page.nextPageToken } : {}) } };
  }

  if (name === 'get_history_entry') {
    const parsed = getHistoryEntrySchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { ok: false, error: `Invalid input: ${parsed.error.message}` };
    const { id } = parsed.data;

    if (!fs) {
      return { ok: false, error: 'Firestore client is unavailable.' };
    }

    // Try workout_history first
    const workoutDoc = await fs.get(['users', ctx.uid, 'workout_history', id]).catch(() => null);
    if (workoutDoc && workoutDoc.fields) {
      const summary = readWorkoutSummary(id, fromFields(workoutDoc.fields));
      // Also fetch related exercise_history entries with sets
      const exerciseDocs = await fs.query(['users', ctx.uid], 'exercise_history', {
        orderBy: 'workoutDate',
        direction: 'DESCENDING',
        limit: 50,
      }).catch(() => []);
      const exercises = exerciseDocs
        .map((d) => readExerciseHistory(docId(d), fromFields(d.fields ?? {})))
        .filter((e) => (e as { workoutId?: string }).workoutId === id || (e as { workoutName?: string }).workoutName === summary.name);
      return { ok: true, result: { workout: summary, exercises } };
    }

    // Try exercise_history directly
    const exerciseDoc = await fs.get(['users', ctx.uid, 'exercise_history', id]).catch(() => null);
    if (exerciseDoc && exerciseDoc.fields) {
      const entry = readExerciseHistory(id, fromFields(exerciseDoc.fields));
      return { ok: true, result: { exercise: entry } };
    }

    return { ok: false, error: `No history entry found with id ${id}.` };
  }

  if (name === 'list_workouts') {
    const parsed = listWorkoutsSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { ok: false, error: `Invalid input: ${parsed.error.message}` };
    return runAgentTool('list_workouts', parsed.data, { data });
  }

  if (name === 'get_workout') {
    const parsed = getWorkoutSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { ok: false, error: `Invalid input: ${parsed.error.message}` };
    return runAgentTool('get_workout', parsed.data, { data });
  }

  return { ok: false, error: `Unsupported tool ${name}.` };
}
