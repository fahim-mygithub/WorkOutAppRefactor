import { returnFromLayoffSuggestion } from './layoff';
import type { LayoffSuggestion } from './layoff';

/** The slice of a progression recommendation the welcome-back gate needs. Kept
 *  minimal (and structurally compatible with `ProgressionRecommendation`) so the
 *  gate stays pure and trivially unit-testable without a render harness. */
export interface WelcomeBackRecommendation {
  /** The exercise the rec was computed for — used to reject a stale rec. */
  exerciseId?: string;
  daysSinceLastWorkout?: number;
  previousWeight?: number;
  recommendedWeight?: number;
}

export interface WelcomeBackView {
  suggestion: LayoffSuggestion;
  /** The full (pre-cut) working load the suggestion eases down FROM — passed
   *  through verbatim so the UI shows the real number, no inverse arithmetic. */
  previousWeight: number;
}

/**
 * Pure gate for the opt-in welcome-back prompt. Returns the suggestion to show
 * for `currentExerciseId`, or null when it must stay hidden because:
 *  - there's no recommendation, or it belongs to a DIFFERENT exercise (the hook
 *    keeps a stale rec during an async reload — guards the name/number flash);
 *  - the lifter already answered for this exercise (applied or kept) — keyed by
 *    exercise IDENTITY so it survives superset rounds (A→B→A→B) and back-nav;
 *  - there's no calendar gap / last load to act on (delegate returns null).
 *
 * Lives in the pure core (no React/Firebase) so the player wires it directly and
 * the gating is testable in isolation.
 */
export function welcomeBackSuggestion(
  recommendation: WelcomeBackRecommendation | null | undefined,
  currentExerciseId: string,
  answeredIds: ReadonlySet<string>,
): WelcomeBackView | null {
  if (!recommendation) return null;
  if (recommendation.exerciseId !== currentExerciseId) return null;
  if (answeredIds.has(currentExerciseId)) return null;
  if (recommendation.daysSinceLastWorkout == null) return null;

  const previousWeight = recommendation.previousWeight ?? recommendation.recommendedWeight;
  if (!previousWeight) return null;

  const suggestion = returnFromLayoffSuggestion({
    daysSinceLastWorkout: recommendation.daysSinceLastWorkout,
    lastWeight: previousWeight,
  });
  return suggestion ? { suggestion, previousWeight } : null;
}
