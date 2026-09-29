/**
 * Shared request/response + tool types for the AI layer.
 *
 * These types mirror the contract of the Cloudflare Worker (`worker/`, a
 * SEPARATE package). The Worker is the ONLY place the Anthropic API key lives;
 * the client never talks to Anthropic directly; it calls the Worker only.
 * Models, prompts and prompt caching live in the Worker (`worker/src/models.ts`)
 * and never leak to the client — it only sees the request/response shapes below.
 */

/** Where a given AI result was produced (every Worker action is 'backend'). */
export type AiSource = 'backend' | 'fallback';

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
  /** Where this came from; always 'backend' (chat has no offline fallback). */
  source: AiSource;
}

// ---------------------------------------------------------------------------
// Chat sheet turn shapes (what the UI renders for one assistant turn)
// ---------------------------------------------------------------------------

/** A mutation tool-call the AI wants to perform, pending user confirmation. */
export interface AiToolProposal {
  /** Tool-call id (stable; from the assistant turn). Used as React key. */
  id: string;
  /** Tool name, e.g. 'swapExercise' / 'updateBenchmark' (an `AiToolName`). */
  tool: string;
  /** Human-readable one-line summary of what will happen if applied. */
  summary: string;
  /** Optional longer detail / rationale shown under the summary. */
  detail?: string;
  /** The raw tool-call input; rendered as a read-only preview when present. */
  input?: unknown;
}

/** A visualization tool-call — rendered read-only, never Apply/Reject. */
export interface AiVisualization {
  id: string;
  /** Chart kind from the design's chart vocabulary, e.g. 'line' | 'bar'. */
  kind: string;
  /** Title shown above the chart. */
  title: string;
  /** Opaque chart spec/data; rendered by an injected renderer if provided. */
  spec: unknown;
}

/**
 * A short line under the assistant prose saying what happened to a tool call:
 * applied on its own (auto tier) or discarded (failed the engine's checks).
 */
export interface AiNotice {
  id: string;
  text: string;
  tone: 'applied' | 'discarded';
}

/** One assistant turn returned by the AI Worker. */
export interface AiAssistantTurn {
  /** Free-text assistant prose (may be empty if it only emitted tool-calls). */
  text: string;
  /** Mutation tool-calls -> ApplyRejectCard. */
  proposals?: AiToolProposal[];
  /** Visualization tool-calls -> read-only render. */
  visualizations?: AiVisualization[];
  /** Applied / discarded notices -> small lines under the prose. */
  notices?: AiNotice[];
}
