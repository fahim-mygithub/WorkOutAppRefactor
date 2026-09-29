/**
 * Tool catalog for the `/ai` chat-with-tools surface.
 *
 * Each tool is defined ONCE as a Zod schema (the single source of truth) and
 * converted to the JSON Schema shape Anthropic's Messages API expects via
 * {@link zodToInputSchema}. The same Zod schemas are exported so the function
 * can validate the model's emitted `tool_use.input` before returning it to the
 * client.
 *
 * IMPORTANT (design §4): these tools describe *mutations the client may apply*
 * and the *chart vocabulary the client may render*. The function NEVER applies
 * a mutation server-side — it returns the structured tool calls to the client,
 * which presents an Apply/Reject confirmation UX. The tool handlers therefore
 * live entirely on the client; here we only define the contract.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared scalar vocabulary (kept consistent with src/types/exercise.ts)
// ---------------------------------------------------------------------------

const WeightUnit = z.enum(['lbs', 'kg']);

/** Identifies a target exercise inside the active workout. */
const exerciseRef = {
  exerciseId: z
    .string()
    .describe('The id of the WorkoutExercise in the active workout to act on.'),
};

const setRef = {
  ...exerciseRef,
  setId: z
    .string()
    .describe('The id of the WorkoutSet within the exercise to act on.'),
};

// ---------------------------------------------------------------------------
// Mutation tools (~10). Returned to the client, applied only on user Approve.
// ---------------------------------------------------------------------------

export const mutationToolSchemas = {
  swapExercise: z
    .object({
      ...exerciseRef,
      replacementExerciseId: z
        .string()
        .optional()
        .describe('Catalog Exercise.id to swap in, if known.'),
      replacementExerciseName: z
        .string()
        .optional()
        .describe(
          'Human-readable name of the replacement exercise when the catalog id is unknown; the client resolves it.',
        ),
      reason: z
        .string()
        .optional()
        .describe('Short justification shown to the user (e.g. "shoulder-friendly").'),
    })
    .describe('Replace one exercise with another (e.g. an equipment or injury substitution).'),

  reduceWeight: z
    .object({
      ...exerciseRef,
      setId: z
        .string()
        .optional()
        .describe('Optional specific set; omit to apply to all sets of the exercise.'),
      percent: z
        .number()
        .min(1)
        .max(90)
        .optional()
        .describe('Percentage to reduce the load by (1-90). Mutually exclusive with absolute.'),
      absolute: z
        .number()
        .positive()
        .optional()
        .describe('Absolute new weight value. Mutually exclusive with percent.'),
      unit: WeightUnit.optional().describe('Unit for an absolute value; defaults to the set unit.'),
    })
    .describe('Lower the working weight for an exercise or a single set.'),

  addBackoffSet: z
    .object({
      ...exerciseRef,
      percent: z
        .number()
        .min(1)
        .max(99)
        .default(90)
        .describe('Backoff load as a percent of the top set (default 90%).'),
      reps: z.number().int().positive().optional().describe('Target reps for the backoff set.'),
    })
    .describe('Append a lighter back-off set after the top set of an exercise.'),

  markFailedReps: z
    .object({
      ...setRef,
      completedReps: z
        .number()
        .int()
        .nonnegative()
        .describe('How many reps were actually completed before failure.'),
    })
    .describe('Record that a set was taken to failure, capturing the completed rep count.'),

  deloadExercise: z
    .object({
      ...exerciseRef,
      percent: z
        .number()
        .min(1)
        .max(90)
        .default(10)
        .describe('How much to deload by, as a percent of current load (default 10%).'),
    })
    .describe('Apply a deload to a single exercise (reduce load across all its sets).'),

  regenerateRoutine: z
    .object({
      scope: z
        .enum(['workout', 'exercise'])
        .default('workout')
        .describe('Whether to regenerate the whole workout or just one exercise.'),
      exerciseId: z
        .string()
        .optional()
        .describe('Required when scope is "exercise".'),
      goal: z
        .enum(['strength', 'hypertrophy', 'endurance', 'general'])
        .optional()
        .describe('Optional training goal to bias the regeneration.'),
      notes: z.string().optional().describe('Free-text constraints (time, equipment, injuries).'),
    })
    .describe('Regenerate the current routine (whole workout or a single exercise).'),

  adjustSetCount: z
    .object({
      ...exerciseRef,
      sets: z.number().int().min(1).max(20).describe('The desired total number of sets.'),
    })
    .describe('Set the total number of sets for an exercise (adds or removes trailing sets).'),

  adjustRestTime: z
    .object({
      ...exerciseRef,
      seconds: z
        .number()
        .int()
        .min(0)
        .max(900)
        .describe('New rest duration in seconds (0-900).'),
    })
    .describe('Change the rest-timer duration between sets for an exercise.'),

  addExercise: z
    .object({
      exerciseId: z.string().optional().describe('Catalog Exercise.id to add, if known.'),
      exerciseName: z
        .string()
        .optional()
        .describe('Name of the exercise to add when the catalog id is unknown.'),
      position: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe('Insertion index; omit to append to the end.'),
      sets: z.number().int().min(1).max(20).default(3).describe('Initial number of sets.'),
    })
    .describe('Add a new exercise to the active workout.'),

  removeExercise: z
    .object({
      ...exerciseRef,
      reason: z.string().optional().describe('Short justification shown to the user.'),
    })
    .describe('Remove an exercise from the active workout.'),

  createSuperset: z
    .object({
      exerciseIds: z
        .array(z.string())
        .min(2)
        .describe('Two or more WorkoutExercise ids to group into a superset, in order.'),
    })
    .describe('Group two or more existing exercises into a superset.'),
} as const;

