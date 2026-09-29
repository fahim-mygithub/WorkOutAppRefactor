/**
 * Tool catalog for the Worker's `chat` action.
 *
 * Each tool is defined ONCE as a Zod schema (the single source of truth) and
 * converted to the JSON Schema shape Anthropic's Messages API expects via
 * {@link zodToJsonSchema}. The same Zod schemas are exported so the Worker can
 * validate the model's emitted `tool_use.input` before returning it to the
 * client.
 *
 * The catalog is exactly the tools the client knows how to apply (design §2);
 * a tool without a client handler would produce a card that does nothing.
 * The Worker NEVER applies a mutation — it returns the structured tool calls
 * and the client applies them, tiered as auto (logSet, adjustSet: apply +
 * Undo) or confirm (the rest: Apply/Reject), re-checking every load.
 *
 * The hand-rolled converter supports objects of scalars/enums/arrays with
 * optional/default only (no unions), so load and target travel as flat fields
 * ({@link flatLiftFields}).
 */
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Tools the client applies
// ---------------------------------------------------------------------------

/** Flat load + target (the JSON-schema converter has no unions). Shared by
 *  updateBenchmark, addTrackedLift and the readLift action. */
export const flatLiftFields = {
  loadKind: z.enum(['weight', 'bodyweight', 'level']).describe('How the lift is loaded.'),
  weight: z.number().positive().finite().optional().describe('Load (weight) or added load (bodyweight).'),
  unit: z.enum(['lb', 'kg']).optional().describe('Unit for weight.'),
  level: z.string().optional().describe('Named step for level loads, e.g. "Med ball 6 kg", "Band: red", "Pin 12".'),
  targetKind: z.enum(['reps', 'repMax', 'time', 'none']).describe('What the benchmark measures.'),
  reps: z.number().int().positive().optional().describe('Reps (reps target: minimum; repMax: N).'),
  repsMax: z.number().int().positive().optional().describe('Top of a rep range.'),
  seconds: z.number().positive().finite().optional().describe('Hold time for time targets.'),
  tempo: z.string().optional().describe('Tempo such as "3-1-3".'),
};

export const mutationToolSchemas = {
  logSet: z
    .object({
      exerciseId: z.string().describe('WorkoutExercise id in the active workout.'),
      setIndex: z.number().int().nonnegative().optional().describe('Set to log; omit for the current set.'),
      reps: z.number().int().nonnegative().describe('Reps completed.'),
      weight: z.number().nonnegative().optional().describe('Load used, in the workout unit.'),
      rir: z.number().int().min(0).max(5).optional().describe('Reps in reserve, if the lifter said.'),
    })
    .describe('Record a set the lifter just described. Applies immediately with Undo.'),

  adjustSet: z
    .object({
      exerciseId: z.string().describe('WorkoutExercise id in the active workout.'),
      fromSetIndex: z.number().int().nonnegative().describe('First not-yet-done set to change; later sets change too.'),
      weight: z.number().positive().optional().describe('New load for those sets, in the workout unit.'),
      reps: z.number().int().positive().optional().describe('New target reps for those sets.'),
      reason: z.string().describe('One short line shown to the lifter.'),
    })
    .describe("Change today's remaining sets of one exercise. Applies immediately with Undo."),

  swapExercise: z
    .object({
      exerciseId: z.string().describe('WorkoutExercise id in the active workout.'),
      replacementExerciseName: z.string().describe('Library name of the replacement.'),
      scope: z.enum(['today', 'ongoing']).describe("'ongoing' also renames the tracked lift."),
      weight: z.number().positive().optional().describe('Starting load for the replacement, in the workout unit.'),
      reason: z.string().describe('One short line shown to the lifter.'),
    })
    .describe('Replace an exercise the lifter cannot do or keeps failing. Needs confirmation.'),

  updateBenchmark: z
    .object({
      liftId: z.string().describe('Tracked lift id.'),
      ...flatLiftFields,
      reason: z.string().describe('One short line shown to the lifter.'),
    })
    .describe('Change the benchmark future prescriptions derive from. Needs confirmation.'),

  addTrackedLift: z
    .object({
      name: z.string().describe('Exercise name, preferably the library name.'),
      category: z.string().describe('Existing category name, or a new one.'),
      ...flatLiftFields,
      sets: z.number().int().min(1).max(10).optional().describe('Accessory set count.'),
      progression: z.boolean().optional().describe('Track Volume/Strength/checkpoint progression.'),
    })
    .describe('Add a lift to the tracked list. Needs confirmation.'),

  removeTrackedLift: z
    .object({
      liftId: z.string().describe('Tracked lift id.'),
      reason: z.string().describe('One short line shown to the lifter.'),
    })
    .describe('Remove a lift from the tracked list. Needs confirmation.'),
} as const;

