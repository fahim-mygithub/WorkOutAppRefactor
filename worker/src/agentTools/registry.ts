/**
 * The agent tool registry: name, model-facing description, zod input and the
 * function that runs it against one user's data. Consumers (the MCP server
 * today, others later) import `agentTools` / `runAgentTool`; nothing here
 * knows about transports. The user is fixed by the `UserData` passed in —
 * no tool input can name one.
 */
import { z } from 'zod';
import { DataError, DuplicateExerciseError, type UserData } from '../data/userData';
import type { SearchExerciseResult } from '../data/exerciseIndex';
import { MediaConfigError, StorageFullError, type MediaQuota } from '../media/quota';
import {
  addExerciseInput,
  attachMediaFromUrlInput,
  createMediaUploadLinkInput,
  createWorkoutInput,
  getHistoryEntryInput,
  getProfileInput,
  getWorkoutInput,
  listHistoryInput,
  listPlansInput,
  listWorkoutsInput,
  logWorkoutInput,
  planWorkoutInput,
  searchExercisesInput,
  updateExerciseInput,
  updateHistoryEntryInput,
  updateProfileInput,
  updateWorkoutInput,
} from './schemas';

export interface AgentToolContext {
  data: UserData;
  /** Media quota for this user; the media tools check it before doing any work. */
  mediaQuota?: MediaQuota;
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
      'Log a completed workout session into the user\'s history (e.g. when the user dictates a past workout or from a machine snapshot). Date must be past or today (YYYY-MM-DD), never in the future. Accepts exercises by name or by id from search_exercises/add_exercise. Supports optional tz (e.g. "America/New_York") or utcOffset to validate local today. Exercise names are resolved against the app library and custom exercises to store real exercise IDs, muscle groups, and equipment; unmatched names keep deterministic fallback IDs (fallback-<hash>) with Unknown muscle groups/equipment, reported in unmatchedExercises. In the snapshot flow: read the photo -> search_exercises -> add_exercise if missing -> log_workout or plan -> offer create_media_upload_link to save the photo/clip.',
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
      "Add an exercise to the user's custom exercise library, e.g. a machine from their gym: name, muscle groups, equipment, setup cues, media_url, and optional default sets/reps/weight. Refuses near-duplicates of library or custom exercises and returns the match {id, name, custom, muscleGroups, equipment}. In the snapshot flow: read the photo -> search_exercises -> add_exercise if missing -> log_workout or plan -> offer create_media_upload_link to save the photo/clip.",
    input: addExerciseInput,
    readOnly: false,
    run: (input, { data }) => data.addExercise(input),
  }),
  define({
    name: 'search_exercises',
    title: 'Search exercises',
    description:
      'Search the exercise library and custom exercises by query (names, muscles, equipment). Returns {results, total, returned, truncated} where total is the real count of matching exercises across the library and custom exercises, and results contains up to limit matches (default 10, max 30). In the snapshot flow: read the photo -> search_exercises -> add_exercise if missing -> log_workout or plan -> offer create_media_upload_link to save the photo/clip.',
    input: searchExercisesInput,
    readOnly: true,
    run: async (input, { data }) => {
      const raw = (await data.searchExercises(input.query)) as any;
      const inner = raw?.exercises ?? raw;
      const all: SearchExerciseResult[] = Array.isArray(inner?.allMatches)
        ? inner.allMatches
        : Array.isArray(inner?.results)
          ? inner.results
          : Array.isArray(inner)
            ? inner
            : [];
      const total = typeof inner?.total === 'number' ? inner.total : all.length;
      const limit = input.limit ?? 10;
      const results = all.slice(0, limit);
      const returned = results.length;
      const truncated = total > returned;
      return {
        results,
        exercises: results,
        total,
        returned,
        truncated,
      };
    },
  }),
  define({
    name: 'update_exercise',
    title: 'Update a custom exercise',
    description:
      "Update a custom exercise in the user's library: change name, muscle groups, equipment, instructions/setup cues, notes, or media. Cannot update built-in library exercises.",
    input: updateExerciseInput,
    readOnly: false,
    run: (input, { data }) => data.updateExercise(input),
  }),
  define({
    name: 'attach_media_from_url',
    title: 'Attach media from URL',
    description:
      'Fetch an image, gif, or video from a public HTTPS URL and attach it to a custom exercise. Validates size caps (photos <= 8MB, gif <= 15MB, video <= 60MB) and magic bytes, stores in R2 media storage, and attaches to the exercise.',
    input: attachMediaFromUrlInput,
    readOnly: false,
    run: async (input, { data, mediaQuota }) => {
      await mediaQuota?.assertRoom();
      return data.attachMediaFromUrl(input.exercise_id, input.url);
    },
  }),
  define({
    name: 'create_media_upload_link',
    title: 'Create media upload link',
    description:
      'Generate a temporary, single-use upload link (valid for 15 minutes) for the user to upload a photo or video directly from their camera or device to attach to a custom exercise. In the snapshot flow: read the photo -> search_exercises -> add_exercise if missing -> log_workout or plan -> offer create_media_upload_link to save the photo/clip.',
    input: createMediaUploadLinkInput,
    readOnly: false,
    run: async (input, { data, mediaQuota }) => {
      await mediaQuota?.assertRoom();
      return data.createMediaUploadLink(input.exercise_id);
    },
  }),
];

export const agentToolsByName: ReadonlyMap<string, AgentTool> = new Map(agentTools.map((t) => [t.name, t]));

export type AgentToolResult = { ok: true; result: unknown } | { ok: false; error: string; match?: unknown };

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
    if (err instanceof DuplicateExerciseError) {
      const rawMatch = (err.match ?? {}) as Record<string, unknown>;
      const match = {
        id: rawMatch.id,
        name: rawMatch.name,
        custom: rawMatch.custom ?? rawMatch.isCustom ?? false,
        isCustom: rawMatch.isCustom ?? rawMatch.custom ?? false,
        muscleGroups: rawMatch.muscleGroups ?? [],
        equipment: rawMatch.equipment ?? 'Unknown',
      };
      return { ok: false, error: err.message, match };
    }
    if (err instanceof DataError) return { ok: false, error: err.message };
    // storage_full / bad media config: a plain message the model can relay.
    if (err instanceof StorageFullError || err instanceof MediaConfigError) return { ok: false, error: err.message };
    throw err;
  }
}
