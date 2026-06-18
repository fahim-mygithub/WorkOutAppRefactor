/**
 * Shared muscle-term vocabulary for the body map (Home) and the build wizard's
 * muscle-group picker. Extracted here so both consumers agree on exactly which
 * SVG group ids map to which exercise search term — the term must be a substring
 * of the catalog's (comma-joined) `muscleGroup` field, matching the
 * `filterByMuscle` reducer used by the Home deep-link.
 */

/**
 * SVG `<g id="...">` → exercise search term. Covers anterior + posterior group
 * ids. Several ids deliberately collapse to ONE term (e.g. front/rear shoulders
 * → "Shoulders", traps + traps-middle → "Traps"), so selection logic must dedupe
 * by term, not by id. Ids with no useful mapping (hands, joint markers) are
 * absent, so clicking them is a no-op.
 */
export const MUSCLE_TERMS: Record<string, string> = {
  // front
  chest: 'Chest',
  biceps: 'Biceps',
  forearms: 'Forearms',
  'front-shoulders': 'Shoulders',
  abdominals: 'Abdominals',
  obliques: 'Obliques',
  quads: 'Quads',
  calves: 'Calves',
  traps: 'Traps',
  // back
  'traps-middle': 'Traps',
  'rear-shoulders': 'Shoulders',
  triceps: 'Triceps',
  lats: 'Lats',
  lowerback: 'Lower back',
  glutes: 'Glutes',
  hamstrings: 'Hamstrings',
};

/** Resolve an SVG group id to its term (undefined for unmapped/joint ids). */
export function muscleTermFromGroupId(id: string): string | undefined {
  return MUSCLE_TERMS[id];
}

/**
 * The distinct terms, deduped, in a head-to-toe-ish order. Used to render a
 * stable list of selected muscles and to drive the recommend engine.
 */
export const ALL_MUSCLE_TERMS: string[] = [
  'Chest',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Lats',
  'Traps',
  'Lower back',
  'Abdominals',
  'Obliques',
  'Glutes',
  'Quads',
  'Hamstrings',
  'Calves',
];

/** Set of every SVG id that maps to the given term (front + back ids). */
export function groupIdsForTerm(term: string): string[] {
  return Object.entries(MUSCLE_TERMS)
    .filter(([, t]) => t === term)
    .map(([id]) => id);
}
