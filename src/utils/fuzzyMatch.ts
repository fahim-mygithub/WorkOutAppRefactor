import { Exercise } from '../types/exercise';

export interface MatchResult {
  exercise: Exercise;
  confidence: number;
  reason: string;
}

// Common abbreviations and their expansions
const ABBREVIATIONS: Record<string, string[]> = {
  'db': ['dumbbell', 'dumbell'],
  'bb': ['barbell', 'barbel'],
  'kb': ['kettlebell', 'kettle bell'],
  'ez': ['ez-bar', 'ez bar', 'ezbar'],
  'rdl': ['romanian deadlift', 'romanian dl'],
  'dl': ['deadlift'],
  'ohp': ['overhead press', 'military press'],
  'bp': ['bench press'],
  'squat': ['squat'],
  'curl': ['curl'],
  'press': ['press'],
  'pull': ['pull'],
  'push': ['push'],
  'fly': ['fly', 'flye'],
  'raise': ['raise', 'raises'],
  'row': ['row', 'rows'],
  'lat': ['lateral', 'latissimus'],
  'tri': ['tricep', 'triceps'],
  'bi': ['bicep', 'biceps'],
  'chest': ['pectoral', 'pec'],
  'back': ['latissimus', 'lat'],
  'leg': ['quadricep', 'hamstring', 'calf'],
  'shoulder': ['deltoid', 'delt'],
};

// Common misspellings and their corrections
const COMMON_MISSPELLINGS: Record<string, string[]> = {
  'benchpress': ['bench press'],
  'benchpres': ['bench press'],
  'bnech': ['bench'],
  'bnch': ['bench'],
  'bech': ['bench'],
  'dumbell': ['dumbbell'],
  'dumbel': ['dumbbell'],
  'barbel': ['barbell'],
  'squats': ['squat'],
  'squtas': ['squat'],
  'squat': ['squat'],
  'skwat': ['squat'],
  'pres': ['press'],
  'preess': ['press'],
  'prees': ['press'],
  'rais': ['raise'],
  'raiss': ['raise'],
  'raize': ['raise'],
  'curls': ['curl'],
  'crul': ['curl'],
  'kurl': ['curl'],
  'deadlifts': ['deadlift'],
  'dedlift': ['deadlift'],
  'deadlft': ['deadlift'],
  'ded': ['deadlift'],
  'pullup': ['pull up', 'pull-up'],
  'pullups': ['pull up', 'pull-up'],
  'pushup': ['push up', 'push-up'],
  'pushups': ['push up', 'push-up'],
  'chinup': ['chin up', 'chin-up'],
  'chinups': ['chin up', 'chin-up'],
  'situp': ['sit up', 'sit-up'],
  'situps': ['sit up', 'sit-up'],
  'rows': ['row'],
  'roe': ['row'],
  'rowe': ['row'],
  'extensions': ['extension'],
  'extention': ['extension'],
  'extentions': ['extension'],
  'barbell rows': ['barbell row'],
  'tricep extensions': ['tricep extension'],
  'dumbbell curls': ['dumbbell curl'],
  // Phonetic misspellings
  'flys': ['fly', 'flye'],
  'flyes': ['fly', 'flye'],
  'shrugs': ['shrug'],
  'shregs': ['shrug'],
};

// Exercise synonyms for better matching
const EXERCISE_SYNONYMS: Record<string, string[]> = {
  'chest fly': ['pec fly', 'pectoral fly', 'dumbbell fly'],
  'pec fly': ['chest fly', 'pectoral fly', 'dumbbell fly'],
  'lat pulldown': ['lateral pulldown', 'lat pull down'],
  'pulldown': ['lat pulldown', 'lateral pulldown'],
  'skull crusher': ['lying tricep extension', 'french press'],
  'french press': ['skull crusher', 'lying tricep extension'],
  'calf raise': ['calf raises', 'standing calf raise'],
  'leg curl': ['hamstring curl', 'lying leg curl'],
  'leg extension': ['quad extension', 'knee extension'],
  'ab wheel': ['ab roller', 'abdominal wheel'],
  'plank': ['front plank', 'forearm plank'],
};

// Generic term mappings for better exercise matching
const GENERIC_MAPPINGS: Record<string, string[]> = {
  'barbell rows': ['barbell bent over row', 'barbell pronated row', 'barbell supinated row', 'barbell landmine row'],
  'barbell row': ['barbell bent over row', 'barbell pronated row', 'barbell supinated row', 'barbell landmine row'],
  'tricep extensions': ['dumbbell overhead tricep extension', 'cable overhead tricep extension', 'barbell overhead tricep extension', 'dumbbell tricep extension'],
  'tricep extension': ['dumbbell overhead tricep extension', 'cable overhead tricep extension', 'barbell overhead tricep extension', 'dumbbell tricep extension'],
  'dumbbell curls': ['dumbbell curl', 'dumbbell hammer curl', 'dumbbell concentration curl'],
  'dumbbell curl': ['dumbbell curl', 'dumbbell hammer curl', 'dumbbell concentration curl'],
  'chest press': ['bench press', 'dumbbell press', 'incline press'],
  'shoulder press': ['overhead press', 'military press', 'dumbbell shoulder press'],
};

