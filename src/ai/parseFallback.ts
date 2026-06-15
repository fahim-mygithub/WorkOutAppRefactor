/**
 * Deterministic, offline parse fallback.
 *
 * This wraps the EXISTING regex parser used by the Build flow
 * (`src/parser/workoutParser.ts`, the same `WorkoutParser` that
 * `BuildPage.tsx` / `EnhancedTextInput.tsx` already drive) so that freeform
 * text -> structured sets works with NO backend at all. It is the safety net
 * the AI client falls back to when the `ai` callable is unavailable (no
 * Firebase Functions instance configured, offline, or any backend error).
 *
 * It introduces no new parsing logic — it reuses the proven parser and reshapes
 * its output into the shared `AiParseResponse` contract.
 */

import { WorkoutParser } from '../parser/workoutParser';
import type { AiParseRequest, AiParseResponse } from './types';
import { parseResultToResponse } from './types';

/**
 * Parse freeform workout text using only the on-device deterministic parser.
 *
 * Always resolves (it does not throw on unparseable input — the underlying
 * parser returns a failure `ParseResult` with an empty workout + warnings, and
 * we surface that as an empty workout plus the warnings). The result is marked
 * `source: 'fallback'` so callers/UI can label it as offline.
 */
export function parseWithFallback(request: AiParseRequest): AiParseResponse {
  // A fresh parser per call — `WorkoutParser` is stateful (it accumulates
  // errors/warnings across a single parse and resets at the top of `parse`),
  // so a new instance keeps calls independent and side-effect free.
  const parser = new WorkoutParser();
  const result = parser.parse(request.text);

  const response = parseResultToResponse(result, 'fallback');

  // If the deterministic parse failed outright, fold its errors into warnings
  // so the caller still gets actionable feedback (the fallback never rejects).
  if (!result.success && result.errors.length > 0) {
    const errorWarnings = result.errors.map((e) =>
      e.line > 0 ? `Line ${e.line}: ${e.message}` : e.message,
    );
    return { ...response, warnings: [...errorWarnings, ...response.warnings] };
  }

  return response;
}
