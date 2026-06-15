/**
 * Zod schemas for the `/ai` callable request envelope and the structured
 * output of the `parse` action.
 */
import { z } from 'zod';

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
 * Optional context the client passes so the model can reference the active
 * workout and recent history without us hard-coding shapes. Kept permissive
 * (passthrough) but size-bounded by the overall request limits.
 */
export const chatContextSchema = z
  .object({
    activeWorkout: z.unknown().optional(),
    recentHistory: z.unknown().optional(),
    units: WeightUnit.optional(),
    goal: z.string().optional(),
  })
  .partial();

export type ChatContext = z.infer<typeof chatContextSchema>;

export const chatRequestSchema = z.object({
  action: z.literal('chat'),
  messages: z.array(chatMessageSchema).min(1).max(50),
  context: chatContextSchema.optional(),
});

export const aiRequestSchema = z.discriminatedUnion('action', [
  parseRequestSchema,
  chatRequestSchema,
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
