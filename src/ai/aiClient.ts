/**
 * Client AI service.
 *
 * Talks to the Cloudflare Worker (`worker/`, a SEPARATE package whose only job
 * is to hold the Anthropic API key, check the caller and call the model). Each
 * request is `POST <VITE_AI_URL>` with the signed-in user's Firebase ID token
 * as a Bearer token and a JSON body discriminated on `action`. The key is NEVER
 * on the client.
 *
 * Resilience model — the whole point of this module:
 *   - parse(): if the Worker is unavailable (no URL configured, offline, signed
 *     out, or any error), it transparently falls back to the on-device
 *     deterministic parser (`parseFallback`). parse() therefore NEVER rejects
 *     for backend reasons — the user can always build a workout from text.
 *   - chat(): requires the model; there is no deterministic substitute for
 *     conversation, so it throws `AiBackendError` with an `AiErrorCode` the UI
 *     can explain, and `isBackendAvailable()` lets the UI disable chat up front.
 */

import { auth } from '../firebase/config';
import { parseWithFallback } from './parseFallback';
import type {
  AiChatRequest,
  AiChatResponse,
  AiErrorCode,
  AiParseRequest,
  AiParseResponse,
  AiToolCall,
  ParsedWorkout,
} from './types';

/** Injectable transport; every field defaults to the real app wiring. */
export interface AiClientDeps {
  /** Worker URL. Defaults to `VITE_AI_URL`; empty means AI is off. */
  url?: string;
  /** Firebase ID token of the signed-in user, or null when signed out. */
  getToken?: () => Promise<string | null>;
  fetch?: typeof fetch;
}

const defaults = (): Required<AiClientDeps> => ({
  url: import.meta.env.VITE_AI_URL ?? '',
  getToken: async () => (auth.currentUser ? auth.currentUser.getIdToken() : null),
  fetch: (...args) => fetch(...args),
});

/** Error thrown when an AI call cannot be served; `code` says why. */
export class AiBackendError extends Error {
  constructor(
    message: string,
    public readonly code: AiErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AiBackendError';
  }
}

/** Wire payload for the Worker; it dispatches on `action`. */
export type AiRequestPayload =
  | { action: 'parse'; text: string }
  | ({ action: 'chat' } & AiChatRequest)
  | { action: 'readLift'; text: string }
  | { action: 'findExercise'; name: string };

/** Worker `chat` success body. */
interface WorkerChatResult {
  action: 'chat';
  text?: string;
  toolCalls?: AiToolCall[];
  stopReason?: string | null;
}

/** Worker `parse` success body (mirrors `parseResultSchema`). */
interface WorkerParseResult {
  action: 'parse';
  result?: {
    exercises?: Array<{
      exerciseName: string;
      sets: Array<{
        reps: number | null;
        /** How many identical sets this entry stands for. */
        sets: number | null;
        weight: number | null;
        unit: 'lbs' | 'kg' | null;
        rpe: number | null;
        timeSeconds: number | null;
        distanceMeters: number | null;
      }>;
    }>;
  };
}

const CODE_BY_STATUS: Record<number, AiErrorCode> = {
  401: 'signed-out',
  403: 'not-allowed',
  429: 'limit',
  503: 'unconfigured',
};

/** True if the device is reporting itself offline (best-effort; jsdom-safe). */
function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** POST one action to the Worker; resolves with its JSON body or throws. */
export async function callAi<T>(payload: AiRequestPayload, deps?: AiClientDeps): Promise<T> {
  const d = { ...defaults(), ...deps };
  if (isOffline()) throw new AiBackendError('AI is unavailable while offline.', 'offline');
  if (!d.url) throw new AiBackendError('AI is not configured.', 'unconfigured');
  const token = await d.getToken();
  if (!token) throw new AiBackendError('Sign in to use AI.', 'signed-out');
  let res: Response;
  try {
    res = await d.fetch(d.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new AiBackendError('AI request failed.', 'failed', error);
  }
  if (!res.ok) {
    throw new AiBackendError('AI request failed.', CODE_BY_STATUS[res.status] ?? 'failed');
  }
  try {
    return (await res.json()) as T;
  } catch (error) {
    throw new AiBackendError('AI request failed.', 'failed', error);
  }
}

/** Most identical sets one parsed entry may expand to. */
const MAX_SETS_PER_ENTRY = 20;

function toParsedWorkout(result: WorkerParseResult['result']): ParsedWorkout | null {
  if (!result || !Array.isArray(result.exercises)) return null;
  return {
    exercises: result.exercises.map((e) => ({
      name: e.exerciseName,
      // One Worker entry can stand for several identical sets ("3x5" → sets: 3);
      // capped so a runaway count can't flood the workout.
      sets: (e.sets ?? []).flatMap((s) =>
        Array.from({ length: Math.max(1, Math.min(s.sets ?? 1, MAX_SETS_PER_ENTRY)) }, () => ({
          reps: s.reps ?? 0,
          weight: s.weight ?? undefined,
          unit: s.unit ?? undefined,
          rpe: s.rpe ?? undefined,
          time: s.timeSeconds ?? undefined, // seconds
          distance: s.distanceMeters ?? undefined, // meters
        })),
      ),
    })),
    supersets: [],
  };
}

/**
 * Parse freeform workout text into structured sets.
 *
 * Calls the Worker when it is reachable; otherwise (no URL, offline, signed
 * out, or any error) transparently returns the deterministic offline parse.
 * `source` tells the caller which path produced it. Never rejects for backend
 * reasons.
 */
export async function parse(
  request: AiParseRequest,
  deps?: AiClientDeps,
): Promise<AiParseResponse> {
  try {
    const data = await callAi<WorkerParseResult>({ action: 'parse', text: request.text }, deps);
    const workout = toParsedWorkout(data?.result);
    // Defensive: a malformed Worker response also degrades to fallback.
    if (!workout) return parseWithFallback(request);
    return { workout, warnings: [], source: 'backend' };
  } catch {
    return parseWithFallback(request);
  }
}

/**
 * Conversational coaching with tool use.
 *
 * Backend-only: there is no offline substitute for the chat model. Throws
 * `AiBackendError` (with a code) when the Worker cannot serve the turn.
 */
export async function chat(
  request: AiChatRequest,
  deps?: AiClientDeps,
): Promise<AiChatResponse> {
  const data = await callAi<WorkerChatResult>({ action: 'chat', ...request }, deps);
  return {
    reply: data?.text ?? '',
    toolCalls: data?.toolCalls ?? [],
    source: 'backend',
  };
}

/**
 * Whether the Worker is configured and the device is online. A synchronous,
 * best-effort signal — it does NOT round-trip to the server, and it does not
 * check sign-in. parse() works regardless of this flag (it has a fallback).
 */
export function isBackendAvailable(deps?: AiClientDeps): boolean {
  const d = { ...defaults(), ...deps };
  return !isOffline() && Boolean(d.url);
}
