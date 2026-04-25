import { ParsedExercise, ParsedSet, ParsedWorkout, ParseResult, ParseError } from './types';
import { Exercise } from '../types/exercise';
import { FuzzyMatcher, MatchResult } from '../utils/fuzzyMatch';

export interface ExerciseSuggestion {
  exercise: Exercise;
  confidence: number;
  reason: string;
}

export interface ParseIssue {
  exerciseName: string;
  suggestions: ExerciseSuggestion[];
  lineNumber: number;
  context: string;
}

export interface EnhancedParseResult extends ParseResult {
  parseIssues?: ParseIssue[];
}

export class WorkoutParser {
  private errors: ParseError[] = [];
  private warnings: string[] = [];
  private lastWorkoutText: string = '';

  parse(input: string): ParseResult {
    // Ensure clean state for each parse
    this.errors = [];
    this.warnings = [];
    
    console.log('🔄 Parser starting with clean state for input:', input.substring(0, 50) + '...');

    try {
      if (!input || !input.trim()) {
        this.addError(1, 1, 'Empty workout text');
        return { success: false, errors: this.errors, warnings: this.warnings };
      }

      const lines = input.split('\n').filter(line => line.trim());
      const exercises: ParsedExercise[] = [];
      const supersets: ParsedExercise[][] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Check for superset notation (ss, superset)
        if (line.toLowerCase().includes(' ss ') || line.toLowerCase().includes(' superset ')) {
          const supersetExercises = this.parseSuperset(line, i + 1);
          if (supersetExercises.length > 1) {
            supersets.push(supersetExercises);
          } else if (supersetExercises.length === 1) {
            exercises.push(supersetExercises[0]);
          }
        } else {
          const exercise = this.parseExerciseLine(line, i + 1);
          if (exercise) {
            exercises.push(exercise);
          }
        }
      }

      if (exercises.length === 0 && supersets.length === 0) {
        this.addError(1, 1, 'No valid exercises found');
        console.warn('⚠️ Parser found no valid exercises');
        return { success: false, errors: this.errors, warnings: this.warnings };
      }

      const result = {
        success: true,
        workout: { exercises, supersets },
        errors: this.errors,
        warnings: this.warnings
      };
      
      console.log('✅ Parser succeeded:', {
        exercises: exercises.length,
        supersets: supersets.length,
        warnings: this.warnings.length
      });
      
      return result;
    } catch (error) {
      this.addError(1, 1, `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('❌ Parser failed with error:', error);
      console.log('Parser errors:', this.errors);
      return { success: false, errors: this.errors, warnings: this.warnings };
    }
  }

  private parseSuperset(line: string, lineNumber: number): ParsedExercise[] {
    const exercises: ParsedExercise[] = [];
    const parts = line.split(/\s+(ss|superset)\s+/i);

    for (const part of parts) {
      const trimmedPart = part.trim();
      if (trimmedPart && !['ss', 'superset'].includes(trimmedPart.toLowerCase())) {
        const exercise = this.parseExerciseLine(trimmedPart, lineNumber);
        if (exercise) {
          exercises.push(exercise);
        }
      }
    }

    return exercises;
  }

  private parseExerciseLine(line: string, lineNumber: number): ParsedExercise | null {
    // Clean the line
    const cleanLine = line.replace(/[^\w\s\-x×\*@,.()]/gi, ' ').replace(/\s+/g, ' ').trim();

    if (!cleanLine) return null;

    // Try different patterns
    const patterns = [
      // 5x10 Exercise Name @185lbs
      /^(\d+)\s*[x×\*]\s*(\d+(?:-\d+)?)\s+(.+?)(?:\s*@\s*(\d+(?:\.\d+)?)\s*(lbs?|kg)?)?$/i,
      // 5x Exercise Name @185lbs (sets only)
      /^(\d+)\s*[x×\*]\s+(.+?)(?:\s*@\s*(\d+(?:\.\d+)?)\s*(lbs?|kg)?)?$/i,
      // Exercise Name 5x10 @185lbs
      /^(.+?)\s+(\d+)\s*[x×\*]\s*(\d+(?:-\d+)?)(?:\s*@\s*(\d+(?:\.\d+)?)\s*(lbs?|kg)?)?$/i,
      // Exercise Name 5x @185lbs
      /^(.+?)\s+(\d+)\s*[x×\*](?:\s*@\s*(\d+(?:\.\d+)?)\s*(lbs?|kg)?)?$/i,
    ];

    for (const pattern of patterns) {
      const match = cleanLine.match(pattern);
      if (match) {
        return this.createExerciseFromMatch(match, pattern, lineNumber);
      }
    }

    // Fallback: treat as exercise name only
    this.addWarning(`Line ${lineNumber}: Treating "${line}" as exercise name with default sets`);
    return {
      name: line.trim(),
      sets: [{ reps: 10 }]
    };
  }

  private createExerciseFromMatch(match: RegExpMatchArray, pattern: RegExp, lineNumber: number): ParsedExercise {
    const patternString = pattern.toString();

    // Pattern: 5x10 Exercise Name @185lbs
    if (patternString.includes('(.+?)') && match.length >= 4) {
      let setCount: number, repsStr: string, exerciseName: string, weight: number | undefined, unit: string | undefined;

      if (match[3] && !match[3].match(/^\d+/)) {
        // Pattern: 5x10 Exercise Name
        setCount = parseInt(match[1]) || 1;
        repsStr = match[2];
        exerciseName = match[3];
        weight = match[4] ? parseFloat(match[4]) : undefined;
        unit = match[5];
      } else if (match[1] && !match[1].match(/^\d+/)) {
        // Pattern: Exercise Name 5x10
        exerciseName = match[1];
        setCount = parseInt(match[2]) || 1;
        repsStr = match[3] || '10';
        weight = match[4] ? parseFloat(match[4]) : undefined;
        unit = match[5];
      } else {
        // Default case
        setCount = parseInt(match[1]) || 1;
        repsStr = match[2] || '10';
        exerciseName = match[3] || match[1];
        weight = match[4] ? parseFloat(match[4]) : undefined;
        unit = match[5];
      }

      // Validate set count
      if (setCount > 20) {
        this.addWarning(`Line ${lineNumber}: Set count ${setCount} seems high, capping at 20`);
        setCount = 20;
      }

      const sets: ParsedSet[] = [];
      for (let i = 0; i < setCount; i++) {
        const set: ParsedSet = this.parseReps(repsStr);
        if (weight && weight > 0) {
          set.weight = weight;
          set.unit = (unit as 'lbs' | 'kg') || 'lbs';
        }
        sets.push(set);
      }

      return {
        name: exerciseName.trim(),
        sets
      };
    }

    // Fallback
    return {
      name: match[0],
      sets: [{ reps: 10 }]
    };
  }

  private parseReps(repsStr: string): ParsedSet {
    if (!repsStr) return { reps: 10 };

    // Handle rep ranges (e.g., "8-12")
    if (repsStr.includes('-')) {
      const [minStr, maxStr] = repsStr.split('-');
      const min = parseInt(minStr) || 8;
      const max = parseInt(maxStr) || min + 2;
      
      if (min > max) {
        return { reps: min };
      }
      
      return { reps: { min, max } };
    }

    // Single rep count
    const reps = parseInt(repsStr);
    if (isNaN(reps) || reps <= 0 || reps > 100) {
      return { reps: 10 };
    }

    return { reps };
  }

  private addError(line: number, column: number, message: string, suggestion?: string) {
    this.errors.push({ line, column, message, suggestion });
  }

  private addWarning(message: string) {
    this.warnings.push(message);
  }

  // Enhanced utility method to validate exercise names and provide suggestions
  validateExerciseNames(exercises: ParsedExercise[], exerciseDatabase: Exercise[]): string[] {
    const suggestions: string[] = [];
    
    for (const exercise of exercises) {
      const exerciseName = exercise.name.toLowerCase();
      const found = exerciseDatabase.find(dbExercise => 
        dbExercise.name.toLowerCase() === exerciseName ||
        dbExercise.name.toLowerCase().includes(exerciseName) ||
        exerciseName.includes(dbExercise.name.toLowerCase())
      );

      if (!found) {
        const similar = exerciseDatabase.find(dbExercise => 
          this.calculateSimilarity(exerciseName, dbExercise.name.toLowerCase()) > 0.6
        );

        if (similar) {
          suggestions.push(`"${exercise.name}" not found. Did you mean "${similar.name}"?`);
        } else {
          suggestions.push(`"${exercise.name}" not found in exercise database`);
        }
      }
    }

    return suggestions;
  }

  // Enhanced method to get detailed parse issues with fuzzy matching suggestions
  getParseIssues(exercises: ParsedExercise[], supersets: ParsedExercise[][], exerciseDatabase: Exercise[], workoutText: string): ParseIssue[] {
    console.log('🔍 Analyzing parse issues for', exercises.length, 'exercises and', supersets.length, 'supersets');
    
    const fuzzyMatcher = new FuzzyMatcher(exerciseDatabase);
    const parseIssues: ParseIssue[] = [];
    const allExercises = [...exercises, ...supersets.flat()];
    const lines = workoutText.split('\n');

    for (const exercise of allExercises) {
      const exerciseName = exercise.name.trim();
      
      // Check if exercise exists in database (case-insensitive)
      const found = exerciseDatabase.find(dbExercise => 
        dbExercise.name.toLowerCase() === exerciseName.toLowerCase() ||
        this.isCloseMatch(exerciseName.toLowerCase(), dbExercise.name.toLowerCase())
      );

      if (!found) {
        console.log(`❌ Exercise not found in database: "${exerciseName}"`);
        
        // Find the line number for this exercise
        const lineNumber = this.findExerciseLineNumber(exerciseName, lines);
        const context = lines[lineNumber - 1] || '';
        
        // Get fuzzy matches
        const matches = fuzzyMatcher.findBestMatches(exerciseName, 3);
        const suggestions: ExerciseSuggestion[] = matches.map(match => ({
          exercise: match.exercise,
          confidence: match.confidence,
          reason: match.reason
        }));

        console.log(`🔧 Found ${suggestions.length} suggestions for "${exerciseName}":
${suggestions.map(s => `  - ${s.exercise.name} (${s.confidence}%): ${s.reason}`).join('\n')}`);

        parseIssues.push({
          exerciseName,
          suggestions,
          lineNumber,
          context: context.trim()
        });
      } else {
        console.log(`✅ Exercise found in database: "${exerciseName}" -> "${found.name}"`);
      }
    }

    console.log(`📋 Total parse issues found: ${parseIssues.length}`);
    return parseIssues;
  }

  // Helper method to find better matches
  private isCloseMatch(query: string, target: string): boolean {
    // Handle partial matches, plurals, and common variations
    const queryNormalized = query.replace(/s$/, ''); // Remove trailing 's'
    const targetNormalized = target.replace(/s$/, '');
    
    return (
      target.includes(query) ||
      query.includes(target) ||
      targetNormalized === queryNormalized ||
      this.calculateSimilarity(query, target) > 0.8
    );
  }

  // Helper method to find the line number of an exercise
  private findExerciseLineNumber(exerciseName: string, lines: string[]): number {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes(exerciseName.toLowerCase())) {
        return i + 1;
      }
    }
    return 1; // Default to first line if not found
  }

  // Enhanced similarity calculation with better scoring
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    const similarity = (longer.length - distance) / longer.length;
    
    // Boost similarity for partial matches
    if (longer.includes(shorter) || shorter.includes(longer)) {
      return Math.max(similarity, 0.7);
    }
    
    return similarity;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    if (str1 === str2) return 0;
    if (str1.length === 0) return str2.length;
    if (str2.length === 0) return str1.length;
    
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