/**
 * The `chat` and `readLift` actions (findExercise lives in findExercise.ts,
 * readMachine in readMachine.ts).
 * The Anthropic client is passed in so the router owns the key and tests can
 * inject a fake.
 *
 *   chat:     tool-use; server-side read tools run automatically for the verified
 *             uid in a loop (cap 6 rounds); mutation tool calls are validated and
 *             returned to the client.
 *   readLift: a described lift -> one tracked-lift entry (FAST_MODEL, forced
 *             submitLift tool so the shape is fixed)
 *
 * Both put the system prompt behind cache_control so the prefix is cached.
 */
import Anthropic from '@anthropic-ai/sdk';
import { chatReadTools, executeChatRead, isReadTool, type ChatReadContext } from './chatReads';
import type { FirestoreRest } from './data/firestore';
import type { UserData } from './data/userData';
import { AiError } from './errors';
import { FAST_MODEL, SMART_MODEL } from './models';
import { CHAT_SYSTEM_PROMPT, READ_LIFT_SYSTEM_PROMPT } from './prompts';
import {
  READ_LIFT_OPTIONAL_KEYS,
  readLiftResultSchema,
  type ChatContext,
  type ChatMessage,
  type ImageInput,
  type ReadLiftResult,
} from './schemas';
import { buildToolDefs, toToolDef, toolValidators, type ToolName } from './tools';

/** Largest serialized chat context accepted (characters). */
const MAX_CONTEXT_CHARS = 40_000;

/** Maximum read-tool loop iterations per chat turn. */
const MAX_TOOL_ROUNDS = 6;

export function makeClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

/** A validated photo as an Anthropic image block. */
export function imageBlock(image: ImageInput): Anthropic.ImageBlockParam {
  return { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } };
}

// ---------------------------------------------------------------------------
// readLift action
// ---------------------------------------------------------------------------

/** The single tool readLift must answer with; its input is the lift. */
export const submitLiftTool: Anthropic.Tool = toToolDef('submitLift', readLiftResultSchema);

/** Drop top-level null values (shallow): the model sometimes writes
 *  `weight: null` for a field it does not know, which the schemas treat as
 *  absent. Used for readLift and every chat tool call. */
export function withoutNulls(raw: unknown): Record<string, unknown> | null {
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

export interface ChatOptions {
  uid?: string;
  userData?: UserData;
  firestore?: FirestoreRest;
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
  options?: ChatOptions,
): Promise<ChatResult> {
  // A photo goes before its text, as the API recommends.
  const apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.image ? [imageBlock(m.image), { type: 'text', text: m.content }] : m.content,
  }));

  // Read-only context goes first, in a user message.
  const preamble = buildContextPreamble(context);
  if (preamble) {
    apiMessages.unshift({ role: 'user', content: preamble });
  }

  const allTools = [...buildToolDefs(), ...chatReadTools];
  const readCtx: ChatReadContext = {
    uid: options?.uid,
    data: options?.userData,
    fs: options?.firestore,
  };

  let rounds = 0;
  let finalResponse: Anthropic.Message | null = null;

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;
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
      tools: allTools,
      messages: apiMessages,
    });

    finalResponse = response;

    const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    const readToolBlocks = toolUseBlocks.filter((b) => isReadTool(b.name));

    // If no read tools were called or we've reached the round cap, stop looping.
    if (readToolBlocks.length === 0 || rounds >= MAX_TOOL_ROUNDS) {
      break;
    }

    // Append assistant turn with its tool calls
    apiMessages.push({ role: 'assistant', content: response.content });

    // Execute read tools and feed results back
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      if (isReadTool(block.name)) {
        let result: unknown;
        try {
          const res = await executeChatRead(block.name, withoutNulls(block.input) ?? block.input, readCtx);
          result = res.ok ? res.result : { error: res.error };
        } catch (err) {
          result = { error: err instanceof Error ? err.message : String(err) };
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      } else {
        // Non-read tool in the same turn: acknowledge
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify({ status: 'proposal_queued' }),
        });
      }
    }

    apiMessages.push({ role: 'user', content: toolResults });
  }

  const textParts: string[] = [];
  const toolCalls: ChatToolCall[] = [];

  if (finalResponse) {
    for (const block of finalResponse.content) {
      if (block.type === 'text') {
        textParts.push(block.text);
      } else if (block.type === 'tool_use' && !isReadTool(block.name)) {
        const name = block.name as ToolName;
        const validator = toolValidators[name];
        if (!validator) {
          console.warn('model emitted unknown tool', name);
          continue;
        }
        const parsed = validator.safeParse(withoutNulls(block.input) ?? block.input);
        if (!parsed.success) {
          console.warn('tool input failed validation; dropping call', name, JSON.stringify(parsed.error.issues));
          continue;
        }
        toolCalls.push({ id: block.id, name, input: parsed.data });
      }
    }
  }

  return {
    text: textParts.join('\n').trim(),
    toolCalls,
    stopReason: finalResponse?.stop_reason ?? null,
  };
}
