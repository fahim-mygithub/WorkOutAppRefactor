import { Exercise } from '../types/exercise';

// Common exercise abbreviations and shortcuts
export const SEARCH_SHORTCUTS: Record<string, string> = {
  'bp': 'bench press',
  'ohp': 'overhead press',
  'mp': 'military press',
  'dl': 'deadlift',
  'rdl': 'romanian deadlift',
  'sq': 'squat',
  'bb': 'barbell',
  'db': 'dumbbell',
  'kb': 'kettlebell',
  'ez': 'ez bar',
  'cgbp': 'close grip bench press',
  'lp': 'leg press',
  'hp': 'hip press',
  'ip': 'incline press',
  'dp': 'decline press',
  'fp': 'floor press',
  'pp': 'push press',
  'btn': 'behind the neck',
  'btn press': 'behind the neck press',
  'tng': 'touch and go',
  '1rm': 'one rep max',
  'pr': 'personal record',
  'max': 'maximum',
  // Common exercise name variations
  'pullup': 'pull up',
  'pushup': 'push up',
  'chinup': 'chin up',
  'situp': 'sit up',
  'setup': 'set up',
  'warmup': 'warm up',
  'cooldown': 'cool down',
};

// Exercise name synonyms
export const EXERCISE_SYNONYMS: Record<string, string[]> = {
  'overhead press': ['military press', 'shoulder press', 'standing press'],
  'military press': ['overhead press', 'shoulder press', 'standing press'],
  'bench press': ['chest press', 'flat press'],
  'chest press': ['bench press', 'flat press'],
  'deadlift': ['dl', 'dead lift'],
  'squat': ['back squat', 'barbell squat'],
  'row': ['bent over row', 'barbell row'],
  'curl': ['bicep curl', 'arm curl'],
  'extension': ['tricep extension', 'arm extension'],
  'fly': ['flye', 'chest fly', 'pec fly'],
  'raise': ['lateral raise', 'side raise'],
  'pulldown': ['lat pulldown', 'lateral pulldown'],
  'pullup': ['pull up', 'chin up'],
  'pushup': ['push up'],
  'situp': ['sit up', 'crunch'],
  'plank': ['front plank', 'forearm plank'],
};

export interface SearchMatch {
  exercise: Exercise;
  score: number;
  matchType: string;
  matchedWords: string[];
  highlightRanges: Array<{ start: number; end: number }>;
}

export interface SearchOptions {
  maxResults?: number;
  minScore?: number;
  fuzzyTolerance?: number;
  enableAbbreviations?: boolean;
  enableSynonyms?: boolean;
}

/**
 * Tokenize a string into words, handling common cases
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ') // Replace special chars with spaces except hyphens
    .replace(/[-_]/g, ' ') // Convert hyphens and underscores to spaces
    .split(/\s+/)
    .filter(word => word.length > 0)
    .filter(word => !['and', 'or', 'the', 'a', 'an', 'with', 'using', 'on'].includes(word)); // Remove stop words
}

/**
 * Expand abbreviations in search query
 */
export function expandQuery(query: string): string {
  let expanded = query.toLowerCase();

  // Replace known abbreviations
  Object.entries(SEARCH_SHORTCUTS).forEach(([abbrev, expansion]) => {
    const regex = new RegExp(`\\b${abbrev}\\b`, 'gi');
    expanded = expanded.replace(regex, expansion);
  });

  return expanded;
}

/**
 * Get synonyms for a given term
 */
