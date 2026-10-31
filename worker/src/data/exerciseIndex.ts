/**
 * Exercise library resolver: matches exercise names to library exercises
 * (public/exercises.json) and user's custom exercises, resolving to real
 * exercise IDs, muscle groups, and equipment instead of 'Unknown' / fallback IDs.
 * Unmatched exercises keep deterministic fallback IDs (fallback-<hash>).
 */
import bundledExercises from './exerciseLibrary.json';
import { fallbackExerciseId } from './shapes';
import { getSynonymPhrases } from './exerciseSynonyms';

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

export interface HistoryExerciseLike {
  exerciseId: string;
  exerciseName: string;
  workoutDate?: Date | string;
  muscleGroups?: string[];
  equipment?: string;
}

export interface ResolvedExercise {
  id: string;
  name: string;
  matchedName: string;
  muscleGroups: string[];
  equipment: string;
  isFallback: boolean;
  matchedBy: 'history' | 'custom' | 'library' | 'fallback';
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

export function matchCustomExercise(name: string, customList: readonly CustomExerciseLike[]): CustomExerciseLike | null {
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


function toTimestamp(d?: Date | string | number | null): number {
  if (!d) return 0;
  if (d instanceof Date) return d.getTime();
  const t = new Date(d).getTime();
  return isNaN(t) ? 0 : t;
}

/**
 * Match a name against the user's own history/stats. EXACT normalised name or
 * alias only: a subset/partial match would let "Bench Press" inherit the id and
 * stats of "Incline Barbell Bench Press" (a different exercise). Most recent wins.
 */
export function matchHistoryExercise(
  name: string,
  historyList: readonly HistoryExerciseLike[],
): HistoryExerciseLike | null {
  const query = exerciseTokens(name);
  if (query.length === 0 || historyList.length === 0) return null;
  const key = query.join(' ');
  const alias = ALIASES[key];

  const candidates: HistoryExerciseLike[] = [];
  for (const h of historyList) {
    if (!h.exerciseName) continue;
    const hKey = exerciseTokens(h.exerciseName).join(' ');
    if (
      hKey === key ||
      (alias !== undefined && hKey === alias) ||
      (ALIASES[hKey] !== undefined && ALIASES[hKey] === key)
    ) {
      candidates.push(h);
    }
  }
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const timeA = toTimestamp(a.workoutDate);
    const timeB = toTimestamp(b.workoutDate);
    if (timeB !== timeA) return timeB - timeA;
    return (b.muscleGroups?.length ?? 0) - (a.muscleGroups?.length ?? 0);
  });
  return candidates[0];
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
  historyExercises?: readonly HistoryExerciseLike[],
): ResolvedExercise {
  const trimmed = name.trim();

  // 1. Check user's history / stats first (most recent wins)
  if (historyExercises && historyExercises.length > 0) {
    let historyMatch = matchHistoryExercise(trimmed, historyExercises);
    // Also try the library-resolved and custom-resolved canonical names against history
    // (same exact-only matcher, so a variant in history never stands in for the base exercise).
    if (!historyMatch) {
      const libCandidate = matchExerciseInList(trimmed, library);
      if (libCandidate) {
        historyMatch = matchHistoryExercise(libCandidate.name, historyExercises);
      }
    }
    if (!historyMatch && customExercises && customExercises.length > 0) {
      const customCandidate = matchCustomExercise(trimmed, customExercises);
      if (customCandidate) {
        historyMatch = matchHistoryExercise(customCandidate.name, historyExercises);
      }
    }
    if (historyMatch) {
      const libMatch = matchExerciseInList(trimmed, library);
      const rawGroups = historyMatch.muscleGroups?.filter(Boolean);
      const hasGoodGroups =
        rawGroups &&
        rawGroups.length > 0 &&
        !(rawGroups.length === 1 && rawGroups[0].toLowerCase() === 'unknown');
      const muscleGroups = hasGoodGroups
        ? rawGroups!
        : libMatch?.muscleGroups && libMatch.muscleGroups.length > 0
          ? libMatch.muscleGroups
          : ['Unknown'];
      const equipment =
        historyMatch.equipment && historyMatch.equipment.toLowerCase() !== 'unknown'
          ? historyMatch.equipment
          : libMatch?.equipment || 'Unknown';

      return {
        id: historyMatch.exerciseId,
        name: trimmed,
        matchedName: historyMatch.exerciseName,
        muscleGroups,
        equipment,
        isFallback: historyMatch.exerciseId.startsWith('fallback-'),
        matchedBy: 'history',
      };
    }
  }

  // 2. Check custom exercises
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

  // 3. Check library
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

  // 4. Fallback id
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

export interface SearchExerciseResult {
  id: string;
  name: string;
  muscles: string[];
  muscleGroups: string[];
  equipment: string;
  custom: boolean;
  isCustom: boolean;
  mediaUrl?: string;
}

export interface SearchExerciseIndexResult {
  results: SearchExerciseResult[];
  exercises: SearchExerciseResult[];
  total: number;
  returned: number;
  truncated: boolean;
  allMatches?: SearchExerciseResult[];
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], prev, row[j]) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

