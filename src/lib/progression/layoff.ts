import { round5 } from './round';

export interface LayoffInput {
  daysSinceLastWorkout: number;
  lastWeight: number;
}

export interface LayoffSuggestion {
  suggestedWeight: number;
  reductionPct: number;
  optional: true;
  message: string;
}

/**
 * Opt-in welcome-back suggestion after time off — NOT an automatic load cut.
 *
 * Evidence: strength is well preserved over a couple of weeks away, so the old
 * 14-day trigger was too eager. Nothing under 21 days; a gentle 10% for ~3–5
 * weeks; 20% only past 5 weeks. The honest, real percentage is reported (no
 * hardcoded 15%), and it is always flagged optional.
 */
export function returnFromLayoffSuggestion(input: LayoffInput): LayoffSuggestion | null {
  const { daysSinceLastWorkout, lastWeight } = input;

  if (lastWeight <= 0) return null;
  if (daysSinceLastWorkout < 21) return null;

  const reductionPct = daysSinceLastWorkout >= 35 ? 20 : 10;
  const suggestedWeight = round5(lastWeight * (1 - reductionPct / 100));
  const weeks = Math.round(daysSinceLastWorkout / 7);

  return {
    suggestedWeight,
    reductionPct,
    optional: true,
    message: `~${weeks} weeks off — optional ${reductionPct}% lighter to ease back in.`,
  };
}
