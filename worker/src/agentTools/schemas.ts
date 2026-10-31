/**
 * Input schemas for the agent tools. Every object is `.strict()`: a key the
 * schema doesn't name (a `uid`, a `userId`, a document path) is rejected,
 * never passed through. Descriptions are written for the model.
 */
import { z } from 'zod';

const unit = z.enum(['lbs', 'kg']).describe('Weight unit. Defaults to lbs.');

/** Firestore auto-id style: letters, digits, `_` and `-` only. */
const docId = (what: string) =>
  z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,128}$/, `Not a valid ${what} id.`)
    .describe(`The ${what} id, exactly as a list or create tool returned it.`);

const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.')
  .refine((s) => {
    const [y, m, d] = s.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }, 'Not a real calendar date.');

const pageSize = z.number().int().min(1).max(50).default(20).describe('How many items to return (1-50).');
const pageToken = z
  .string()
  .regex(/^\d{1,6}$/)
  .optional()
  .describe('nextPageToken from the previous call, to get the next page.');

export const exerciseInput = z
  .object({
    name: z.string().trim().min(1).max(120).describe('Exercise name, e.g. "Barbell Bench Press" or "Leg Press".'),
    sets: z.number().int().min(1).max(20).describe('Number of working sets.'),
    reps: z.number().int().min(1).max(100).describe('Reps per set. With repsMax, the bottom of the rep range.'),
    repsMax: z.number().int().min(1).max(100).optional().describe('Top of the rep range, e.g. reps 8 + repsMax 12 = 8-12.'),
    weight: z.number().min(0).max(2000).optional().describe('Working weight per set. Omit for bodyweight.'),
    unit: unit.optional(),
    notes: z.string().max(500).optional().describe('Cues or notes for this exercise.'),
    restSeconds: z.number().int().min(0).max(900).optional().describe('Rest between sets in seconds.'),
  })
  .strict();

const superset = z
  .array(exerciseInput)
  .min(2)
  .max(4)
  .describe('Exercises done back to back as one superset.');

const category = z.enum(['Strength', 'Cardio', 'Flexibility', 'Sports', 'Other']);
const difficulty = z.enum(['Beginner', 'Intermediate', 'Advanced']);

/** Media URLs end up in the app's <video>/<img> src: https only (no http:, javascript:, data:). */
const httpsUrl = z
  .string()
  .url()
  .max(1000)
  .refine((u) => u.toLowerCase().startsWith('https://'), 'Media URL must be https.');

const workoutFields = {
  name: z.string().trim().min(1).max(100).describe('Workout name shown in the app, e.g. "Push Day A".'),
  description: z.string().max(500).optional(),
  exercises: z.array(exerciseInput).max(30).describe('Exercises in order.'),
  supersets: z.array(superset).max(10).optional().describe('Supersets, done after the exercises.'),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  category: category.optional().describe('Defaults to Strength.'),
  difficulty: difficulty.optional().describe('Defaults to Intermediate.'),
};

export const workoutInput = z.object(workoutFields).strict();

export const getProfileInput = z.object({}).strict();

export const updateProfileInput = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    preferences: z
      .object({
        theme: z.enum(['light', 'dark', 'system']).optional(),
        unitSystem: z.enum(['metric', 'imperial']).optional(),
        weightUnit: unit.optional(),
        defaultRestTime: z.number().int().min(0).max(900).optional().describe('Default rest between sets, seconds.'),
        autoStartTimer: z.boolean().optional().describe('Start the rest timer automatically after a set.'),
        defaultProgressionRate: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const listWorkoutsInput = z.object({ pageSize, pageToken }).strict();

export const getWorkoutInput = z.object({ workoutId: docId('saved workout') }).strict();

export const createWorkoutInput = z
  .object({
    workouts: z.array(workoutInput).min(1).max(10).describe('One or more workouts to save (up to 10 per call).'),
  })
  .strict();

export const updateWorkoutInput = z
  .object({
    workoutId: docId('saved workout'),
    name: workoutFields.name.optional(),
    description: workoutFields.description,
    exercises: z
      .array(exerciseInput)
      .max(30)
      .optional()
      .describe('Replaces the whole exercise list. Get the workout first and send every exercise you want to keep.'),
    supersets: z.array(superset).max(10).optional().describe('Replaces all supersets.'),
    tags: workoutFields.tags,
    category: workoutFields.category,
    difficulty: workoutFields.difficulty,
  })
  .strict();

export const listPlansInput = z
  .object({
    from: dateKey.optional().describe('First day to include, YYYY-MM-DD.'),
    to: dateKey.optional().describe('Last day to include, YYYY-MM-DD.'),
  })
  .strict();

export const planWorkoutInput = z
  .object({
    dateKey: dateKey.describe('The day to do it, YYYY-MM-DD in the user\'s local calendar.'),
    workoutId: docId('saved workout').optional().describe('Plan a saved workout (from list_workouts).'),
    exercises: z.array(exerciseInput).max(30).optional().describe('Or plan these exercises directly.'),
    supersets: z.array(superset).max(10).optional(),
    name: z.string().trim().min(1).max(100).optional().describe('Required with exercises; defaults to the saved workout\'s name.'),
    planId: docId('plan').optional().describe('Replace this existing plan (from list_plans) instead of adding a new one.'),
  })
  .strict();

export const listHistoryInput = z
  .object({
    kind: z
      .enum(['workouts', 'exercises'])
      .default('workouts')
      .describe('workouts: finished sessions with totals. exercises: per-exercise logs with every set.'),
    pageSize,
    pageToken,
    cursor: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,128}$/)
      .optional()
      .describe('Cursor (or nextPageToken) from previous call to page through history.'),
    from: dateKey.optional().describe('First day to include, YYYY-MM-DD.'),
    to: dateKey.optional().describe('Last day to include, YYYY-MM-DD.'),
  })
  .strict();