// ---------------------------------------------------------------------------
// Chart vocabulary: renderChart({ kind, series, range, filter })
// ---------------------------------------------------------------------------

export const renderChartSchema = z
  .object({
    kind: z
      .enum(['line', 'bar', 'area', 'scatter', 'heatmap'])
      .describe('The chart type to render.'),
    series: z
      .array(
        z
          .enum([
            'volume',
            'estimated1rm',
            'topSetWeight',
            'reps',
            'rpe',
            'bodyweight',
            'sessionDuration',
            'frequency',
          ])
          .describe('A metric to plot.'),
      )
      .min(1)
      .describe('One or more metrics to plot as series.'),
    range: z
      .object({
        preset: z
          .enum(['7d', '30d', '90d', '6m', '1y', 'all'])
          .optional()
          .describe('A relative time range preset.'),
        from: z.string().optional().describe('ISO date (inclusive). Used when preset is absent.'),
        to: z.string().optional().describe('ISO date (inclusive). Used when preset is absent.'),
      })
      .optional()
      .describe('Time range for the chart; defaults to the client default when omitted.'),
    filter: z
      .object({
        exerciseId: z.string().optional().describe('Restrict to a single exercise.'),
        muscleGroup: z
          .string()
          .optional()
          .describe('Restrict to one muscle group (e.g. "Chest").'),
        unit: WeightUnit.optional().describe('Force a weight unit for weight-based series.'),
      })
      .optional()
      .describe('Optional filters narrowing the data set.'),
  })
  .describe(
    'Describe a chart for the client to render. Use this when the user asks to see, plot, ' +
      'graph, or visualize their training data. The function does not render anything; it ' +
      'returns this spec to the client.',
  );

// ---------------------------------------------------------------------------
// Assembly: Zod -> Anthropic tool definitions
// ---------------------------------------------------------------------------

/** Per-tool human descriptions surface in the API tool list via `.describe()`. */
const allToolSchemas = {
  ...mutationToolSchemas,
  renderChart: renderChartSchema,
} as const;

export type ToolName = keyof typeof allToolSchemas;

/** Runtime map used to validate `tool_use.input` emitted by the model. */
export const toolValidators: Record<ToolName, z.ZodTypeAny> = allToolSchemas;

/**
 * Minimal Zod -> JSON Schema conversion sufficient for the shapes used in this
 * catalog (objects of scalars/enums/arrays, optional + default + describe). We
 * hand-roll this to avoid pulling in `zod-to-json-schema` and to keep the
 * emitted schema flat and Anthropic-friendly (`additionalProperties: false`).
 */
function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  // Unwrap default/optional wrappers, remembering the description on the way.
  let description: string | undefined = schema.description;
  let current: z.ZodTypeAny = schema;

  // Peel wrappers (ZodDefault, ZodOptional) to reach the inner type.
  // We keep the outermost description.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (current instanceof z.ZodDefault) {
      current = current._def.innerType;
    } else if (current instanceof z.ZodOptional) {
      current = current._def.innerType;
    } else {
      break;
    }
    description = description ?? current.description;
  }

  const withDesc = (obj: Record<string, unknown>): Record<string, unknown> =>
    description ? { ...obj, description } : obj;

  if (current instanceof z.ZodString) {
    return withDesc({ type: 'string' });
  }
  if (current instanceof z.ZodNumber) {
    const isInt = current._def.checks.some((c) => c.kind === 'int');
    return withDesc({ type: isInt ? 'integer' : 'number' });
  }
  if (current instanceof z.ZodBoolean) {
    return withDesc({ type: 'boolean' });
  }
  if (current instanceof z.ZodEnum) {
    return withDesc({ type: 'string', enum: current._def.values });
  }
  if (current instanceof z.ZodArray) {
    return withDesc({ type: 'array', items: zodToJsonSchema(current._def.type) });
  }
  if (current instanceof z.ZodObject) {
    const shape = current._def.shape() as Record<string, z.ZodTypeAny>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value);
      // A field is required unless it is optional or has a default.
      const optional =
        value instanceof z.ZodOptional || value instanceof z.ZodDefault || value.isOptional();
      if (!optional) required.push(key);
    }
    const obj: Record<string, unknown> = {
      type: 'object',
      properties,
      additionalProperties: false,
    };
    if (required.length) obj.required = required;
    return withDesc(obj);
  }
  // Fallback for anything unexpected.
  return withDesc({ type: 'string' });
}

/** The full tool list passed to the Messages API for the `chat` action. */
export function buildToolDefs(): Anthropic.Tool[] {
  return (Object.keys(allToolSchemas) as ToolName[]).map((name) => {
    const schema = allToolSchemas[name];
    const inputSchema = zodToJsonSchema(schema);
    // The object-level description belongs on the tool, not the schema root.
    const { description, ...schemaRest } = inputSchema as {
      description?: string;
    } & Record<string, unknown>;
    // zodToJsonSchema always emits `type: 'object'` for the top-level object
    // schema; assert the literal so it satisfies Anthropic.Tool.InputSchema.
    const input_schema = { ...schemaRest, type: 'object' } as Anthropic.Tool.InputSchema;
    return {
      name,
      description: description ?? schema.description ?? name,
      input_schema,
    };
  });
}
