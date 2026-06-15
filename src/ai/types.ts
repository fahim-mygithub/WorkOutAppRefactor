/**
 * Shared request/response + tool types for the AI layer.
 *
 * These types mirror the contract of the Firebase callable Cloud Function
 * (`functions/`, a SEPARATE package). The function is the ONLY place the
 * Anthropic API key lives; the client never talks to Anthropic directly. The
 * client either calls the `ai` callable (when a backend is reachable) or falls
 * back to the existing deterministic regex parser (when offline / no backend).
 *
 * Model ids (authoritative — do not invent others):
 *   - parse surface       → 'claude-haiku-4-5-20251001'
 *   - chat-with-tools     → 'claude-sonnet-4-6'
 *
 * The function uses the official @anthropic-ai/sdk with prompt caching
 * (cache_control on the system prompt). None of that leaks to the client — the
 * client only sees the request/response shapes below.
 */

import type { ParsedWorkout, ParseResult } from '../parser/types';

// Re-export the parser's canonical shapes so AI consumers have a single import
// surface and the AI parse result stays structurally identical to the offline
// (deterministic) parse result.
export type { ParsedExercise, ParsedSet, ParsedWorkout, ParseResult } from '../parser/types';

/** The exact model id strings the function dispatches to, per surface. */
export const AI_MODELS = {
  /** Structured freeform-text -> sets parsing. */
  parse: 'claude-haiku-4-5-20251001',
  /** Conversational coaching with tool use. */
  chat: 'claude-sonnet-4-6',
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
 * Tool definitions the function exposes to the chat model. The CLIENT mirrors
 * these so it can (a) render proposed tool calls in an Apply/Reject UI and
 * (b) keep the request/response contract typed end to end. The client never
 * EXECUTES these against Anthropic — the function does.
 */
export type AiToolName = 'propose_workout' | 'query_chart';

export interface AiProposeWorkoutInput {
  /** Suggested workout name, if the model proposes one. */
  name?: string;
  /** The proposed workout, in the same structured shape as a parse result. */
  workout: ParsedWorkout;
}

export interface AiQueryChartInput {
  /** Metric the user asked about, e.g. 'volume' | 'one_rep_max' | 'frequency'. */
  metric: string;
  /** Optional exercise name to scope the metric to. */
  exerciseName?: string;
  /** Optional time window in days. */
  windowDays?: number;
}

export type AiToolInput = AiProposeWorkoutInput | AiQueryChartInput;

/** A tool call the model wants the client to act on (Apply/Reject UX). */
export interface AiToolCall<TInput extends AiToolInput = AiToolInput> {
  id: string;
  name: AiToolName;
  input: TInput;
}

export interface AiChatRequest {
  /** Full prior conversation (the function is stateless, like the API). */
  messages: AiChatMessage[];
}

export interface AiChatResponse {
  /** Assistant prose reply (may be empty if the turn is purely a tool call). */
  reply: string;
  /** Tool calls the model proposes; the UI confirms them before applying. */
  toolCalls: AiToolCall[];
  /** Whether this came from the backend model or the offline fallback. */
  source: AiSource;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build an `AiParseResponse` from a deterministic `ParseResult`. Used by the
 * fallback path; exported so the parse callable's success shape and the
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