export const performedSetInput = z
  .object({
    reps: z.number().int().min(1).max(200).describe('Reps completed in this set.'),
    weight: z.number().min(0).max(2000).optional().describe('Weight lifted. 0 or omit for bodyweight.'),
    unit: unit.optional(),
    rpe: z.number().min(1).max(10).optional().describe('Rate of Perceived Exertion (1-10).'),
    time: z.number().int().min(0).max(3600).optional().describe('Duration in seconds if timed.'),
    rir: z.number().min(0).max(10).optional().describe('Reps in reserve.'),
    completed: z.boolean().optional().describe('Defaults to true for logged workouts.'),
    notes: z.string().max(500).optional().describe('Notes for this set.'),
  })
  .strict();

export const exerciseHistoryInput = z
  .object({
    id: docId('exercise').optional().describe('Exercise ID if known (from search_exercises or add_exercise).'),
    name: z.string().trim().min(1).max(120).optional().describe('Exercise name, e.g. "Barbell Bench Press" or "Chest Supported Row".'),
    sets: z.array(performedSetInput).min(1).max(30).describe('Sets completed, in order.'),
    notes: z.string().max(500).optional().describe('Notes for this exercise.'),
    customTitle: z.string().trim().max(120).optional().describe('Optional custom variation display name.'),
  })
  .strict()
  .refine((d) => Boolean(d.id || d.name), {
    message: 'Either id or name must be provided.',
  });

export const logWorkoutInput = z
  .object({
    date: dateKey.describe(
      'Date the workout took place, YYYY-MM-DD. Must be past or today, never future in the user\'s local calendar.',
    ),
    tz: z
      .string()
      .trim()
      .max(50)
      .optional()
      .describe('User timezone, e.g. "America/New_York" or "Asia/Tokyo". Used to validate local "today".'),
    utcOffset: z
      .number()
      .int()
      .min(-840)
      .max(840)
      .optional()
      .describe('User UTC offset in minutes (e.g. -300 for UTC-5, +540 for UTC+9).'),
    name: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .describe('Workout name, e.g. "Push Day" or "Upper Body Heavy". Defaults to "Workout".'),
    durationMinutes: z
      .number()
      .int()
      .min(1)
      .max(1440)
      .optional()
      .describe('Total workout duration in minutes if known.'),
    exercises: z
      .array(exerciseHistoryInput)
      .min(1)
      .max(40)
      .describe(
        'Exercises performed with completed sets (reps, weight, unit, rpe/time). Exercise names are matched to the library and custom exercises; unmatched names keep fallback IDs. Notes are attached per exercise or set.',
      ),
  })
  .strict();

export const getHistoryEntryInput = z
  .object({
    workoutId: docId('workout history').describe('The workout history entry id (from list_history or log_workout).'),
  })
  .strict();

