/**
 * The `parse` and `chat` actions (ported from the never-deployed Firebase
 * function). The Anthropic client is passed in so the router owns the key and
 * tests can inject a fake.
 *
 *   parse: free text -> structured sets (FAST_MODEL)
 *   chat:  tool-use; tool calls are validated and returned, never applied here.
 *   readLift: a described lift -> one tracked-lift entry (FAST_MODEL, forced
 *             submitLift tool so the shape is fixed)
 *
 * Both put the system prompt behind cache_control so the prefix is cached.
 */
import Anthropic from '@anthropic-ai/sdk';
import { AiError } from './errors';
import { FAST_MODEL, SMART_MODEL } from './models';
import { CHAT_SYSTEM_PROMPT, PARSE_SYSTEM_PROMPT, READ_LIFT_SYSTEM_PROMPT } from './prompts';
import {
  parseOutputJsonSchema,
  parseResultSchema,
  READ_LIFT_OPTIONAL_KEYS,
  readLiftResultSchema,
  type ChatContext,
  type ChatMessage,
  type ParseResult,
  type ReadLiftResult,
} from './schemas';
import { buildToolDefs, toToolDef, toolValidators, type ToolName } from './tools';

/** Largest serialized chat context accepted (characters). */
const MAX_CONTEXT_CHARS = 40_000;

export function makeClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

// ---------------------------------------------------------------------------
// parse action
// ---------------------------------------------------------------------------

/** Strip optional markdown code fences and return the JSON substring. */
export function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();
  // Otherwise take from the first { to the last } to be forgiving of preambles.
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    return trimmed.slice(first, last + 1);
  }
  return trimmed;
}

export async function handleParse(client: Anthropic, text: string): Promise<ParseResult> {
  // The JSON Schema is appended to the (cached) system prompt so the prefix
  // stays byte-stable across requests; the user's text is the only volatile
  // content. Zod (parseResultSchema) is the authoritative guard.
  const response = await client.messages.create({
    model: FAST_MODEL,
    max_tokens: 2048,
    system: [
      {
        type: 'text',
        text:
          `${PARSE_SYSTEM_PROMPT}\n\nReturn ONLY a JSON object (no prose, no code fences) ` +
          `matching this JSON Schema:\n${JSON.stringify(parseOutputJsonSchema)}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: text }],
  });

  const block = response.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') {
    throw new AiError('internal', 'Parse model returned no text content.');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(extractJson(block.text));
  } catch {
    throw new AiError('internal', 'Parse model returned invalid JSON.');
  }

  const result = parseResultSchema.safeParse(raw);
  if (!result.success) {
    console.warn('parse output failed schema validation', JSON.stringify(result.error.issues));
    throw new AiError('internal', 'Parse output did not match the expected schema.');
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// readLift action
// ---------------------------------------------------------------------------

/** The single tool readLift must answer with; its input is the lift. */
export const submitLiftTool: Anthropic.Tool = toToolDef('submitLift', readLiftResultSchema);

/** Drop top-level null values: the model sometimes writes `weight: null` for a
 *  field it does not know, which the shared lift fields treat as absent. */
function withoutNulls(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== null));
}

/** Best effort: drop each optional field that fails its own schema, so one
 *  bad optional (e.g. step 500) does not sink an otherwise good lift. */
function withoutInvalidOptionals(raw: Record<string, unknown>): Record<string, unknown> {
  const out = { ...raw };
  const dropped: string[] = [];
  for (const key of READ_LIFT_OPTIONAL_KEYS) {
    if (key in out && !readLiftResultSchema.shape[key].safeParse(out[key]).success) {
      delete out[key];
      dropped.push(key);
    }
  }
  if (dropped.length) console.warn('readLift dropped invalid optional fields', dropped);
  return out;
}

export async function handleReadLift(client: Anthropic, text: string): Promise<ReadLiftResult> {
  const response = await client.messages.create({
    model: FAST_MODEL,
    max_tokens: 512,
    system: [{ type: 'text', text: READ_LIFT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: [submitLiftTool],
    tool_choice: { type: 'tool', name: submitLiftTool.name },
    messages: [{ role: 'user', content: text }],
  });
  const block = response.content.find((b) => b.type === 'tool_use' && b.name === submitLiftTool.name);
  if (!block || block.type !== 'tool_use') throw new AiError('internal', 'No lift in the reply.');
  const raw = withoutNulls(block.input);
  if (!raw) throw new AiError('internal', 'Reply did not match the lift schema.');
  const result = readLiftResultSchema.safeParse(withoutInvalidOptionals(raw));
  if (!result.success) {
    console.warn('readLift output failed schema validation', JSON.stringify(result.error.issues));
    throw new AiError('internal', 'Reply did not match the lift schema.');
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// chat action (tool-use). Mutations are NOT applied — we return the tool calls.
// ---------------------------------------------------------------------------

export interface ChatToolCall {
  id: string;
  name: ToolName;
  input: unknown;
}

export interface ChatResult {
  text: string;
  toolCalls: ChatToolCall[];
  stopReason: string | null;
}

/** Throws invalid-argument when the serialized context is over the cap. The
 *  router calls this before counting the request against the daily limit. */
export function assertContextSize(context: ChatContext | undefined): void {
  if (context && JSON.stringify(context).length > MAX_CONTEXT_CHARS) {
    throw new AiError('invalid-argument', 'Context too large.');
  }
}

export function buildContextPreamble(context: ChatContext | undefined): string | null {
  if (!context) return null;
  assertContextSize(context);
  // Rides in a user turn (not the cached system prompt) so it never
  // invalidates the cached prefix.
  return `CONTEXT (read-only, current app state):\n${JSON.stringify(context)}`;
}

export async function handleChat(
  client: Anthropic,
  messages: ChatMessage[],
  context: ChatContext | undefined,
): Promise<ChatResult> {
  const apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Read-only context goes first, in a user message.
  const preamble = buildContextPreamble(context);
  if (preamble) {
    apiMessages.unshift({ role: 'user', content: preamble });
  }

  const response = await client.messages.create({
    model: SMART_MODEL,
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: CHAT_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    tools: buildToolDefs(),
    messages: apiMessages,
  });

  const textParts: string[] = [];
  const toolCalls: ChatToolCall[] = [];

  for (const block of response.content) {
    if (block.type === 'text') {
      textParts.push(block.text);
    } else if (block.type === 'tool_use') {
      const name = block.name as ToolName;
      const validator = toolValidators[name];
      if (!validator) {
        console.warn('model emitted unknown tool', name);
        continue;
      }
      // Drop malformed calls rather than forward them to the client.
      const parsed = validator.safeParse(block.input);
      if (!parsed.success) {
        console.warn('tool input failed validation; dropping call', name, JSON.stringify(parsed.error.issues));
        continue;
      }
      toolCalls.push({ id: block.id, name, input: parsed.data });
    }
  }

  return {
    text: textParts.join('\n').trim(),
    toolCalls,
    stopReason: response.stop_reason,
  };
}