function hasConsecutiveTokens(tokens: readonly string[], sub: readonly string[]): boolean {
  if (sub.length === 0) return true;
  if (tokens.length < sub.length) return false;
  for (let i = 0; i <= tokens.length - sub.length; i++) {
    let match = true;
    for (let j = 0; j < sub.length; j++) {
      if (tokens[i + j] !== sub[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

function getEquipmentTier(equipment?: string, name?: string): number {
  const eq = (equipment || '').toLowerCase();
  const n = (name || '').toLowerCase();

  // Tier 0: Most common plain variants: machine, barbell, dumbbell, cable
  const isCommon =
    (eq.includes('machine') && !eq.includes('smith')) ||
    eq.includes('barbell') ||
    eq.includes('dumbbell') ||
    eq.includes('cable') ||
    (n.startsWith('machine') && !n.startsWith('smith machine')) ||
    n.startsWith('barbell') ||
    n.startsWith('dumbbell') ||
    n.startsWith('cable');

  if (isCommon) return 0;

  // Tier 1: Bodyweight
  if (eq.includes('bodyweight') || n.includes('bodyweight')) return 1;

  // Tier 2: Smith-machine, Plate, EZ
  if (eq.includes('smith') || eq.includes('plate') || eq.includes('ez') || n.includes('smith')) return 2;

  // Tier 3: Kettlebell
  if (eq.includes('kettlebell') || n.includes('kettlebell')) return 3;

  // Tier 4: Band
  if (eq.includes('band') || n.includes('band')) return 4;

  return 5;
}

function getEquipmentRank(equipment?: string, name?: string): number {
  const eq = (equipment || '').toLowerCase();
  const n = (name || '').toLowerCase();
  for (let i = 0; i < EQUIPMENT_PRIORITY.length; i++) {
    const item = EQUIPMENT_PRIORITY[i];
    if (eq.includes(item) || n.includes(item)) {
      return i;
    }
  }
  return EQUIPMENT_PRIORITY.length;
}

export function searchExerciseIndex(
  query: string,
  customExercises: readonly (CustomExerciseLike & { videoLinks?: string[] })[] = [],
  library: readonly LibraryExercise[] = getCachedLibrary(),
  limit: number = 10,
): SearchExerciseIndexResult {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return {
      results: [],
      exercises: [],
      total: 0,
      returned: 0,
      truncated: false,
      allMatches: [],
    };
  }

  const qTokens = exerciseTokens(trimmed);
  const qKey = qTokens.join(' ');
  const alias = ALIASES[qKey];

  interface ScoredCandidate {
    result: SearchExerciseResult;
    tier: number;
  }

  const scored: ScoredCandidate[] = [];
  const seenIds = new Set<string>();

  const evaluateCandidate = (
    c: {
      id: string;
      name: string;
      muscleGroups?: string[];
      muscleGroup?: string;
      equipment?: string;
      searchKeywords?: string[];
      videoLinks?: string[];
    },
    isCustom: boolean,
  ) => {
    if (seenIds.has(c.id)) return;

    const nameLower = c.name.toLowerCase().trim();
    const cTokens = exerciseTokens(c.name);
    const cKey = cTokens.join(' ');

    let tier = 0;

    // 1. Exact name match
    if (nameLower === trimmed || (qTokens.length > 0 && cKey === qKey)) {
      tier = 1;
    }
    // 2. Name starts with the query
    else if (
      nameLower.startsWith(trimmed) ||
      (qTokens.length > 0 &&
        cTokens.length >= qTokens.length &&
        cTokens.slice(0, qTokens.length).join(' ') === qKey)
    ) {
      tier = 2;
    }
    // 3. Name contains the whole phrase as consecutive words
    else if (
      nameLower.includes(trimmed) ||
      (qTokens.length > 0 && hasConsecutiveTokens(cTokens, qTokens))
    ) {
      tier = 3;
    }
    // 4. All query words present (any order)
    else if (qTokens.length > 0 && qTokens.every((q) => cTokens.includes(q))) {
      tier = 4;
    }
    // 5. Alias or searchKeywords hit
    else if (
      (alias && (cKey === alias || exerciseTokens(alias).every((t) => cTokens.includes(t)))) ||
      (ALIASES[cKey] && ALIASES[cKey] === qKey) ||
      (c.searchKeywords &&
        c.searchKeywords.some((k) => {
          const kLower = k.toLowerCase().trim();
          const kTokens = exerciseTokens(k);
          const kKey = kTokens.join(' ');
          return (
            kLower === trimmed ||
            (qTokens.length > 0 && kKey === qKey) ||
            kLower.startsWith(trimmed) ||
            kLower.includes(trimmed) ||
            (qTokens.length > 0 && qTokens.every((q) => kTokens.includes(q)))
          );
        }))
    ) {
      tier = 5;
    }

    if (tier > 0) {
      seenIds.add(c.id);
      const groups =
        c.muscleGroups && c.muscleGroups.length > 0
          ? c.muscleGroups
          : c.muscleGroup
            ? c.muscleGroup.split(',').map((s) => s.trim()).filter(Boolean)
            : isCustom
              ? ['Custom']
              : [];
      const mediaUrl =
        Array.isArray(c.videoLinks) && c.videoLinks.length > 0 ? c.videoLinks[0] : undefined;
      scored.push({
        tier,
        result: {
          id: c.id,
          name: c.name,
          muscles: groups,
          muscleGroups: groups,
          equipment: c.equipment || (isCustom ? 'Custom' : 'Unknown'),
          custom: isCustom,
          isCustom,
          mediaUrl,
        },
      });
    }
  };

  for (const c of customExercises) {
    evaluateCandidate(c, true);
  }
  for (const lib of library) {
    evaluateCandidate(lib, false);
  }

  const synonymPhrases = getSynonymPhrases(trimmed);
  if (synonymPhrases.length > 0) {
    const evaluateSynonymCandidate = (
      c: {
        id: string;
        name: string;
        muscleGroups?: string[];
        muscleGroup?: string;
        equipment?: string;
        searchKeywords?: string[];
        videoLinks?: string[];
      },
      isCustom: boolean,
    ) => {
      if (seenIds.has(c.id)) return;

      const nameLower = c.name.toLowerCase().trim();
      const cTokens = exerciseTokens(c.name);
      const cKey = cTokens.join(' ');

      let bestSynTier = Infinity;

      for (const syn of synonymPhrases) {
        const sTrimmed = syn.toLowerCase().trim();
        const sTokens = exerciseTokens(sTrimmed);
        const sKey = sTokens.join(' ');
        const sAlias = ALIASES[sKey];

        let tier = 0;
        if (nameLower === sTrimmed || (sTokens.length > 0 && cKey === sKey)) {
          tier = 1;
        } else if (
          nameLower.startsWith(sTrimmed) ||
          (sTokens.length > 0 &&
            cTokens.length >= sTokens.length &&
            cTokens.slice(0, sTokens.length).join(' ') === sKey)
        ) {
          tier = 2;
        } else if (
          nameLower.includes(sTrimmed) ||
          (sTokens.length > 0 && hasConsecutiveTokens(cTokens, sTokens))
        ) {
          tier = 3;
        } else if (sTokens.length > 0 && sTokens.every((q) => cTokens.includes(q))) {
          tier = 4;
        } else if (
          (sAlias && (cKey === sAlias || exerciseTokens(sAlias).every((t) => cTokens.includes(t)))) ||
          (ALIASES[cKey] && ALIASES[cKey] === sKey) ||
          (c.searchKeywords &&
            c.searchKeywords.some((k) => {
              const kLower = k.toLowerCase().trim();
              const kTokens = exerciseTokens(k);
              const kKey = kTokens.join(' ');
              return (
                kLower === sTrimmed ||
                (sTokens.length > 0 && kKey === sKey) ||
                kLower.startsWith(sTrimmed) ||
                kLower.includes(sTrimmed) ||
                (sTokens.length > 0 && sTokens.every((q) => kTokens.includes(q)))
              );
            }))
        ) {
          tier = 5;
        }

        if (tier > 0 && tier < bestSynTier) {
          bestSynTier = tier;
        }
      }

      if (bestSynTier !== Infinity) {
        seenIds.add(c.id);
        const groups =
          c.muscleGroups && c.muscleGroups.length > 0
            ? c.muscleGroups
            : c.muscleGroup
              ? c.muscleGroup.split(',').map((s) => s.trim()).filter(Boolean)
              : isCustom
                ? ['Custom']
                : [];
        const mediaUrl =
          Array.isArray(c.videoLinks) && c.videoLinks.length > 0 ? c.videoLinks[0] : undefined;
        scored.push({
          tier: 10 + bestSynTier,
          result: {
            id: c.id,
            name: c.name,
            muscles: groups,
            muscleGroups: groups,
            equipment: c.equipment || (isCustom ? 'Custom' : 'Unknown'),
            custom: isCustom,
            isCustom,
            mediaUrl,
          },
        });
      }
    };

    for (const c of customExercises) {
      evaluateSynonymCandidate(c, true);
    }
    for (const lib of library) {
      evaluateSynonymCandidate(lib, false);
    }
  }

  scored.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;

    // Most common plain variant: machine/barbell/dumbbell/cable before band/kettlebell
    const eqA = getEquipmentTier(a.result.equipment, a.result.name);
    const eqB = getEquipmentTier(b.result.equipment, b.result.name);
    if (eqA !== eqB) return eqA - eqB;

    // Shorter names first
    if (a.result.name.length !== b.result.name.length) {
      return a.result.name.length - b.result.name.length;
    }

    // Equipment priority tiebreak
    const rankA = getEquipmentRank(a.result.equipment, a.result.name);
    const rankB = getEquipmentRank(b.result.equipment, b.result.name);
    if (rankA !== rankB) return rankA - rankB;

    // Custom before library on ties
    if (a.result.custom !== b.result.custom) {
      return a.result.custom ? -1 : 1;
    }

    return a.result.name.localeCompare(b.result.name);
  });

  // Typo-tolerant fuzzy matching only when nothing matches
  if (scored.length === 0 && qTokens.length > 0) {
    interface FuzzyCandidate {
      result: SearchExerciseResult;
      distance: number;
    }
    const fuzzyScored: FuzzyCandidate[] = [];

    const evaluateFuzzy = (
      c: {
        id: string;
        name: string;
        muscleGroups?: string[];
        muscleGroup?: string;
        equipment?: string;
        videoLinks?: string[];
      },
      isCustom: boolean,
    ) => {
      const cTokens = exerciseTokens(c.name);
      if (cTokens.length === 0) return;

      let allMatched = true;
      let totalDist = 0;

      for (const q of qTokens) {
        const maxDist = q.length <= 4 ? 1 : 2;
        let bestTokenDist = Infinity;
        for (const ct of cTokens) {
          const dist = levenshteinDistance(q, ct);
          if (dist < bestTokenDist) {
            bestTokenDist = dist;
          }
        }
        if (bestTokenDist <= maxDist) {
          totalDist += bestTokenDist;
        } else {
          allMatched = false;
          break;
        }
      }

      if (allMatched) {
        const groups =
          c.muscleGroups && c.muscleGroups.length > 0
            ? c.muscleGroups
            : c.muscleGroup
              ? c.muscleGroup.split(',').map((s) => s.trim()).filter(Boolean)
              : isCustom
                ? ['Custom']
                : [];
        const mediaUrl =
          Array.isArray(c.videoLinks) && c.videoLinks.length > 0 ? c.videoLinks[0] : undefined;
        fuzzyScored.push({
          distance: totalDist,
          result: {
            id: c.id,
            name: c.name,
            muscles: groups,
            muscleGroups: groups,
            equipment: c.equipment || (isCustom ? 'Custom' : 'Unknown'),
            custom: isCustom,
            isCustom,
            mediaUrl,
          },
        });
      }
    };

    for (const c of customExercises) {
      evaluateFuzzy(c, true);
    }
    for (const lib of library) {
      evaluateFuzzy(lib, false);
    }

    fuzzyScored.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      const eqA = getEquipmentTier(a.result.equipment, a.result.name);
      const eqB = getEquipmentTier(b.result.equipment, b.result.name);
      if (eqA !== eqB) return eqA - eqB;
      if (a.result.name.length !== b.result.name.length) {
        return a.result.name.length - b.result.name.length;
      }
      if (a.result.custom !== b.result.custom) {
        return a.result.custom ? -1 : 1;
      }
      return a.result.name.localeCompare(b.result.name);
    });

    for (const f of fuzzyScored) {
      scored.push({ tier: 6, result: f.result });
    }
  }

  const allMatches = scored.map((s) => s.result);
  const total = allMatches.length;
  const results = allMatches.slice(0, limit);
  const returned = results.length;
  const truncated = total > returned;

  return {
    results,
    exercises: results,
    total,
    returned,
    truncated,
    allMatches,
  };
}
