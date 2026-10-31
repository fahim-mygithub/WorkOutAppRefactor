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
import type { FirestoreRest } from './data/firestore';
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
    cursor: z.string().optional().describe('Cursor alias for pageToken.'),
  })
  .strict();

export const getHistoryEntrySchema = z
  .object({
    workoutId: z.string().min(1).optional().describe('The workout history entry id (from list_history).'),
    id: z.string().min(1).optional().describe('The history entry id (alias for workoutId).'),
  })
  .refine((data) => Boolean(data.workoutId || data.id), {
    message: 'Either workoutId or id must be provided.',
  });

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
      'Read one workout history entry in full with all sets and exercise IDs by workoutId (or id).',
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

  if (name === 'list_history') {
    const parsed = listHistorySchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { ok: false, error: `Invalid input: ${parsed.error.message}` };
    const { kind, from, to, startDate, endDate, pageSize, pageToken, cursor } = parsed.data;
    const minDate = from || startDate;
    const maxDate = to || endDate;
    const token = pageToken || cursor;

    return runAgentTool(
      'list_history',
      {
        kind,
        pageSize,
        ...(token ? { pageToken: token } : {}),
        ...(minDate ? { from: minDate } : {}),
        ...(maxDate ? { to: maxDate } : {}),
      },
      { data },
    );
  }

  if (name === 'get_history_entry') {
    const parsed = getHistoryEntrySchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { ok: false, error: `Invalid input: ${parsed.error.message}` };
    const workoutId = parsed.data.workoutId || parsed.data.id;
    return runAgentTool('get_history_entry', { workoutId }, { data });
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
