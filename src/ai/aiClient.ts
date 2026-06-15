/**
 * Client AI service.
 *
 * Talks to the `ai` Firebase callable Cloud Function (a SEPARATE `functions/`
 * package whose only job is to hold the Anthropic API key and call the official
 * @anthropic-ai/sdk with prompt caching). The key is NEVER on the client.
 *
 * Resilience model — the whole point of this module:
 *   - parse(): if the callable is unavailable (no backend configured, offline,
 *     or any error), it transparently falls back to the on-device deterministic
 *     parser (`parseFallback`). parse() therefore NEVER rejects for backend
 *     reasons — the user can always build a workout from text.
 *   - chat(): requires the model; there is no deterministic substitute for
 *     conversation, so on no-backend/offline/error it throws `AiBackendError`
 *     and exposes `backendAvailable=false` so the UI can disable chat.
 *
 * Backend detection is lazy and cached: the first call resolves a callable via
 * `httpsCallable`, guarded so a missing/blocked Functions instance degrades
 * instead of crashing the app.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import type { HttpsCallable } from 'firebase/functions';
import app from '../firebase/config';
import { parseWithFallback } from './parseFallback';
import type {
  AiChatRequest,
  AiChatResponse,
  AiParseRequest,
  AiParseResponse,
} from './types';

/** Error thrown when a backend-only operation (chat) has no reachable backend. */
export class AiBackendError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'AiBackendError';
  }
}

/**
 * Wire payload for the single `ai` callable. The function dispatches on `op`.
 * Keeping one callable (vs two) keeps the Functions surface and CORS config
 * minimal; the discriminator keeps it typed.
 */
type AiCallablePayload =
  | ({ op: 'parse' } & AiParseRequest)
  | ({ op: 'chat' } & AiChatRequest);

type AiCallableResult = AiParseResponse | AiChatResponse;

/**
 * Whether a callable instance can be constructed. `null` = not yet probed.
 * Once probed, this is memoized so we don't re-resolve on every call.
 */
let cachedCallable: HttpsCallable<AiCallablePayload, AiCallableResult> | null = null;
let callableProbed = false;

/** Allow tests to inject a callable factory; defaults to the real Firebase one. */
export interface AiClientDeps {
  /**
   * Resolves the `ai` callable, or returns null if no backend is configured.
   * Defaults to building one from the app's Firebase Functions instance.
   */
  resolveCallable?: () => HttpsCallable<AiCallablePayload, AiCallableResult> | null;
}

function defaultResolveCallable(): HttpsCallable<
  AiCallablePayload,
  AiCallableResult
> | null {
  try {
    const functions = getFunctions(app);
    return httpsCallable<AiCallablePayload, AiCallableResult>(functions, 'ai');
  } catch {
    // No Functions instance / SDK not initialized → treat as no backend.
    return null;
  }
}

function getCallable(
  deps?: AiClientDeps,
): HttpsCallable<AiCallablePayload, AiCallableResult> | null {
  if (deps?.resolveCallable) {
    // Test/override path: never cache, so each test controls its own backend.
    return deps.resolveCallable();
  }
  if (!callableProbed) {
    cachedCallable = defaultResolveCallable();
    callableProbed = true;
  }
  return cachedCallable;
}

/** Reset memoized backend probe state. Intended for tests. */
export function resetAiClient(): void {
  cachedCallable = null;
  callableProbed = false;
}

/** True if the device is reporting itself offline (best-effort; jsdom-safe). */
function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Parse freeform workout text into structured sets.
 *
 * Calls the `ai` callable when a backend is reachable; otherwise (no backend,
 * offline, or any backend error) transparently returns the deterministic
 * offline parse. Resolves to an `AiParseResponse` whose `source` tells the
 * caller which path produced it. Never rejects for backend reasons.
 */
export async function parse(
  request: AiParseRequest,
  deps?: AiClientDeps,
): Promise<AiParseResponse> {
  const callable = isOffline() ? null : getCallable(deps);

  if (!callable) {
    return parseWithFallback(request);
  }

  try {
    const { data } = await callable({ op: 'parse', ...request });
    // Defensive: a malformed backend response also degrades to fallback.
    const parsed = data as AiParseResponse;
    if (!parsed || !parsed.workout) {
      return parseWithFallback(request);
    }
    return { ...parsed, source: 'backend' };
  } catch {
    return parseWithFallback(request);
  }
}

/**
 * Conversational coaching with tool use.
 *
 * Backend-only: there is no offline substitute for the chat model. Throws
 * `AiBackendError` when no backend is reachable (no Functions configured,
 * offline, or a backend error) so the caller can disable the chat surface
 * rather than silently degrade.
 */
export async function chat(
  request: AiChatRequest,
  deps?: AiClientDeps,
): Promise<AiChatResponse> {
  if (isOffline()) {
    throw new AiBackendError('Chat is unavailable while offline.');
  }

  const callable = getCallable(deps);
  if (!callable) {
    throw new AiBackendError('Chat backend is not configured.');
  }

  try {
    const { data } = await callable({ op: 'chat', ...request });
    const result = data as AiChatResponse;
    return {
      reply: result?.reply ?? '',
      toolCalls: result?.toolCalls ?? [],
      source: 'backend',
    };
  } catch (error) {
    throw new AiBackendError('Chat request failed.', error);
  }
}

/**
 * Whether a chat-capable backend is currently reachable. This is a synchronous,
 * best-effort signal (callable resolves + not offline) — it does NOT round-trip
 * to the server. parse() works regardless of this flag (it has a fallback).
 */
export function isBackendAvailable(deps?: AiClientDeps): boolean {
  if (isOffline()) return false;
  return getCallable(deps) !== null;
}