// ---------------------------------------------------------------------------
// Assembly: Zod -> Anthropic tool definitions
// ---------------------------------------------------------------------------

/** Per-tool human descriptions surface in the API tool list via `.describe()`. */
const allToolSchemas = { ...mutationToolSchemas } as const;

export type ToolName = keyof typeof allToolSchemas;

/** Runtime map used to validate `tool_use.input` emitted by the model. */
export const toolValidators: Record<ToolName, z.ZodTypeAny> = allToolSchemas;

/**
 * Minimal Zod -> JSON Schema conversion sufficient for the shapes used in this
 * catalog (objects of scalars/enums/arrays, optional + nullable + default +
 * describe, numeric min/max checks as minimum/exclusiveMinimum/maximum,
 * string min/max as minLength/maxLength, array min/max as minItems/maxItems). We
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
    } else if (current instanceof z.ZodNullable) {
      // Emitted as the inner type: tool inputs omit unknown fields rather than
      // send null (handleChat and handleReadLift also strip top-level nulls
      // before validating, as a safety net).
      current = current._def.innerType;
    } else {
      break;
    }
    description = description ?? current.description;
  }

  const withDesc = (obj: Record<string, unknown>): Record<string, unknown> =>
    description ? { ...obj, description } : obj;

  if (current instanceof z.ZodString) {
    const out: Record<string, unknown> = { type: 'string' };
    for (const check of current._def.checks) {
      if (check.kind === 'min') out.minLength = check.value;
      else if (check.kind === 'max') out.maxLength = check.value;
      else if (check.kind === 'length') out.minLength = out.maxLength = check.value;
    }
    return withDesc(out);
  }
  if (current instanceof z.ZodNumber) {
    const out: Record<string, unknown> = { type: 'number' };
    for (const check of current._def.checks) {
      if (check.kind === 'int') out.type = 'integer';
      else if (check.kind === 'min') out[check.inclusive ? 'minimum' : 'exclusiveMinimum'] = check.value;
      else if (check.kind === 'max') out[check.inclusive ? 'maximum' : 'exclusiveMaximum'] = check.value;
    }
    return withDesc(out);
  }
  if (current instanceof z.ZodBoolean) {
    return withDesc({ type: 'boolean' });
  }
  if (current instanceof z.ZodEnum) {
    return withDesc({ type: 'string', enum: current._def.values });
  }
  if (current instanceof z.ZodArray) {
    const out: Record<string, unknown> = { type: 'array', items: zodToJsonSchema(current._def.type) };
    if (current._def.minLength) out.minItems = current._def.minLength.value;
    if (current._def.maxLength) out.maxItems = current._def.maxLength.value;
    if (current._def.exactLength) out.minItems = out.maxItems = current._def.exactLength.value;
    return withDesc(out);
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

/** One Anthropic tool definition from a Zod object schema. The object-level
 *  description becomes the tool description. */
export function toToolDef(name: string, schema: z.ZodTypeAny): Anthropic.Tool {
  const inputSchema = zodToJsonSchema(schema);
  const { description, ...schemaRest } = inputSchema as {
    description?: string;
  } & Record<string, unknown>;
  // zodToJsonSchema always emits `type: 'object'` for an object schema;
  // assert the literal so it satisfies Anthropic.Tool.InputSchema.
  const input_schema = { ...schemaRest, type: 'object' } as Anthropic.Tool.InputSchema;
  return { name, description: description ?? schema.description ?? name, input_schema };
}

/** The full tool list passed to the Messages API for the `chat` action. */
export function buildToolDefs(): Anthropic.Tool[] {
  return (Object.keys(allToolSchemas) as ToolName[]).map((name) => toToolDef(name, allToolSchemas[name]));
}
