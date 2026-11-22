/**
 * Optional Claude review for Strength Markers.
 *
 * Uses the existing `chat` action on the AI backend (never adds a new endpoint
 * and never touches `worker/**`). Sends only exercise names, best sets, formula
 * e1RMs, and per-session best sets — no personal profile data. Strictly validates
 * the reply (numeric e1RM within ±25% of the formula value) and falls back
 * silently to the formula on any error, timeout, signed-out state, or bad reply.
 */
import type { AiMarkerReview, BaseStrengthMarker } from '../lib/strengthMarkers';
import {
  chat,
  isBackendAvailable,
  isSignedIn,
  type AiClientDeps,
} from './aiClient';

export const MAX_AI_BAND_RATIO = 0.25;
export const DEFAULT_AI_TIMEOUT_MS = 15_000;
const MAX_LIFTS_PER_REVIEW = 30;
const MAX_SESSIONS_PER_LIFT = 6;
const MAX_NOTE_CHARS = 140;

export interface StrengthMarkersAiDeps {
  isBackendAvailable?: () => boolean;
  isSignedIn?: () => boolean;
  chat?: typeof chat;
  aiClientDeps?: AiClientDeps;
  timeoutMs?: number;
  units?: 'lbs' | 'kg';
  now?: () => Date;
}

export interface StrengthMarkersAiResult {
  reviews: Record<string, AiMarkerReview>;
  usedAi: boolean;
}

interface ReviewRequestLift {
  exerciseName: string;
  unit: 'lbs' | 'kg';
  bestSet: {
    weight: number;
    reps: number;
    rir?: number;
  };
  formulaE1RM: number;
  sessionBestSets: Array<{
    weight: number;
    reps: number;
    rir?: number;
  }>;
}

function buildReviewPrompt(markers: ReadonlyArray<BaseStrengthMarker>): string {
  const table: ReviewRequestLift[] = markers.slice(0, MAX_LIFTS_PER_REVIEW).map((m) => ({
    exerciseName: m.exerciseName,
    unit: m.unit,
    bestSet: {
      weight: m.bestSet.weight,
      reps: m.bestSet.reps,
      ...(m.bestSet.rir !== undefined ? { rir: m.bestSet.rir } : {}),
    },
    formulaE1RM: m.formulaE1RM,
    sessionBestSets: m.sessionBests.slice(-MAX_SESSIONS_PER_LIFT).map((s) => ({
      weight: s.weight,
      reps: s.reps,
      ...(s.rir !== undefined ? { rir: s.rir } : {}),
    })),
  }));

  return [
    'Review these computed 1RM strength markers based on the logged best sets and recent session bests.',
    'Do not call any tools. Reply ONLY with valid JSON matching:',
    '{"lifts":[{"exerciseName":"string","e1RM":number,"note":"one concise line"}]}',
    'Keep each e1RM realistic for the sets shown and within +-25% of formulaE1RM.',
    'Data:',
    JSON.stringify(table),
  ].join('\n');
}

function extractJsonText(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const firstBracket = trimmed.indexOf('[');
  if (firstBrace === -1 && firstBracket === -1) return null;

  const useObject =
    firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket);
  const start = useObject ? firstBrace : firstBracket;
  const end = trimmed.lastIndexOf(useObject ? '}' : ']');
  if (end <= start) return null;

  return trimmed.slice(start, end + 1);
}

function sanitizeNote(note: unknown): string {
  if (typeof note !== 'string') return '';
  return note.replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE_CHARS);
}

export function parseStrengthMarkersAiReply(
  replyText: string,
  markers: ReadonlyArray<BaseStrengthMarker>,
  reviewedAt: string,
): Record<string, AiMarkerReview> {
  const jsonText = extractJsonText(replyText);
  if (!jsonText) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return {};
  }

  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { lifts?: unknown }).lifts)
      ? (parsed as { lifts: unknown[] }).lifts
      : null;

  if (!list) return {};

  const byName = new Map<string, BaseStrengthMarker>();
  for (const marker of markers) {
    byName.set(marker.exerciseName.trim().toLowerCase(), marker);
  }

  const reviews: Record<string, AiMarkerReview> = {};

  for (const item of list) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.exerciseName !== 'string') continue;

    const target = byName.get(record.exerciseName.trim().toLowerCase());
    if (!target) continue;

    const rawE1RM = record.e1RM;
    if (typeof rawE1RM !== 'number' || !Number.isFinite(rawE1RM) || rawE1RM <= 0) continue;

    // Must sit within ±25% of the formula e1RM; reject wild outliers.
    const diffRatio = Math.abs(rawE1RM - target.formulaE1RM) / target.formulaE1RM;
    if (diffRatio > MAX_AI_BAND_RATIO) continue;

    reviews[target.exerciseKey] = {
      exerciseKey: target.exerciseKey,
      e1RM: Math.round(rawE1RM),
      note: sanitizeNote(record.note),
      reviewedAt,
      formulaE1RM: target.formulaE1RM,
    };
  }

  return reviews;
}

/**
 * Ask the backend AI to review formula strength markers. Falls back silently to
 * `{ reviews: {}, usedAi: false }` when unavailable, signed out, timed out, or malformed.
 */
export async function reviewStrengthMarkersWithAi(
  markers: ReadonlyArray<BaseStrengthMarker>,
  deps: StrengthMarkersAiDeps = {},
): Promise<StrengthMarkersAiResult> {
  const checkAvailable = deps.isBackendAvailable ?? (() => isBackendAvailable(deps.aiClientDeps));
  const checkSignedIn = deps.isSignedIn ?? isSignedIn;
  const chatFn = deps.chat ?? chat;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS;
  const now = deps.now ?? (() => new Date());

  if (markers.length === 0 || !checkAvailable() || !checkSignedIn()) {
    return { reviews: {}, usedAi: false };
  }

  const units = deps.units ?? markers[0]?.unit ?? 'lbs';
  const prompt = buildReviewPrompt(markers);

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      chatFn(
        {
          messages: [{ role: 'user', content: prompt }],
          context: { screen: 'other', units },
        },
        deps.aiClientDeps,
      ),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('AI review timeout')), timeoutMs);
      }),
    ]);

    const reviewedAt = now().toISOString();
    const reviews = parseStrengthMarkersAiReply(response.reply, markers, reviewedAt);
    const usedAi = Object.keys(reviews).length > 0;
    return { reviews, usedAi };
  } catch {
    return { reviews: {}, usedAi: false };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
