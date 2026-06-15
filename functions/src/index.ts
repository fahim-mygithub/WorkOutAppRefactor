/**
 * `/ai` Firebase Cloud Function — the AI layer for the WorkoutApp PWA
 * (design §4). A single onCall callable so CORS is handled by the Firebase
 * SDK (the design doc notes a raw onRequest would need explicit CORS for the
 * hosting origin). Two actions:
 *
 *   { action: 'parse', text }              -> Haiku 4.5, structured sets
 *   { action: 'chat',  messages, context } -> Sonnet 4.6, tool-use
 *
 * Hard requirements honored here:
 *   - Gated by Firebase Auth: unauthenticated callers are rejected.
 *   - Zod-validated input for both actions.
 *   - Prompt caching via cache_control on the system prompt.
 *   - Mutations are returned to the client, never auto-applied server-side.
 *   - The API key lives in Functions config only (never client-side).
 */
import Anthropic from '@anthropic-ai/sdk';
import * as functions from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';

import {
  aiRequestSchema,
  parseOutputJsonSchema,
  parseResultSchema,
  type ChatContext,
  type ChatMessage,
  type ParseResult,
} from './schemas';
import { buildToolDefs, toolValidators, type ToolName } from './tools';
import { CHAT_SYSTEM_PROMPT, PARSE_SYSTEM_PROMPT } from './prompts';

// CORRECT MODEL IDS — do not change without an explicit instruction.
const PARSE_MODEL = 'claude-haiku-4-5-20251001';
const CHAT_MODEL = 'claude-sonnet-4-6';

// Secret-backed key (preferred: `firebase functions:config` is legacy; modern
// deploys use `defineSecret` / a .env file). We resolve at runtime from, in
// order: the bound secret, ANTHROPIC_KEY env, then legacy functions.config().
const ANTHROPIC_KEY = defineSecret('ANTHROPIC_KEY');

let cachedClient: Anthropic | null = null;

function resolveApiKey(): string {
  // 1) defineSecret-bound value (Secret Manager) or .env-provided env var.
  const fromParam = ANTHROPIC_KEY.value();
  if (fromParam) return fromParam;

  const fromEnv = process.env.ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;
  if (fromEnv) return fromEnv;

  // 2) Legacy `firebase functions:config:set anthropic.key=...` fallback.
  try {
    // functions.config() throws if no config is present in some runtimes.
    const cfg = functions.config?.() as { anthropic?: { key?: string } } | undefined;
    const fromLegacy = cfg?.anthropic?.key;
    if (fromLegacy) return fromLegacy;
  } catch {
    // ignore — fall through to the error below
  }

  throw new HttpsError(
    'failed-precondition',
    'Anthropic API key is not configured. Set the ANTHROPIC_KEY secret (or anthropic.key config).',
  );
}

function getClient(): Anthropic {
  if (cachedClient) return cachedClient;
  cachedClient = new Anthropic({ apiKey: resolveApiKey() });
  return cachedClient;
}

// ---------------------------------------------------------------------------
// parse action
// ---------------------------------------------------------------------------

/** Strip optional markdown code fences and return the JSON substring. */
function extractJson(text: string): string {
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

async function handleParse(text: string): Promise<ParseResult> {
  const client = getClient();

  // The structured JSON Schema is appended to the (cached) system prompt so the
  // prefix stays byte-stable across requests; the user's text is the only
  // volatile content. We instruct strict JSON and then validate with Zod
  // (parseResultSchema) as the authoritative guard — robust across SDK versions
  // without depending on the beta output_config surface.
  const response = await client.messages.create({
    model: PARSE_MODEL,
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
    throw new HttpsError('internal', 'Parse model returned no text content.');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(extractJson(block.text));
  } catch {
    throw new HttpsError('internal', 'Parse model returned invalid JSON.');
  }

  const result = parseResultSchema.safeParse(raw);
  if (!result.success) {
    logger.warn('parse output failed schema validation', { issues: result.error.issues });
    throw new HttpsError('internal', 'Parse output did not match the expected schema.');
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// chat action (tool-use). Mutations are NOT applied — we return the tool calls.
// ---------------------------------------------------------------------------

interface ChatToolCall {
  id: string;
  name: ToolName;
  input: unknown;
}

interface ChatResult {
  text: string;
  toolCalls: ChatToolCall[];
  stopReason: string | null;
}

function buildContextPreamble(context: ChatContext | undefined): string | null {
  if (!context) return null;
  // Serialize deterministically; this rides in the user turn (not the cached
  // system prompt) so it never invalidates the cached prefix.
  return `CONTEXT (read-only, current app state):\n${JSON.stringify(context)}`;
}

async function handleChat(
  messages: ChatMessage[],
  context: ChatContext | undefined,
): Promise<ChatResult> {
  const client = getClient();

  const apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Inject read-only context ahead of the latest user turn, in a user message.
  const preamble = buildContextPreamble(context);
  if (preamble) {
    apiMessages.unshift({ role: 'user', content: preamble });
  }

  const response = await client.messages.create({
    model: CHAT_MODEL,
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
        logger.warn('model emitted unknown tool', { name });
        continue;
      }
      // Validate the model's tool input against the catalog Zod schema before
      // forwarding it to the client. Drop malformed calls rather than trust them.
      const parsed = validator.safeParse(block.input);
      if (!parsed.success) {
        logger.warn('tool input failed validation; dropping call', {
          name,
          issues: parsed.error.issues,
        });
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

// ---------------------------------------------------------------------------
// Callable entry point
// ---------------------------------------------------------------------------

export const ai = onCall(
  {
    secrets: [ANTHROPIC_KEY],
    // Keep the model latency budget comfortable but bounded.
    timeoutSeconds: 120,
    memory: '512MiB',
    // Limit blast radius / cost; tune as needed.
    maxInstances: 10,
  },
  async (request) => {
    // 1) Auth gate — reject unauthenticated callers.
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in to use the AI assistant.');
    }

    // 2) Validate the request envelope with Zod.
    const parsed = aiRequestSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'Invalid request payload.', parsed.error.issues);
    }
    const data = parsed.data;

    try {
      if (data.action === 'parse') {
        const result = await handleParse(data.text);
        return { action: 'parse', result };
      }
      // action === 'chat'
      const result = await handleChat(data.messages, data.context);
      return { action: 'chat', ...result };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      // Surface Anthropic SDK / network errors without leaking internals.
      const status =
        err instanceof Anthropic.APIError ? err.status ?? 'unknown' : 'unknown';
      logger.error('ai callable failed', {
        action: data.action,
        status,
        message: err instanceof Error ? err.message : String(err),
      });
      throw new HttpsError('internal', 'The AI assistant is temporarily unavailable.');
    }
  },
);
