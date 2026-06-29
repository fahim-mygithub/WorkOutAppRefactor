import type { InSessionDecision } from '../../types/progression';
import { inSessionDecision } from './autoregulation';
import { prescribedFloor } from './setPrescription';
import type { LoggedSet } from './types';

/** The prescription read off a just-logged set. The range floor falls back to the
 *  single configured rep count when no explicit range was set. */
interface PrescribedSet {
  reps: number;
  repMin?: number;
  repMax?: number;
}

/**
 * Live in-session cue after a logged set — pure, synchronous, account-free.
 *
 * Builds the `SetTarget` the decision core expects from the prescribed set plus
 * the load ACTUALLY lifted (so any cut comes off the real working weight, never a
 * historical target), then delegates to `inSessionDecision` (the same core
 * `ProgressiveOverloadService.getInSessionDecision` wraps). Lives here, free of
 * the firestore-coupled service, so the player can call it for everyone —
 * including anonymous/demo users — and it stays trivially unit-testable.
 */
export function decideInSession(
  set: PrescribedSet,
  logged: LoggedSet,
  setIndex: number,
  totalSets: number,
): InSessionDecision {
  return inSessionDecision(
    {
      repMin: prescribedFloor(set),
      repMax: set.repMax ?? set.reps,
      weight: logged.weight,
      setIndex,
      totalSets,
    },
    logged,
  );
}

/**
 * The card-worthy slice of a per-set decision: only an actionable `reduce`/
 * `repeat` becomes a visible cue; `continue`/`end` stay silent (return `null`)
 * to keep the no-scroll player calm. Pure — same account-free inputs as
 * `decideInSession` — so the player wires `setSuggestion(inSessionSuggestion(...))`
 * directly and this gating stays unit-testable without a render harness.
 */
export function inSessionSuggestion(
  set: PrescribedSet,
  logged: LoggedSet,
  setIndex: number,
  totalSets: number,
): InSessionDecision | null {
  const decision = decideInSession(set, logged, setIndex, totalSets);
  return decision.action === 'reduce' || decision.action === 'repeat' ? decision : null;
}