export const updateHistoryExerciseInput = z
  .object({
    id: docId('exercise history')
      .optional()
      .describe('The exercise history id if updating an existing exercise in this workout. Omit to add a new exercise.'),
    name: z.string().trim().min(1).max(120).describe('Exercise name.'),
    sets: z
      .array(performedSetInput)
      .min(1)
      .max(30)
      .optional()
      .describe('Sets performed. Replaces existing sets for this exercise. Alternatively use addSets / removeSetNumbers.'),
    addSets: z
      .array(performedSetInput)
      .min(1)
      .max(20)
      .optional()
      .describe('Explicitly append new sets to this exercise.'),
    removeSetNumbers: z
      .array(z.number().int().min(1).max(30))
      .min(1)
      .max(30)
      .optional()
      .describe('Explicitly remove sets by 1-based set number.'),
    notes: z.string().max(500).optional().describe('Notes for this exercise.'),
    customTitle: z.string().trim().max(120).optional(),
  })
  .strict();

export const updateHistoryEntryInput = z
  .object({
    workoutId: docId('workout history').describe('The workout history entry id to update.'),
    date: dateKey.optional().describe('New workout date (YYYY-MM-DD, past or today).'),
    tz: z
      .string()
      .trim()
      .max(50)
      .optional()
      .describe('User timezone, e.g. "America/New_York" or "Asia/Tokyo". Used to validate local "today".'),
    utcOffset: z
      .number()
      .int()
      .min(-840)
      .max(840)
      .optional()
      .describe('User UTC offset in minutes (e.g. -300 for UTC-5, +540 for UTC+9).'),
    name: z.string().trim().min(1).max(100).optional().describe('New workout name.'),
    durationMinutes: z.number().int().min(1).max(1440).optional().describe('New duration in minutes.'),
    exercises: z
      .array(updateHistoryExerciseInput)
      .min(1)
      .max(40)
      .optional()
      .describe(
        'Exercises to update or add. By default, unlisted exercises in the workout are NOT deleted unless named in removeExerciseIds or replaceAllExercises is true.',
      ),
    removeExerciseIds: z
      .array(docId('exercise history'))
      .min(1)
      .max(40)
      .optional()
      .describe('Explicitly remove these exercises from the workout by their exercise history IDs.'),
    replaceAllExercises: z
      .boolean()
      .optional()
      .describe('If true, replaces the entire exercise list: any existing exercise not in exercises will be removed.'),
  })
  .strict();

export const addExerciseInput = z
  .object({
    name: z.string().trim().min(1).max(120).describe('Exercise name, e.g. "Hammer Strength Iso-Lateral Row".'),
    muscleGroups: z.array(z.string().trim().min(1).max(40)).min(1).max(6).describe('e.g. ["Back", "Biceps"].'),
    equipment: z.string().trim().min(1).max(60).describe('e.g. "Machine", "Cable", "Dumbbells".'),
    setupCues: z.array(z.string().trim().min(1).max(200)).max(10).optional().describe('Seat height, grip, pin settings, form cues.'),
    defaultSets: z.number().int().min(1).max(20).optional(),
    defaultReps: z.number().int().min(1).max(100).optional(),
    defaultWeight: z.number().min(0).max(2000).optional(),
    unit: unit.optional(),
    difficulty: difficulty.optional(),
    notes: z.string().max(500).optional(),
    media_url: httpsUrl.optional().describe('Optional media URL (photo, gif, or video) for the exercise.'),
  })
  .strict();

export const searchExercisesInput = z
  .object({
    query: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .describe('Search query, e.g. "bench", "chest", "cable row", or machine name.'),
  })
  .strict();

export const updateExerciseInput = z
  .object({
    exercise_id: docId('custom exercise').describe('The custom exercise ID to update.'),
    name: z.string().trim().min(1).max(120).optional().describe('New exercise name.'),
    muscles: z.array(z.string().trim().min(1).max(40)).min(1).max(6).optional().describe('Muscle groups.'),
    equipment: z.string().trim().min(1).max(60).optional().describe('Equipment type.'),
    setupCues: z.array(z.string().trim().min(1).max(200)).max(10).optional().describe('Setup cues or instructions.'),
    notes: z.string().max(500).optional().describe('Notes.'),
    media: httpsUrl.optional().describe('Media URL for the exercise.'),
  })
  .strict();

export const attachMediaFromUrlInput = z
  .object({
    exercise_id: docId('custom exercise').describe('The custom exercise ID to attach media to.'),
    url: z.string().url().max(2000).describe('Public HTTPS URL of the photo, gif, or video file.'),
  })
  .strict();

export const createMediaUploadLinkInput = z
  .object({
    exercise_id: docId('custom exercise').describe('The custom exercise ID to generate an upload link for.'),
  })
  .strict();