// Words that can be safely removed for matching
const FILLER_WORDS = new Set([
  'with', 'using', 'on', 'the', 'a', 'an', 'and', 'or', 'machine', 'exercise',
  'workout', 'movement', 'hold', 'position', 'stance'
]);

export class FuzzyMatcher {
  private exercises: Exercise[];

  constructor(exercises: Exercise[]) {
    this.exercises = exercises;
  }

  findBestMatches(query: string, maxResults: number = 3): MatchResult[] {
    const normalizedQuery = this.normalizeString(query);
    const matches: MatchResult[] = [];

    for (const exercise of this.exercises) {
      const normalizedExerciseName = this.normalizeString(exercise.name);
      
      // Try multiple matching strategies
      const strategies = [
        () => this.exactMatch(normalizedQuery, normalizedExerciseName, exercise),
        () => this.synonymMatch(normalizedQuery, exercise),
        () => this.genericTermMatch(normalizedQuery, exercise),
        () => this.substringMatch(normalizedQuery, normalizedExerciseName, exercise),
        () => this.abbreviationMatch(normalizedQuery, normalizedExerciseName, exercise),
        () => this.soundexMatch(normalizedQuery, normalizedExerciseName, exercise),
        () => this.tokenMatch(normalizedQuery, normalizedExerciseName, exercise),
        () => this.fuzzyStringMatch(normalizedQuery, normalizedExerciseName, exercise),
        () => this.keywordMatch(normalizedQuery, exercise),
        () => this.phoneticsMatch(normalizedQuery, normalizedExerciseName, exercise),
      ];

      for (const strategy of strategies) {
        const result = strategy();
        if (result && result.confidence > 30) {
          matches.push(result);
          break; // Take the first matching strategy with decent confidence
        }
      }
    }

    // Sort by confidence (highest first) and return top results
    return matches
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxResults);
  }

  private normalizeString(str: string): string {
    let normalized = str
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ') // Remove special characters except hyphens
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Apply common misspelling corrections
    normalized = this.correctCommonMisspellings(normalized);
    
    // Handle plurals by normalizing to singular forms for better matching
    normalized = normalized.replace(/\b(\w{3,})s\b/g, (match, base) => {
      // Don't singularize words that would become too short or common words that shouldn't be singularized
      const exceptions = ['press', 'ups', 'its', 'abs', 'lats', 'traps', 'this', 'as', 'is'];
      if (exceptions.includes(match) || base.length < 3) {
        return match;
      }
      return base;
    });
    
    return normalized;
  }

  private exactMatch(query: string, exerciseName: string, exercise: Exercise): MatchResult | null {
    if (query === exerciseName) {
      return {
        exercise,
        confidence: 100,
        reason: 'Exact match'
      };
    }
    return null;
  }

  private synonymMatch(query: string, exercise: Exercise): MatchResult | null {
    const normalizedExerciseName = this.normalizeString(exercise.name);

    // Check if query or exercise name has synonyms
    const querySynonyms = EXERCISE_SYNONYMS[query] || [];
    const exerciseSynonyms = Object.entries(EXERCISE_SYNONYMS).find(([key, synonyms]) =>
      synonyms.includes(normalizedExerciseName) || key === normalizedExerciseName
    );

    // Check if query matches any synonyms of the exercise
    if (exerciseSynonyms) {
      const [key, synonyms] = exerciseSynonyms;
      if (query === key || synonyms.includes(query)) {
        return {
          exercise,
          confidence: 95,
          reason: `Synonym match: "${query}" is another name for this exercise`
        };
      }
    }

    // Check if exercise name matches any synonyms of the query
    if (querySynonyms.length > 0) {
      const normalizedSynonyms = querySynonyms.map(s => this.normalizeString(s));
      if (normalizedSynonyms.some(synonym =>
        normalizedExerciseName.includes(synonym) || synonym.includes(normalizedExerciseName)
      )) {
        return {
          exercise,
          confidence: 90,
          reason: `Synonym match: exercise matches "${query}" synonym`
        };
      }
    }

    return null;
  }

  private soundexMatch(query: string, exerciseName: string, exercise: Exercise): MatchResult | null {
    const querySoundex = this.soundex(query);
    const exerciseSoundex = this.soundex(exerciseName);

    if (querySoundex === exerciseSoundex && querySoundex !== '0000') {
      return {
        exercise,
        confidence: 75,
        reason: 'Sounds very similar (phonetic match)'
      };
    }

    // Also check individual words
    const queryWords = query.split(' ');
    const exerciseWords = exerciseName.split(' ');

    const matchingWords = queryWords.filter(qWord =>
      exerciseWords.some(eWord => this.soundex(qWord) === this.soundex(eWord))
    );

    if (matchingWords.length > 0 && matchingWords.length >= Math.min(queryWords.length, exerciseWords.length) * 0.5) {
      return {
        exercise,
        confidence: 65,
        reason: `Phonetic word match: ${matchingWords.length}/${Math.max(queryWords.length, exerciseWords.length)} words sound similar`
      };
    }

    return null;
  }

  private genericTermMatch(query: string, exercise: Exercise): MatchResult | null {
    // Check if query matches any generic terms
    for (const [genericTerm, variations] of Object.entries(GENERIC_MAPPINGS)) {
      if (query === genericTerm || query.includes(genericTerm)) {
        // Check if this exercise matches any of the variations
        for (const variation of variations) {
          const normalizedVariation = this.normalizeString(variation);
          const normalizedExerciseName = this.normalizeString(exercise.name);
          
          if (normalizedExerciseName.includes(normalizedVariation) || 
              normalizedVariation.includes(normalizedExerciseName) ||
              normalizedExerciseName === normalizedVariation) {
            return {
              exercise,
              confidence: 80,
              reason: `Generic term match: "${query}" maps to specific exercise`
            };
          }
        }
      }
    }
    return null;
  }

  private substringMatch(query: string, exerciseName: string, exercise: Exercise): MatchResult | null {
    if (exerciseName.includes(query) || query.includes(exerciseName)) {
      const longerLength = Math.max(query.length, exerciseName.length);
      const shorterLength = Math.min(query.length, exerciseName.length);
      const confidence = Math.round((shorterLength / longerLength) * 90);
      
      return {
        exercise,
        confidence,
        reason: exerciseName.includes(query) ? 'Exercise name contains your input' : 'Your input contains exercise name'
      };
    }
    return null;
  }

  private abbreviationMatch(query: string, exerciseName: string, exercise: Exercise): MatchResult | null {
    // Expand abbreviations in query
    const expandedQuery = this.expandAbbreviations(query);
    if (expandedQuery !== query) {
      const normalizedExpandedQuery = this.normalizeString(expandedQuery);
      if (exerciseName.includes(normalizedExpandedQuery) || normalizedExpandedQuery.includes(exerciseName)) {
        return {
          exercise,
          confidence: 85,
          reason: `Abbreviation expanded: "${query}" → "${expandedQuery}"`
        };
      }
    }

    // Check for common misspellings
    const correctedQuery = this.correctCommonMisspellings(query);
    if (correctedQuery !== query) {
      if (exerciseName.includes(correctedQuery) || correctedQuery.includes(exerciseName)) {
        return {
          exercise,
          confidence: 80,
          reason: `Common misspelling corrected: "${query}" → "${correctedQuery}"`
        };
      }
    }

    return null;
  }

  private tokenMatch(query: string, exerciseName: string, exercise: Exercise): MatchResult | null {
    const queryTokens = this.tokenize(query);
    const exerciseTokens = this.tokenize(exerciseName);
    
    if (queryTokens.length === 0 || exerciseTokens.length === 0) return null;

    const matchingTokens = queryTokens.filter(token => 
      exerciseTokens.some(exerciseToken => 
        exerciseToken.includes(token) || token.includes(exerciseToken) || 
        this.levenshteinDistance(token, exerciseToken) <= Math.max(1, Math.floor(Math.min(token.length, exerciseToken.length) * 0.3))
      )
    );

    const matchRatio = matchingTokens.length / Math.max(queryTokens.length, exerciseTokens.length);
    
    if (matchRatio > 0.5) {
      const confidence = Math.round(matchRatio * 75);
      return {
        exercise,
        confidence,
        reason: `Token match: ${matchingTokens.length}/${Math.max(queryTokens.length, exerciseTokens.length)} words match`
      };
    }

    return null;
  }

  private fuzzyStringMatch(query: string, exerciseName: string, exercise: Exercise): MatchResult | null {
    const distance = this.levenshteinDistance(query, exerciseName);
    const maxLength = Math.max(query.length, exerciseName.length);
    const similarity = (maxLength - distance) / maxLength;
    
    if (similarity > 0.6) {
      const confidence = Math.round(similarity * 70);
      return {
        exercise,
        confidence,
        reason: `Similar spelling (${Math.round(similarity * 100)}% similarity)`
      };
    }

    // Also try fuzzy matching on individual words
    const queryWords = query.split(' ');
    const exerciseWords = exerciseName.split(' ');

    if (queryWords.length > 1 || exerciseWords.length > 1) {
      let totalSimilarity = 0;
      let matchCount = 0;

      for (const qWord of queryWords) {
        let bestWordSimilarity = 0;
        for (const eWord of exerciseWords) {
          const wordDistance = this.levenshteinDistance(qWord, eWord);
          const wordMaxLength = Math.max(qWord.length, eWord.length);
          const wordSimilarity = (wordMaxLength - wordDistance) / wordMaxLength;
          bestWordSimilarity = Math.max(bestWordSimilarity, wordSimilarity);
        }
        if (bestWordSimilarity > 0.5) {
          totalSimilarity += bestWordSimilarity;
          matchCount++;
        }
      }

      if (matchCount > 0) {
        const avgSimilarity = totalSimilarity / queryWords.length;
        if (avgSimilarity > 0.5) {
          const confidence = Math.round(avgSimilarity * 60);
          return {
            exercise,
            confidence,
            reason: `Word-level similarity (${Math.round(avgSimilarity * 100)}% avg similarity)`
          };
        }
      }
    }

    return null;
  }

  private keywordMatch(query: string, exercise: Exercise): MatchResult | null {
    const queryTokens = this.tokenize(query);
    const keywordMatches = queryTokens.filter(token =>
      exercise.searchKeywords.some(keyword => 
        keyword.includes(token) || token.includes(keyword)
      )
    );

    if (keywordMatches.length > 0) {
      const confidence = Math.round((keywordMatches.length / queryTokens.length) * 60);
      return {
        exercise,
        confidence,
        reason: `Keyword match: matches ${keywordMatches.join(', ')}`
      };
    }

    return null;
  }

  private phoneticsMatch(query: string, exerciseName: string, exercise: Exercise): MatchResult | null {
    // Simple phonetic matching - check if first letters and general pattern match
    const queryPattern = this.getPhoneticPattern(query);
    const exercisePattern = this.getPhoneticPattern(exerciseName);
    
    if (queryPattern === exercisePattern && queryPattern.length > 2) {
      return {
        exercise,
        confidence: 55,
        reason: 'Sounds similar (phonetic match)'
      };
    }

    return null;
  }

  private expandAbbreviations(text: string): string {
    let expanded = text;
    const tokens = text.split(/\s+/);
    
    for (const token of tokens) {
      const lowerToken = token.toLowerCase();
      if (ABBREVIATIONS[lowerToken]) {
        // Use the first (most common) expansion
        expanded = expanded.replace(new RegExp(`\\b${token}\\b`, 'gi'), ABBREVIATIONS[lowerToken][0]);
      }
    }
    
    return expanded;
  }

  private correctCommonMisspellings(text: string): string {
    let corrected = text;
    
    for (const [misspelling, corrections] of Object.entries(COMMON_MISSPELLINGS)) {
      if (text.toLowerCase().includes(misspelling)) {
        corrected = corrected.replace(new RegExp(misspelling, 'gi'), corrections[0]);
      }
    }
    
    return corrected;
  }

  private tokenize(text: string): string[] {
    return text
      .split(/\s+/)
      .filter(token => token.length > 2 && !FILLER_WORDS.has(token.toLowerCase()));
  }

  private getPhoneticPattern(text: string): string {
    // Simple phonetic pattern: first letter + consonants
    return text
      .toLowerCase()
      .replace(/[aeiou]/g, '') // Remove vowels except first character
      .substring(0, 4); // Take first 4 characters
  }

  // Soundex algorithm for phonetic matching
  private soundex(text: string): string {
    if (!text) return '0000';

    const word = text.toUpperCase().replace(/[^A-Z]/g, '');
    if (word.length === 0) return '0000';

    let soundex = word[0];

    // Mapping of letters to numbers
    const mapping: Record<string, string> = {
      'B': '1', 'F': '1', 'P': '1', 'V': '1',
      'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
      'D': '3', 'T': '3',
      'L': '4',
      'M': '5', 'N': '5',
      'R': '6'
    };

    let prev = mapping[word[0]] || '0';

    for (let i = 1; i < word.length && soundex.length < 4; i++) {
      const current = mapping[word[i]] || '0';

      if (current !== '0' && current !== prev) {
        soundex += current;
      }

      prev = current;
    }

    // Pad with zeros
    return soundex.padEnd(4, '0');
  }

  private levenshteinDistance(str1: string, str2: string): number {
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
}