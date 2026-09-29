/**
 * Zod schemas for the Worker's request envelope (POST / body, discriminated on
 * `action`) and the structured results of the readLift and findExercise actions.
 */
import { z } from 'zod';
import { flatLiftFields } from './tools';

const WeightUnit = z.enum(['lbs', 'kg']);

// ---------------------------------------------------------------------------
// Request envelope (validated before any model call)
// ---------------------------------------------------------------------------

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
    muscleGroups: z.array(z.string().max(40)).min(1).max(6).describe('Primary muscles, e.g. ["Triceps"].'),
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
  chatRequestSchema,
  readLiftRequestSchema,
  findExerciseRequestSchema,
]);

export type AiRequest = z.infer<typeof aiRequestSchema>;