export function getSynonyms(term: string): string[] {
  const synonyms: string[] = [];

  Object.entries(EXERCISE_SYNONYMS).forEach(([key, values]) => {
    if (key.includes(term) || values.some(v => v.includes(term))) {
      synonyms.push(key, ...values);
    }
  });

  return [...new Set(synonyms)].filter(syn => syn !== term);
}

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[j][i] = matrix[j - 1][i - 1];
      } else {
        matrix[j][i] = Math.min(
          matrix[j - 1][i - 1] + 1, // substitution
          matrix[j][i - 1] + 1,     // insertion
          matrix[j - 1][i] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Check if a string is a fuzzy match (with typo tolerance)
 */
export function isFuzzyMatch(term: string, target: string, tolerance: number = 2): boolean {
  if (term.length < 3) return false; // Don't fuzzy match very short terms

  const distance = levenshteinDistance(term, target);
  const maxLength = Math.max(term.length, target.length);

  // Allow distance up to tolerance or 20% of the longer string
  return distance <= tolerance && distance <= Math.ceil(maxLength * 0.2);
}

/**
 * Find highlight ranges for matched terms in text
 */
export function findHighlightRanges(text: string, searchTerms: string[]): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  const lowerText = text.toLowerCase();

  searchTerms.forEach(term => {
    const lowerTerm = term.toLowerCase();
    let startIndex = 0;

    while (true) {
      const index = lowerText.indexOf(lowerTerm, startIndex);
      if (index === -1) break;

      ranges.push({
        start: index,
        end: index + term.length
      });

      startIndex = index + 1;
    }
  });

  // Merge overlapping ranges
  return ranges
    .sort((a, b) => a.start - b.start)
    .reduce((merged: Array<{ start: number; end: number }>, current) => {
      if (merged.length === 0) {
        return [current];
      }

      const last = merged[merged.length - 1];
      if (current.start <= last.end) {
        last.end = Math.max(last.end, current.end);
        return merged;
      } else {
        return [...merged, current];
      }
    }, []);
}

/**
 * Calculate match score for an exercise based on search query
 */
export function calculateMatchScore(
  exercise: Exercise,
  searchQuery: string,
  options: SearchOptions = {}
): SearchMatch | null {
  const {
    fuzzyTolerance = 2,
    enableAbbreviations = true,
    enableSynonyms = true,
  } = options;

  // Expand the search query
  const expandedQuery = enableAbbreviations ? expandQuery(searchQuery) : searchQuery;
  const queryWords = tokenize(expandedQuery);

  if (queryWords.length === 0) return null;

  // Tokenize exercise data
  const exerciseNameWords = tokenize(exercise.name);
  const muscleGroupWords = tokenize(exercise.muscleGroup);
  const equipmentWords = tokenize(exercise.equipment);
  const keywordWords = exercise.searchKeywords.flatMap(kw => tokenize(kw));

  let totalScore = 0;
  let matchType = '';
  const matchedWords: string[] = [];
  const allMatches: string[] = [];

  // 1. Exact full name match (1000 points)
  if (exercise.name.toLowerCase() === expandedQuery.toLowerCase()) {
    totalScore = 1000;
    matchType = 'exact';
    matchedWords.push(exercise.name);
    allMatches.push(expandedQuery);
  }

  // 2. Exercise name starts with query (900 points)
  else if (exercise.name.toLowerCase().startsWith(expandedQuery.toLowerCase())) {
    totalScore = 900;
    matchType = 'name-prefix';
    matchedWords.push(exercise.name);
    allMatches.push(expandedQuery);
  }

  // 3. Word-based matching
  else {
    let wordMatchScore = 0;
    let bestMatchType = '';

    queryWords.forEach(queryWord => {
      let wordScore = 0;
      let wordMatchType = '';

      // Check exercise name words
      exerciseNameWords.forEach(nameWord => {
        if (nameWord === queryWord) {
          wordScore = Math.max(wordScore, 800); // Exact word match
          wordMatchType = 'word-exact';
          matchedWords.push(nameWord);
          allMatches.push(queryWord);
        } else if (nameWord.startsWith(queryWord)) {
          wordScore = Math.max(wordScore, 750); // Word starts with query
          wordMatchType = 'word-prefix';
          matchedWords.push(nameWord);
          allMatches.push(queryWord);
        } else if (nameWord.includes(queryWord)) {
          wordScore = Math.max(wordScore, 600); // Word contains query
          wordMatchType = 'word-contains';
          matchedWords.push(nameWord);
          allMatches.push(queryWord);
        } else if (isFuzzyMatch(queryWord, nameWord, fuzzyTolerance)) {
          wordScore = Math.max(wordScore, 400); // Fuzzy match
          wordMatchType = 'fuzzy';
          matchedWords.push(nameWord);
          allMatches.push(queryWord);
        }
      });

      // Check muscle group (lower priority)
      muscleGroupWords.forEach(muscleWord => {
        if (muscleWord === queryWord) {
          wordScore = Math.max(wordScore, 300);
          wordMatchType = wordMatchType || 'muscle-exact';
          allMatches.push(queryWord);
        } else if (muscleWord.startsWith(queryWord)) {
          wordScore = Math.max(wordScore, 250);
          wordMatchType = wordMatchType || 'muscle-prefix';
          allMatches.push(queryWord);
        }
      });

      // Check equipment (lower priority)
      equipmentWords.forEach(equipWord => {
        if (equipWord === queryWord) {
          wordScore = Math.max(wordScore, 200);
          wordMatchType = wordMatchType || 'equipment-exact';
          allMatches.push(queryWord);
        } else if (equipWord.startsWith(queryWord)) {
          wordScore = Math.max(wordScore, 150);
          wordMatchType = wordMatchType || 'equipment-prefix';
          allMatches.push(queryWord);
        }
      });

      // Check keywords (lowest priority)
      keywordWords.forEach(keyword => {
        if (keyword === queryWord) {
          wordScore = Math.max(wordScore, 100);
          wordMatchType = wordMatchType || 'keyword';
          allMatches.push(queryWord);
        }
      });

      wordMatchScore += wordScore;
      if (wordMatchType && !bestMatchType) {
        bestMatchType = wordMatchType;
      }
    });

    totalScore = wordMatchScore;
    matchType = bestMatchType;
  }

  // Synonym matching (if enabled and no good match found)
  if (enableSynonyms && totalScore < 300) {
    queryWords.forEach(queryWord => {
      const synonyms = getSynonyms(queryWord);
      synonyms.forEach(synonym => {
        if (exercise.name.toLowerCase().includes(synonym.toLowerCase())) {
          totalScore = Math.max(totalScore, 250);
          matchType = matchType || 'synonym';
          allMatches.push(queryWord);
        }
      });
    });
  }

  // Bonus for multiple word matches
  const uniqueMatches = [...new Set(allMatches)];
  if (uniqueMatches.length > 1) {
    totalScore += uniqueMatches.length * 50;
  }

  // Penalty for very long exercise names (prefer shorter, more specific matches)
  if (exercise.name.length > 30) {
    totalScore *= 0.9;
  }

  // Return null if score is too low
  if (totalScore < 50) return null;

  return {
    exercise,
    score: Math.round(totalScore),
    matchType,
    matchedWords: [...new Set(matchedWords)],
    highlightRanges: findHighlightRanges(exercise.name, allMatches),
  };
}

/**
 * Smart search function that returns ranked results
 */
export function smartExerciseSearch(
  exercises: Exercise[],
  query: string,
  options: SearchOptions = {}
): SearchMatch[] {
  const {
    maxResults = 15,
    minScore = 50,
  } = options;

  if (!query.trim()) return [];

  // Calculate scores for all exercises
  const matches: SearchMatch[] = [];

  exercises.forEach(exercise => {
    const match = calculateMatchScore(exercise, query, options);
    if (match && match.score >= minScore) {
      matches.push(match);
    }
  });

  // Sort by score (highest first), then by name length (shorter first)
  return matches
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.exercise.name.length - b.exercise.name.length;
    })
    .slice(0, maxResults);
}

/**
 * Highlight text with the matched terms
 */
export function highlightText(text: string, highlightRanges: Array<{ start: number; end: number }>): string {
  if (highlightRanges.length === 0) return text;

  let result = '';
  let lastIndex = 0;

  highlightRanges.forEach(range => {
    // Add text before highlight
    result += text.substring(lastIndex, range.start);

    // Add highlighted text
    result += `<mark class="bg-blue-200 text-blue-900 px-1 rounded">${text.substring(range.start, range.end)}</mark>`;

    lastIndex = range.end;
  });

  // Add remaining text
  result += text.substring(lastIndex);

  return result;
}