/**
 * Match a typed exercise name ("bench press", "Squats", "DB curl") to the
 * library. The old matcher took the FIRST library entry whose name contained
 * the text, so "bench press" became "Barbell Larsen Bench Press" (it sorts
 * first). This one ranks candidates instead:
 *
 *   0. common gym shorthand ("barbell row", "lat pulldown") via a small alias table
 *   1. exact name (after normalising case, spacing, plurals, abbreviations)
 *   2. names containing every typed word — fewest extra words wins (equipment
 *      words don't count as extra), then the most common equipment (barbell,
 *      dumbbell, …), then the shorter name
 *   3. typed text containing a whole library name ("flat barbell bench press")
 *      — the longest such name wins
 *   4. a search keyword equal to the typed text
 */
import type { Exercise } from '../types/exercise';

const ABBREVIATIONS: Record<string, string> = {
  bb: 'barbell',
  db: 'dumbbell',
  dbs: 'dumbbell',
  kb: 'kettlebell',
  ez: 'ez',
  ohp: 'overhead press',
  rdl: 'romanian deadlift',
};

/** Equipment, in the order people usually mean when they leave it out. */
const EQUIPMENT_PRIORITY = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'smith',
  'ez',
  'band',
  'plate',
];
const EQUIPMENT = new Set(EQUIPMENT_PRIORITY);

/**
 * Shorthand whose best library entry isn't the "closest" by words (e.g. the
 * fewest-words barbell row is the Meadows row). Keys and values are
 * normalised token strings; a value missing from the library is ignored.
 */
const ALIASES: Record<string, string> = {
  'barbell row': 'barbell bent over row',
  'bent over row': 'barbell bent over row',
  row: 'barbell bent over row',
  'lat pulldown': 'machine pulldown',
  'lat pull down': 'machine pulldown',
  pulldown: 'machine pulldown',
  dip: 'parallel bar dip',
  curl: 'dumbbell curl',
  'bicep curl': 'dumbbell curl',
  'biceps curl': 'dumbbell curl',
  plank: 'hand plank',
};

function singular(word: string): string {
  if (word.length > 3 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('es') && /(ch|sh|ss|x)es$/.test(word)) return word.slice(0, -2);
  if (word.length >= 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export function exerciseTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((w) => (ABBREVIATIONS[w] ?? w).split(' '))
    .map(singular);
}

function equipmentRank(tokens: string[]): number {
  const i = EQUIPMENT_PRIORITY.indexOf(tokens[0]);
  return i === -1 ? EQUIPMENT_PRIORITY.length : i;
}

export function matchExercise(name: string, library: readonly Exercise[]): Exercise | null {
  const query = exerciseTokens(name);
  if (query.length === 0 || library.length === 0) return null;
  const key = query.join(' ');

  const indexed = library.map((ex) => ({ ex, tokens: exerciseTokens(ex.name) }));

  // 0. shorthand
  const alias = ALIASES[key];
  if (alias) {
    const hit = indexed.find((c) => c.tokens.join(' ') === alias);
    if (hit) return hit.ex;
  }

  // 1. exact
  const exact = indexed.find((c) => c.tokens.join(' ') === key);
  if (exact) return exact.ex;

  // 2. every typed word present; rank by closeness
  const extra = (tokens: string[]) =>
    tokens.filter((t) => !query.includes(t) && !EQUIPMENT.has(t)).length;
  const containing = indexed
    .filter((c) => query.every((q) => c.tokens.includes(q)))
    .sort(
      (a, b) =>
        extra(a.tokens) - extra(b.tokens) ||
        equipmentRank(a.tokens) - equipmentRank(b.tokens) ||
        a.ex.name.length - b.ex.name.length,
    );
  if (containing.length > 0) return containing[0].ex;

  // 3. the typed text contains a whole library name
  const contained = indexed
    .filter((c) => c.tokens.length > 1 && c.tokens.every((t) => query.includes(t)))
    .sort((a, b) => b.tokens.length - a.tokens.length);
  if (contained.length > 0) return contained[0].ex;

  // 4. keyword
  const byKeyword = library.find((ex) =>
    (ex.searchKeywords ?? []).some((k) => exerciseTokens(k).join(' ') === key),
  );
  return byKeyword ?? null;
}
