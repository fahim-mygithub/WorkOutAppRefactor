/**
 * Zod schemas for the `/ai` callable request envelope and the structured
 * output of the `parse` action.
 */
import { z } from 'zod';
import { flatLiftFields } from './tools';

const WeightUnit = z.enum(['lbs', 'kg']);

// ---------------------------------------------------------------------------
// parse action — natural language -> structured sets (Haiku 4.5)
// ---------------------------------------------------------------------------

/**
 * A single parsed set extracted from free text like
 * "bench 3x5 @ 185" or "ran 5k in 25 min".
 */
export const parsedSetSchema = z.object({
  exerciseName: z.string().describe('The exercise as named by the user.'),
  reps: z.number().int().nonnegative().nullable().describe('Reps per set, or null if not given.'),
  sets: z.number().int().positive().nullable().describe('Number of sets, or null if not given.'),
  weight: z.number().nonnegative().nullable().describe('Weight per rep, or null.'),
  unit: WeightUnit.nullable().describe('Weight unit, or null if not specified.'),
  rpe: z.number().min(1).max(10).nullable().describe('Rated perceived exertion 1-10, or null.'),
  timeSeconds: z.number().nonnegative().nullable().describe('Duration in seconds, or null.'),
  distanceMeters: z.number().nonnegative().nullable().describe('Distance in meters, or null.'),
  notes: z.string().nullable().describe('Any leftover qualifier (e.g. "to failure").'),
});

export type ParsedSet = z.infer<typeof parsedSetSchema>;

/** The full structured result the `parse` action returns to the client. */
export const parseResultSchema = z.object({
  exercises: z
    .array(
      z.object({
        exerciseName: z.string().describe('The exercise name.'),
        sets: z.array(parsedSetSchema).describe('The parsed sets for this exercise.'),
      }),
    )
    .describe('Exercises detected in the input, each with its sets.'),
});

export type ParseResult = z.infer<typeof parseResultSchema>;

// ---------------------------------------------------------------------------
// Request envelope (validated before any model call)
// ---------------------------------------------------------------------------

export const parseRequestSchema = z.object({
  action: z.literal('parse'),
  text: z.string().min(1).max(4000),
});

/** A single chat turn forwarded from the client. Text-only for safety. */
export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(20000),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

/**
 * Optional read-only context the client passes so the model can reference the
 * active workout and tracked lifts without us hard-coding shapes. Kept
 * permissive; the handler caps its serialized size.
 */
export const chatContextSchema = z
  .object({
    screen: z.enum(['workout', 'build', 'other']).optional(),
    units: WeightUnit.optional(),
    activeWorkout: z.unknown().optional(),
    trackedLifts: z.unknown().optional(),
    /** The exercise the lifter asked about (Ask coach). */
    focusExerciseId: z.string().optional(),
  })
  .partial();

export type ChatContext = z.infer<typeof chatContextSchema>;

export const chatRequestSchema = z.object({
  action: z.literal('chat'),
  messages: z.array(chatMessageSchema).min(1).max(50),
  context: chatContextSchema.optional(),
});

// ---------------------------------------------------------------------------
// readLift action — a described lift -> one tracked-lift entry (Haiku 4.5)
// ---------------------------------------------------------------------------

export const readLiftRequestSchema = z.object({
  action: z.literal('readLift'),
  text: z.string().min(1).max(500),
});

export const readLiftResultSchema = z
  .object({
    name: z.string().describe('Standard exercise name, e.g. "Front Squat".'),
    ...flatLiftFields,
    sets: z.number().int().min(1).max(10).nullable().optional().describe('Number of sets.'),
    rir: z.number().int().min(0).max(5).nullable().optional().describe('Reps in reserve.'),
    equipment: z
      .enum(['barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'bodyweight', 'band', 'other'])
      .nullable()
      .optional()
      .describe('Equipment kind.'),
    /** Load increment; capped so an absurd model step never reaches the engine. */
    step: z.number().positive().max(50).finite().nullable().optional().describe('Smallest load change, in unit.'),
    question: z.string().nullable().optional().describe('ONE short clarifying question, only if needed.'),
  })
  .describe('Submit the lift read from the description.');

/** Optional readLift fields dropped one by one when invalid (best effort). */
export const READ_LIFT_OPTIONAL_KEYS = ['sets', 'rir', 'equipment', 'step'] as const;

export type ReadLiftResult = z.infer<typeof readLiftResultSchema>;

// ---------------------------------------------------------------------------
// findExercise action — look up an exercise missing from the library (Sonnet +
// web search), with demo media verified server-side
// ---------------------------------------------------------------------------

export const findExerciseRequestSchema = z.object({
  action: z.literal('findExercise'),
  name: z.string().min(2).max(120),
});

export const exerciseLookupSchema = z
  .object({
    name: z.string().max(120).describe('Standard exercise name.'),
    aliasOf: z
      .string()
      .max(120)
      .optional()
      .describe('Common library name if this is a synonym (e.g. skull crusher → Lying Triceps Extension).'),
    muscleGroups: z.array(z.string().max(40)).min(1).describe('Primary muscles, e.g. ["Triceps"].'),
    equipment: z.string().max(60).describe('e.g. Barbell, Dumbbells, Cables, Bodyweight, Kettlebells, Bands.'),
    difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']),
    instructions: z.array(z.string().max(300)).min(2).max(8).describe('Numbered steps in your own words.'),
    mediaCandidates: z
      .array(z.string())
      .max(8)
      .describe('Direct https URLs ending in .mp4, .webm or .gif showing the movement.'),
  })
  .describe('Submit the exercise you found. Call exactly once.');

export type ExerciseLookup = z.infer<typeof exerciseLookupSchema>;

export const aiRequestSchema = z.discriminatedUnion('action', [
  parseRequestSchema,
  chatRequestSchema,
  readLiftRequestSchema,
  findExerciseRequestSchema,
]);

export type AiRequest = z.infer<typeof aiRequestSchema>;

/** JSON Schema for the `parse` action's structured output (hand-built, flat). */
export const parseOutputJsonSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['exercises'],
  properties: {
    exercises: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['exerciseName', 'sets'],
        properties: {
          exerciseName: { type: 'string' },
          sets: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'exerciseName',
                'reps',
                'sets',
                'weight',
                'unit',
                'rpe',
                'timeSeconds',
                'distanceMeters',
                'notes',
              ],
              properties: {
                exerciseName: { type: 'string' },
                reps: { type: ['integer', 'null'] },
                sets: { type: ['integer', 'null'] },
                weight: { type: ['number', 'null'] },
                unit: { type: ['string', 'null'], enum: ['lbs', 'kg', null] },
                rpe: { type: ['number', 'null'] },
                timeSeconds: { type: ['number', 'null'] },
                distanceMeters: { type: ['number', 'null'] },
                notes: { type: ['string', 'null'] },
              },
            },
          },
        },
      },
    },
  },
};
