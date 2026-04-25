import { useState, useEffect, useCallback, useRef } from 'react';
import { Exercise } from '../types/exercise';
import { WorkoutParser, ParseIssue } from '../parser/workoutParser';

interface ParseValidationResult {
  issues: ParseIssue[];
  hasIssues: boolean;
  isValidating: boolean;
  validateText: (text: string) => void;
  applyCorrection: (originalName: string, suggestedExercise: Exercise) => string;
  applyAllHighConfidence: (text: string) => { correctedText: string; corrections: number };
}

export const useParseValidation = (
  exerciseDatabase: Exercise[],
  debounceMs: number = 500
): ParseValidationResult => {
  const [issues, setIssues] = useState<ParseIssue[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const parserRef = useRef(new WorkoutParser());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTextRef = useRef<string>('');

  const validateText = useCallback((text: string) => {
    // Don't validate if text hasn't changed or is empty
    if (!text.trim() || text === lastTextRef.current || exerciseDatabase.length === 0) {
      return;
    }

    lastTextRef.current = text;
    setIsValidating(true);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce validation
    timeoutRef.current = setTimeout(() => {
      try {
        const parser = parserRef.current;
        const result = parser.parse(text);

        if (result.success && result.workout) {
          const allExercises = [
            ...result.workout.exercises,
            ...result.workout.supersets.flat()
          ];

          const parseIssues = parser.getParseIssues(
            allExercises,
            result.workout.supersets,
            exerciseDatabase,
            text
          );

          // Filter out issues with no good suggestions
          const meaningfulIssues = parseIssues.filter(
            issue => issue.suggestions.length > 0 && issue.suggestions[0].confidence > 40
          );

          setIssues(meaningfulIssues);
        } else {
          setIssues([]);
        }
      } catch (error) {
        console.warn('Parse validation error:', error);
        setIssues([]);
      } finally {
        setIsValidating(false);
      }
    }, debounceMs);
  }, [exerciseDatabase, debounceMs]);

  // Apply a single correction to text
  const applyCorrection = useCallback((originalName: string, suggestedExercise: Exercise): string => {
    return (text: string) => {
      // Use word boundaries but handle special characters in exercise names
      const escapedOriginal = originalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedOriginal}\\b`, 'gi');
      
      const correctedText = text.replace(regex, suggestedExercise.name);
      
      console.log(`🔧 Applied correction: "${originalName}" → "${suggestedExercise.name}"`);
      return correctedText;
    };
  }, []);

  // Apply all high-confidence corrections automatically
  const applyAllHighConfidence = useCallback((text: string): { correctedText: string; corrections: number } => {
    const highConfidenceIssues = issues.filter(
      issue => issue.suggestions.length > 0 && issue.suggestions[0].confidence >= 95
    );

    if (highConfidenceIssues.length === 0) {
      return { correctedText: text, corrections: 0 };
    }

    let correctedText = text;
    let correctionsApplied = 0;

    // Apply corrections in order
    for (const issue of highConfidenceIssues) {
      const suggestion = issue.suggestions[0];
      const correction = applyCorrection(issue.exerciseName, suggestion.exercise);
      const newText = correction(correctedText);
      
      if (newText !== correctedText) {
        correctedText = newText;
        correctionsApplied++;
        console.log(`🤖 Auto-corrected: "${issue.exerciseName}" → "${suggestion.exercise.name}"`);
      }
    }

    return { correctedText, corrections: correctionsApplied };
  }, [issues, applyCorrection]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    issues,
    hasIssues: issues.length > 0,
    isValidating,
    validateText,
    applyCorrection,
    applyAllHighConfidence,
  };
};