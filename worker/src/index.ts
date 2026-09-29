/**
 * `workout-ai` Cloudflare Worker — the AI layer for the WorkoutApp PWA.
 * POST / with a Firebase ID token; the body's `action` picks the handler.
 * Holds the Anthropic key (secret ANTHROPIC_API_KEY); never applies changes —
 * tool calls are returned to the client, which confirms or applies them.
 */
import Anthropic from '@anthropic-ai/sdk';
import { aiRequestSchema, type AiRequest } from './schemas';
import { AiError, errorResponse, json } from './errors';
import { isAllowed, takeDailySlot, verifyIdToken } from './access';
import { assertContextSize, handleChat, handleReadLift, makeClient } from './handlers';
import { findExercise } from './findExercise';

/** Largest request body accepted (characters). */
const MAX_BODY_CHARS = 1_000_000;

export interface Env {
  ANTHROPIC_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
  ALLOWED_ORIGINS: string;
  APP_ORIGIN: string;
  AI_ALLOWED_EMAILS: string;
  AI_DAILY_LIMIT: string;
  AI_USAGE: KVNamespace;
}

type ActionName = AiRequest['action'];
type Handler = (data: AiRequest, client: Anthropic, env: Env) => Promise<unknown>;

export interface Deps {
  verify: (token: string, projectId: string) => Promise<{ uid: string; email?: string }>;
  takeSlot: (kv: KVNamespace, uid: string, limit: number) => Promise<boolean>;
  actions: Partial<Record<ActionName, Handler>>;
}

/** The real action handlers, keyed by `action`. */
export const defaultActions: Deps['actions'] = {
  chat: (d, c) => {
    const req = d as Extract<AiRequest, { action: 'chat' }>;
    return handleChat(c, req.messages, req.context);
  },
  readLift: (d, c) =>
    handleReadLift(c, (d as Extract<AiRequest, { action: 'readLift' }>).text).then((result) => ({ result })),
  findExercise: (d, c, env) =>
    findExercise((d as Extract<AiRequest, { action: 'findExercise' }>).name, { client: c, referer: env.APP_ORIGIN }).then(
      (result) => ({ result }),
    ),
};

const defaultDeps: Deps = {
  verify: (t, p) => verifyIdToken(t, p),
  takeSlot: takeDailySlot,
  actions: defaultActions,
};

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  if (!allowed.includes(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

export async function handleRequest(request: Request, env: Env, deps: Deps = defaultDeps): Promise<Response> {
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  let action: ActionName | undefined;
  try {
    if (request.method !== 'POST') throw new AiError('invalid-argument', 'POST only.');
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    if (!token) throw new AiError('unauthenticated', 'Sign in to use the AI assistant.');
    const user = await deps.verify(token, env.FIREBASE_PROJECT_ID);
    if (!isAllowed(user.email, env.AI_ALLOWED_EMAILS)) {
      throw new AiError('permission-denied', 'This account is not enabled for the AI assistant.');
    }
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) throw new AiError('invalid-argument', 'Request too large.');
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new AiError('invalid-argument', 'Invalid request payload.');
    }
    const parsed = aiRequestSchema.safeParse(body);
    if (!parsed.success) throw new AiError('invalid-argument', 'Invalid request payload.');
    action = parsed.data.action;
    // Deterministic rejections happen before a daily slot is counted.
    if (parsed.data.action === 'chat') assertContextSize(parsed.data.context);
    if (!env.ANTHROPIC_API_KEY) throw new AiError('failed-precondition', 'The AI assistant is not configured.');
    if (!(await deps.takeSlot(env.AI_USAGE, user.uid, Number(env.AI_DAILY_LIMIT) || 150))) {
      throw new AiError('resource-exhausted', 'Daily AI limit reached.');
    }
    const handler = deps.actions[parsed.data.action];
    if (!handler) throw new AiError('invalid-argument', 'Unknown action.');
    const result = await handler(parsed.data, makeClient(env.ANTHROPIC_API_KEY), env);
    return json({ action: parsed.data.action, ...(result as object) }, 200, cors);
  } catch (err) {
    if (!(err instanceof AiError)) {
      console.error('ai worker failed', {
        action,
        status: err instanceof Anthropic.APIError ? err.status : undefined,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return errorResponse(err, cors);
  }
}

export default { fetch: (request: Request, env: Env) => handleRequest(request, env) };
