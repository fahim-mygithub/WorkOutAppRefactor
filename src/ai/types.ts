/**
 * Shared request/response + tool types for the AI layer.
 *
 * These types mirror the contract of the Cloudflare Worker (`worker/`, a
 * SEPARATE package). The Worker is the ONLY place the Anthropic API key lives;
 * the client never talks to Anthropic directly. The client either calls the
 * Worker (when it is configured and reachable) or falls back to the existing
 * deterministic regex parser (when offline / no backend).
 *
 * Model ids (authoritative — do not invent others):
 *   - parse surface       → 'claude-haiku-4-5-20251001'
 *   - chat-with-tools     → 'claude-sonnet-5-5'
 *
 * The Worker uses the official @anthropic-ai/sdk with prompt caching
 * (cache_control on the system prompt). None of that leaks to the client — the
 * client only sees the request/response shapes below.
 */

import type { ParsedWorkout, ParseResult } from '../parser/types';

// Re-export the parser's canonical shapes so AI consumers have a single import
// surface and the AI parse result stays structurally identical to the offline
// (deterministic) parse result.
export type { ParsedExercise, ParsedSet, ParsedWorkout, ParseResult } from '../parser/types';

/** The exact model id strings the Worker dispatches to, per surface. */
export const AI_MODELS = {
  /** Structured freeform-text -> sets parsing. */
  parse: 'claude-haiku-4-5-20251001',
  /** Conversational coaching with tool use. */
  chat: 'claude-sonnet-5-5',
} as const;

export type AiModelId = (typeof AI_MODELS)[keyof typeof AI_MODELS];

/** Where a given AI result was produced. Lets the UI label "offline" results. */
export type AiSource = 'backend' | 'fallback';

// ---------------------------------------------------------------------------
// Parse surface (freeform workout text -> structured sets)
// ---------------------------------------------------------------------------

export interface AiParseRequest {
  /** Freeform workout text the user typed in the Build flow. */
  text: string;
  /**
   * Optional known exercise names, used to bias the model toward the user's
   * existing exercise database (and used by the offline fallback for fuzzy
   * validation). Kept small — names only, not full exercise objects.
   */
  knownExerciseNames?: string[];
}

export interface AiParseResponse {
  /** Structured workout, identical in shape to the deterministic parser. */
  workout: ParsedWorkout;
  /** Non-fatal notes (e.g. "treated line 3 as exercise name with default sets"). */
  warnings: string[];
  /** Whether this came from the backend model or the offline fallback. */
  source: AiSource;
}

// ---------------------------------------------------------------------------
// Chat-with-tools surface
// ---------------------------------------------------------------------------

export type AiChatRole = 'user' | 'assistant';

export interface AiChatMessage {
  role: AiChatRole;
  content: string;
}

/**
 * Tools the Worker exposes to the chat model. The CLIENT mirrors the names so
 * it can plan each call (auto-apply with Undo, or Apply/Reject) and keep the
 * contract typed end to end. The Worker validates each input against its Zod
 * schema before returning it; the client re-checks every number it applies.
 */
export type AiToolName =
  | 'logSet'
  | 'adjustSet'
  | 'swapExercise'
  | 'updateBenchmark'
  | 'addTrackedLift'
  | 'removeTrackedLift';

/** Tool input as validated by the Worker; the planner narrows it per tool. */
export type AiToolInput = Record<string, unknown>;

/** A tool call the model wants the client to act on. */
export interface AiToolCall<TInput extends AiToolInput = AiToolInput> {
  id: string;
  name: AiToolName;
  input: TInput;
}

/** Read-only app state sent with a chat turn (the Worker caps its size). */
export interface AiChatContext {
  screen: 'workout' | 'build' | 'other';
  units: 'lbs' | 'kg';
  activeWorkout?: unknown;
  trackedLifts?: unknown;
  focusExerciseId?: string;
}

/** Why an AI call failed, so the UI can say something specific. */
export type AiErrorCode =
  | 'offline'
  | 'unconfigured'
  | 'signed-out'
  | 'not-allowed'
  | 'limit'
  | 'failed';

export interface AiChatRequest {
  /** Full prior conversation (the Worker is stateless, like the API). */
  messages: AiChatMessage[];
  /** Optional read-only context about the current screen. */
  context?: AiChatContext;
}

export interface AiChatResponse {
  /** Assistant prose reply (may be empty if the turn is purely a tool call). */
  reply: string;
  /** Tool calls the model proposes; the client plans how to apply them. */
  toolCalls: AiToolCall[];
  /** Whether this came from the backend model or the offline fallback. */
  source: AiSource;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build an `AiParseResponse` from a deterministic `ParseResult`. Used by the
 * fallback path; exported so the Worker parse success shape and the
 * offline shape are constructed identically.
 */
export function parseResultToResponse(
  result: ParseResult,
  source: AiSource,
): AiParseResponse {
  return {
    workout: result.workout ?? { exercises: [], supersets: [] },
    warnings: result.warnings,
    source,
  };
}
