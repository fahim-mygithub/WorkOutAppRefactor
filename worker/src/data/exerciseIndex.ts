/**
 * Exercise library resolver: matches exercise names to library exercises
 * (public/exercises.json) and user's custom exercises, resolving to real
 * exercise IDs, muscle groups, and equipment instead of 'Unknown' / fallback IDs.
 * Unmatched exercises keep deterministic fallback IDs (fallback-<hash>).
 */
import bundledExercises from './exerciseLibrary.json';
import { fallbackExerciseId } from './shapes';

export interface LibraryExercise {
  id: string;
  name: string;
  muscleGroups: string[];
  equipment: string;
  searchKeywords?: string[];
}

export interface CustomExerciseLike {
  id: string;
  name: string;
  muscleGroup?: string;
  muscleGroups?: string[];
  equipment?: string;
  searchKeywords?: string[];
}

export interface ResolvedExercise {
  id: string;
  name: string;
  matchedName: string;
  muscleGroups: string[];
  equipment: string;
  isFallback: boolean;
  matchedBy: 'custom' | 'library' | 'fallback';
}

const ABBREVIATIONS: Record<string, string> = {
  bb: 'barbell',
  db: 'dumbbell',
  dbs: 'dumbbell',
  kb: 'kettlebell',
  ez: 'ez',
  ohp: 'overhead press',
  rdl: 'romanian deadlift',
};

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

export function matchExerciseInList(name: string, library: readonly LibraryExercise[]): LibraryExercise | null {
  const query = exerciseTokens(name);
  if (query.length === 0 || library.length === 0) return null;
  const key = query.join(' ');

  const indexed = library.map((ex) => ({ ex, tokens: exerciseTokens(ex.name) }));

  // 0. shorthand alias
  const alias = ALIASES[key];
  if (alias) {
    const hit = indexed.find((c) => c.tokens.join(' ') === alias);
    if (hit) return hit.ex;
  }

  // 1. exact match
  const exact = indexed.find((c) => c.tokens.join(' ') === key);
  if (exact) return exact.ex;

  // 2. every query word present; rank by closeness
  const extra = (tokens: string[]) => tokens.filter((t) => !query.includes(t) && !EQUIPMENT.has(t)).length;
  const containing = indexed
    .filter((c) => query.every((q) => c.tokens.includes(q)))
    .sort(
      (a, b) =>
        extra(a.tokens) - extra(b.tokens) ||
        equipmentRank(a.tokens) - equipmentRank(b.tokens) ||
        a.ex.name.length - b.ex.name.length,
    );
  if (containing.length > 0) return containing[0].ex;

  // 3. typed text contains a whole library name
  const contained = indexed
    .filter((c) => c.tokens.length > 1 && c.tokens.every((t) => query.includes(t)))
    .sort((a, b) => b.tokens.length - a.tokens.length);
  if (contained.length > 0) return contained[0].ex;

  // 4. search keyword match
  const byKeyword = library.find((ex) =>
    (ex.searchKeywords ?? []).some((k) => exerciseTokens(k).join(' ') === key),
  );
  return byKeyword ?? null;
}

function matchCustomExercise(name: string, customList: readonly CustomExerciseLike[]): CustomExerciseLike | null {
  const query = exerciseTokens(name);
  if (query.length === 0 || customList.length === 0) return null;
  const key = query.join(' ');

  // Exact or keyword
  for (const c of customList) {
    if (exerciseTokens(c.name).join(' ') === key) return c;
    if (c.searchKeywords) {
      for (const kw of c.searchKeywords) {
        if (exerciseTokens(kw).join(' ') === key) return c;
      }
    }
  }

  // Subset containment
  for (const c of customList) {
    const cTokens = exerciseTokens(c.name);
    if (query.every((q) => cTokens.includes(q))) return c;
  }
  return null;
}

let memoryLibrary: LibraryExercise[] | null = null;

export function getCachedLibrary(): LibraryExercise[] {
  if (!memoryLibrary) {
    memoryLibrary = bundledExercises as LibraryExercise[];
  }
  return memoryLibrary;
}

export function setExerciseLibrary(library: LibraryExercise[]): void {
  memoryLibrary = library;
}

export async function fetchAndCacheLibrary(appOrigin: string): Promise<LibraryExercise[]> {
  try {
    const origin = appOrigin.endsWith('/') ? appOrigin : `${appOrigin}/`;
    const res = await fetch(`${origin}exercises.json`);
    if (res.ok) {
      const data = (await res.json()) as LibraryExercise[];
      if (Array.isArray(data) && data.length > 0) {
        memoryLibrary = data;
        return memoryLibrary;
      }
    }
  } catch {
    // Keep cached or bundled
  }
  return getCachedLibrary();
}

export function resolveExercise(
  name: string,
  customExercises?: readonly CustomExerciseLike[],
  library: readonly LibraryExercise[] = getCachedLibrary(),
): ResolvedExercise {
  const trimmed = name.trim();

  // 1. Check custom exercises first
  if (customExercises && customExercises.length > 0) {
    const customMatch = matchCustomExercise(trimmed, customExercises);
    if (customMatch) {
      const groups =
        customMatch.muscleGroups && customMatch.muscleGroups.length > 0
          ? customMatch.muscleGroups
          : customMatch.muscleGroup
            ? customMatch.muscleGroup.split(',').map((s) => s.trim()).filter(Boolean)
            : ['Custom'];
      return {
        id: customMatch.id,
        name: trimmed,
        matchedName: customMatch.name,
        muscleGroups: groups.length > 0 ? groups : ['Custom'],
        equipment: customMatch.equipment?.trim() || 'Custom',
        isFallback: false,
        matchedBy: 'custom',
      };
    }
  }

  // 2. Check library
  const libMatch = matchExerciseInList(trimmed, library);
  if (libMatch) {
    return {
      id: libMatch.id,
      name: trimmed,
      matchedName: libMatch.name,
      muscleGroups: libMatch.muscleGroups && libMatch.muscleGroups.length > 0 ? libMatch.muscleGroups : ['Unknown'],
      equipment: libMatch.equipment || 'Unknown',
      isFallback: false,
      matchedBy: 'library',
    };
  }

  // 3. Fallback id
  return {
    id: fallbackExerciseId(trimmed),
    name: trimmed,
    matchedName: trimmed,
    muscleGroups: ['Unknown'],
    equipment: 'Unknown',
    isFallback: true,
    matchedBy: 'fallback',
  };
}
