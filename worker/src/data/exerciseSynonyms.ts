/**
 * Reviewed synonym table for exercise search.
 * Gym slang and alternate spellings are mapped to canonical library phrases.
 * Every target phrase in this table must resolve to >= 1 exercise in exerciseLibrary.json.
 */

export const EXERCISE_SYNONYMS: Record<string, readonly string[]> = {
  // Pec deck / chest fly machine / butterfly machine -> machine pec fly
  'pec deck': ['machine pec fly'],
  'pec dec': ['machine pec fly'],
  'peck deck': ['machine pec fly'],
  'peck dec': ['machine pec fly'],
  'chest fly machine': ['machine pec fly'],
  'butterfly machine': ['machine pec fly'],
  'butterfly': ['machine pec fly'],
  'pec fly machine': ['machine pec fly'],

  // Lat pulldown spellings -> machine pulldown
  'lat pulldown': ['machine pulldown'],
  'lat pull down': ['machine pulldown'],

  // Smith machine
  'smith': ['smith machine'],

  // RDL -> romanian deadlift
  'rdl': ['romanian deadlift'],
  'rdls': ['romanian deadlift'],

  // OHP / shoulder press -> overhead press
  'ohp': ['overhead press'],
  'shoulder press': ['overhead press'],
  'shoulder presses': ['overhead press'],

  // Skull crusher / skullcrusher -> lying triceps extension
  'skull crusher': ['skullcrusher', 'lying triceps extension'],
  'skull crushers': ['skullcrusher', 'lying triceps extension'],
  'skullcrusher': ['skull crusher', 'lying triceps extension'],
  'skullcrushers': ['skull crusher', 'lying triceps extension'],
  'lying triceps extension': ['skullcrusher'],
  'lying tricep extension': ['skullcrusher'],

  // db / bb / kb -> dumbbell / barbell / kettlebell
  'db': ['dumbbell'],
  'bb': ['barbell'],
  'kb': ['kettlebell'],

  // Hack squat
  'hack': ['hack squat'],
  'hacksquat': ['hack squat'],
  'hacksquats': ['hack squat'],
  'hack squats': ['hack squat'],

  // Leg curl / hamstring curl
  'legcurl': ['leg curl'],
  'legcurls': ['leg curl'],
  'hamstring curl': ['leg curl'],
  'hamstring curls': ['leg curl'],
  'ham curl': ['hamstring curl'],
  'ham curls': ['hamstring curl'],
  'leg curl': ['hamstring curl'],
  'leg curls': ['hamstring curl'],

  // Leg extension
  'legextension': ['leg extension'],
  'legextensions': ['leg extension'],
  'quad extension': ['leg extension'],
  'quad extensions': ['leg extension'],

  // Preacher curl
  'preacher': ['preacher curl'],
  'preachercurl': ['preacher curl'],
  'preachercurls': ['preacher curl'],
  'preacher curls': ['preacher curl'],

  // Face pull
  'facepull': ['face pull'],
  'facepulls': ['face pull'],
  'face pulls': ['face pull'],
  'face-pull': ['face pull'],
  'face-pulls': ['face pull'],

  // T-bar row
  't bar': ['t bar row'],
  'tbar': ['t bar row'],
  't-bar': ['t bar row'],
  'tbar row': ['t bar row'],
  'tbar rows': ['t bar row'],
  't-bar row': ['t bar row'],
  't-bar rows': ['t bar row'],
  't bar row': ['t bar row'],
  't bar rows': ['t bar row'],

  // Pull up / chin up
  'pullup': ['pull up'],
  'pullups': ['pull up'],
  'pull up': ['pull up'],
  'pull ups': ['pull up'],
  'pull-up': ['pull up'],
  'pull-ups': ['pull up'],
  'chinup': ['chin up'],
  'chinups': ['chin up'],
  'chin up': ['chin up'],
  'chin ups': ['chin up'],
  'chin-up': ['chin up'],
  'chin-ups': ['chin up'],
  'chins': ['chin up'],
};

function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singularWord(word: string): string {
  if (word.length > 3 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('es') && /(ch|sh|ss|x)es$/.test(word)) return word.slice(0, -2);
  if (word.length >= 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function normalizeTokens(text: string): string[] {
  return normalizeKey(text)
    .split(' ')
    .filter(Boolean)
    .map(singularWord);
}

/**
 * Returns a deduplicated list of all target phrases defined in the synonym table.
 */
export function getAllSynonymTargets(): string[] {
  const set = new Set<string>();
  for (const targets of Object.values(EXERCISE_SYNONYMS)) {
    for (const t of targets) {
      set.add(t);
    }
  }
  return Array.from(set);
}

/**
 * Given a raw user query, returns extra query phrasings derived from gym slang and synonyms.
 * Never includes the user's exact query itself or phrases equivalent to it.
 */
export function getSynonymPhrases(query: string): string[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const qTokens = normalizeTokens(trimmed);
  if (qTokens.length === 0) return [];
  const qJoined = qTokens.join(' ');
  const rawNorm = normalizeKey(trimmed);

  // 1. Direct whole-query match
  const directHits = [
    ...(EXERCISE_SYNONYMS[qJoined] ?? []),
    ...(EXERCISE_SYNONYMS[rawNorm] ?? []),
    ...(EXERCISE_SYNONYMS[trimmed] ?? []),
  ];
  if (directHits.length > 0) {
    const directSet = new Set<string>();
    for (const hit of directHits) {
      if (normalizeTokens(hit).join(' ') !== qJoined) {
        directSet.add(hit);
      }
    }
    return Array.from(directSet);
  }

  // 2. Subphrase replacement if no direct whole-query match
  const phrases = new Set<string>();
  const sortedEntries = Object.entries(EXERCISE_SYNONYMS).sort(
    (a, b) => normalizeTokens(b[0]).length - normalizeTokens(a[0]).length,
  );

  for (const [key, targets] of sortedEntries) {
    const kTokens = normalizeTokens(key);
    if (kTokens.length === 0 || kTokens.length > qTokens.length) continue;

    for (let i = 0; i <= qTokens.length - kTokens.length; i++) {
      let matches = true;
      for (let j = 0; j < kTokens.length; j++) {
        if (qTokens[i + j] !== kTokens[j]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        for (const target of targets) {
          const tTokens = normalizeTokens(target);
          const substituted = [
            ...qTokens.slice(0, i),
            ...tTokens,
            ...qTokens.slice(i + kTokens.length),
          ].join(' ');
          if (substituted && substituted !== qJoined) {
            phrases.add(substituted);
          }
        }
      }
    }
    if (phrases.size > 0) {
      break;
    }
  }

  return Array.from(phrases);
}
