/**
 * The agent tool registry: name, model-facing description, zod input and the
 * function that runs it against one user's data. Consumers (the MCP server
 * today, others later) import `agentTools` / `runAgentTool`; nothing here
 * knows about transports. The user is fixed by the `UserData` passed in —
 * no tool input can name one.
 */
import { z } from 'zod';
import { DataError, type UserData } from '../data/userData';
import {
  addExerciseInput,
  createWorkoutInput,
  getHistoryEntryInput,
  getProfileInput,
  getWorkoutInput,
  listHistoryInput,
  listPlansInput,
  listWorkoutsInput,
  logWorkoutInput,
  planWorkoutInput,
  updateHistoryEntryInput,
  updateProfileInput,
  updateWorkoutInput,
} from './schemas';

export interface AgentToolContext {
  data: UserData;
}

export interface AgentTool<S extends z.AnyZodObject = z.AnyZodObject> {
  name: string;
  title: string;
  description: string;
  input: S;
  /** Reads only: safe to call without asking. */
  readOnly: boolean;
  run(input: z.infer<S>, ctx: AgentToolContext): Promise<unknown>;
}

const define = <S extends z.AnyZodObject>(tool: AgentTool<S>): AgentTool => tool as unknown as AgentTool;

export const agentTools: readonly AgentTool[] = [
  define({
    name: 'get_profile',
    title: 'Get profile',
    description:
      "Read the user's profile: display name and training preferences (weight unit, default rest time, progression rate, theme) plus lifetime stats.",
    input: getProfileInput,
    readOnly: true,
    run: (_input, { data }) => data.getProfile(),
  }),
  define({
    name: 'update_profile',
    title: 'Update profile',
    description:
      'Change the display name or training preferences. Only the fields you send change. Email, sign-in and account settings cannot be changed here.',
    input: updateProfileInput,
    readOnly: false,
    run: (input, { data }) => data.updateProfile(input),
  }),
  define({
    name: 'list_workouts',
    title: 'List saved workouts',
    description:
      "List the user's saved workout templates, most recently updated first, with ids and exercise names. Use the id with get_workout, update_workout or plan_workout.",
    input: listWorkoutsInput,
    readOnly: true,
    run: (input, { data }) => data.listWorkouts(input),
  }),
  define({
    name: 'get_workout',
    title: 'Get a saved workout',
    description: 'Read one saved workout in full: every exercise with its sets, reps, weights, rest and notes.',
    input: getWorkoutInput,
    readOnly: true,
    run: (input, { data }) => data.getWorkout(input.workoutId),
  }),
  define({
    name: 'create_workout',
    title: 'Create workouts',
    description:
      'Save one or more new workout templates to the app (up to 10 per call). Each exercise has sets x reps (or a rep range with repsMax) at an optional weight. Returns the new ids. The workouts appear in the app on its next load.',
    input: createWorkoutInput,
    readOnly: false,
    run: async (input, { data }) => {
      for (const w of input.workouts) {
        if (w.exercises.length + (w.supersets?.length ?? 0) === 0) {
          throw new DataError('invalid-argument', `Workout "${w.name}" has no exercises.`);
        }
      }
      return { created: await data.createWorkouts(input.workouts) };
    },
  }),
  define({
    name: 'update_workout',
    title: 'Update a saved workout',
    description:
      'Change a saved workout. Only the fields you send change, but exercises and supersets are replaced as whole lists: call get_workout first and send the full list you want.',
    input: updateWorkoutInput,
    readOnly: false,
    run: (input, { data }) => {
      const { workoutId, ...patch } = input;
      return data.updateWorkout(workoutId, patch);
    },
  }),
  define({
    name: 'list_plans',
    title: 'List planned workouts',
    description:
      "List workouts on the user's calendar (status planned, done or skipped), in date order. Optionally limit to a date range.",
    input: listPlansInput,
    readOnly: true,
    run: async (input, { data }) => ({ plans: await data.listPlans(input) }),
  }),
  define({
    name: 'plan_workout',
    title: 'Plan a workout on a day',
    description:
      "Put a workout on the user's calendar for a day (YYYY-MM-DD): either a saved workout by workoutId, or a list of exercises with a name. Other plans are never touched. Pass planId to replace one existing plan (e.g. to move or change it).",
    input: planWorkoutInput,
    readOnly: false,
    run: async (input, { data }) => ({ plan: await data.planWorkout(input) }),
  }),
  define({
    name: 'list_history',
    title: 'List workout history',
    description:
      'Read finished workouts, newest first (read only). kind "workouts" gives one row per session with totals (use workout id with get_history_entry or update_history_entry); kind "exercises" gives one row per exercise performed with every set. Supports date filtering (from/to YYYY-MM-DD) and cursor/nextPageToken paging through the user\'s entire history.',
    input: listHistoryInput,
    readOnly: true,
    run: (input, { data }) => data.listHistory(input),
  }),
  define({
    name: 'get_history_entry',
    title: 'Get history entry',
    description:
      'Read one past workout session in full by workoutId: its date, duration, totals, and every exercise with all completed sets (reps, weight, unit, rpe, time), configuration, total volume, notes, and individual exercise history IDs.',
    input: getHistoryEntryInput,
    readOnly: true,
    run: (input, { data }) => data.getHistoryEntry(input.workoutId),
  }),
  define({
    name: 'log_workout',
    title: 'Log a past workout',
    description:
      'Log a completed workout session into the user\'s history (e.g. when the user dictates a past workout like "yesterday I did 4x8 bench at 185 and 3x10 rows at 135"). Date must be past or today (YYYY-MM-DD), never in the future. Supports optional tz (e.g. "America/New_York") or utcOffset to validate local today. Exercise names are resolved against the app library and custom exercises to store real exercise IDs, muscle groups, and equipment; unmatched names keep deterministic fallback IDs (fallback-<hash>) with Unknown muscle groups/equipment, reported in unmatchedExercises. Writes the workout session summary, creates per-exercise history records, and automatically updates lifetime exercise stats and personal records (PRs) exactly as if logged inside the app. Notes are stored per exercise (exercises[].notes) or per set (exercises[].sets[].notes), matching the app\'s history structure.',
    input: logWorkoutInput,
    readOnly: false,
    run: (input, { data }) => data.logWorkout(input),
  }),
  define({
    name: 'update_history_entry',
    title: 'Update a past workout',
    description:
      'Edit a past workout record (e.g. "change Tuesday\'s bench to 195" or fix reps/weight, add/remove sets, add/remove exercises, change date or name). Call get_history_entry first to get existing exercise IDs and sets. Supports explicit addSets / removeSetNumbers per exercise, explicit removeExerciseIds, and safe partial updates (unlisted exercises are never deleted unless replaceAllExercises: true or named in removeExerciseIds). Automatically recomputes the workout totals and recalculates affected exercise stats and personal records (PRs). Notes can be updated per exercise (exercises[].notes) or per set (exercises[].sets[].notes).',
    input: updateHistoryEntryInput,
    readOnly: false,
    run: (input, { data }) => data.updateHistoryEntry(input),
  }),
  define({
    name: 'add_exercise',
    title: 'Add a custom exercise',
    description:
      "Add an exercise to the user's custom exercise library, e.g. a machine from their gym: name, muscle groups, equipment, setup cues, and optional default sets/reps/weight.",
    input: addExerciseInput,
    readOnly: false,
    run: (input, { data }) => data.addExercise(input),
  }),
];

export const agentToolsByName: ReadonlyMap<string, AgentTool> = new Map(agentTools.map((t) => [t.name, t]));

export type AgentToolResult = { ok: true; result: unknown } | { ok: false; error: string };

function describeZodError(err: z.ZodError): string {
  return err.issues
    .map((i) => `${i.path.length ? i.path.join('.') : 'input'}: ${i.message}`)
    .join('; ');
}

/**
 * Validates `rawInput` against the tool's schema and runs it. Expected
 * failures (bad input, not found) come back as `{ ok: false }` with a message
 * the model can act on; anything else is thrown.
 */
export async function runAgentTool(name: string, rawInput: unknown, ctx: AgentToolContext): Promise<AgentToolResult> {
  const tool = agentToolsByName.get(name);
  if (!tool) return { ok: false, error: `Unknown tool ${name}.` };
  const parsed = tool.input.safeParse(rawInput ?? {});
  if (!parsed.success) return { ok: false, error: `Invalid input: ${describeZodError(parsed.error)}` };
  try {
    return { ok: true, result: await tool.run(parsed.data, ctx) };
  } catch (err) {
    if (err instanceof DataError) return { ok: false, error: err.message };
    throw err;
  }
}
