import React, { useState, useEffect, useRef } from 'react';
import { WorkoutParser, ParseResult } from '../../parser/workoutParser';
import { ParsedExercise } from '../../parser/types';
import { useAppSelector } from '../../store/hooks';
import { Card } from '../ui/card';
import { IconButton } from '../ui/icon-button';

interface RealtimePreviewProps {
  workoutText: string;
  className?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const RealtimePreview: React.FC<RealtimePreviewProps> = ({
  workoutText,
  className = '',
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const parserRef = useRef(new WorkoutParser());
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { exercises: exerciseDatabase } = useAppSelector((state) => state.exercise);

  // Parse workout text with debouncing
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (!workoutText.trim()) {
      setParseResult(null);
      setIsValidating(false);
      return;
    }

    setIsValidating(true);

    debounceTimeoutRef.current = setTimeout(() => {
      try {
        const result = parserRef.current.parse(workoutText);

        if (result.success && result.workout && exerciseDatabase.length > 0) {
          // Add exercise validation
          const allExercises = [
            ...result.workout.exercises,
            ...result.workout.supersets.flat()
          ];
          const suggestions = parserRef.current.validateExerciseNames(allExercises, exerciseDatabase);
          result.warnings = [...result.warnings, ...suggestions];
        }

        setParseResult(result);
      } catch (error) {
        console.warn('Real-time parse error:', error);
        setParseResult({
          success: false,
          errors: [{ line: 1, column: 1, message: 'Parse error occurred' }],
          warnings: []
        });
      } finally {
        setIsValidating(false);
      }
    }, 500); // 500ms debounce

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [workoutText, exerciseDatabase]);

  const renderExercise = (exercise: ParsedExercise, index: number, isSuperset = false) => {
    return (
      <div
        key={`${exercise.name}-${index}`}
        className={`p-3 rounded-lg border ${
          isSuperset
            ? 'bg-muscle-legs/10 border-muscle-legs/40'
            : 'bg-surface-subtle border-border'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium text-ink flex items-center gap-2">
            {isSuperset && (
              <span className="text-caption bg-muscle-legs/20 text-muscle-legs px-2 py-1 rounded">
                SS
              </span>
            )}
            {exercise.name}
          </h4>
          <div className="text-caption text-ink-subtle">
            {exercise.sets?.length || 0} sets
          </div>
        </div>

        {exercise.sets && exercise.sets.length > 0 && (
          <div className="space-y-1">
            {exercise.sets.map((set, setIndex) => (
              <div
                key={setIndex}
                className="flex items-center justify-between text-body-sm text-ink-muted bg-surface px-2 py-1 rounded"
              >
                <span>Set {setIndex + 1}</span>
                <div className="flex items-center gap-2">
                  <span>
                    {typeof set.reps === 'number'
                      ? `${set.reps} reps`
                      : `${set.reps.min}-${set.reps.max} reps`
                    }
                  </span>
                  {set.weight && (
                    <>
                      <span className="text-ink-subtle">•</span>
                      <span className="text-accent">
                        {set.weight}{set.unit || 'lbs'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSuperset = (superset: ParsedExercise[], supersetIndex: number) => {
    return (
      <div key={`superset-${supersetIndex}`} className="space-y-2">
        <div className="flex items-center gap-2 text-body-sm font-medium text-muscle-legs">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Superset {supersetIndex + 1}
        </div>
        {superset.map((exercise, exerciseIndex) =>
          renderExercise(exercise, exerciseIndex, true)
        )}
      </div>
    );
  };

  if (!workoutText.trim()) {
    return (
      <Card elevation={1} className={`p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-ink-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <h3 className="text-title font-medium text-ink">Live Preview</h3>
        </div>

        <div className="text-center py-8 text-ink-subtle">
          <svg className="w-12 h-12 mx-auto mb-4 text-ink-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <p className="text-body font-medium mb-2">Start typing to see preview</p>
          <p className="text-body-sm">Your workout will appear here as you write</p>
        </div>
      </Card>
    );
  }

  return (
    <Card elevation={1} className={className}>
      <div className="flex items-center justify-between p-6 border-b border-border">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <h3 className="text-title font-medium text-ink">Live Preview</h3>

          {isValidating && (
            <div className="flex items-center gap-2 text-accent text-body-sm">
              <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin"></div>
              <span>Parsing...</span>
            </div>
          )}

          {parseResult && (
            <div className="flex items-center gap-2 text-body-sm">
              {parseResult.success ? (
                <span className="flex items-center gap-1 text-success">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Valid
                </span>
              ) : (
                <span className="flex items-center gap-1 text-danger">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {parseResult.errors.length} error{parseResult.errors.length !== 1 ? 's' : ''}
                </span>
              )}

              {parseResult.warnings.length > 0 && (
                <span className="flex items-center gap-1 text-warning">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {parseResult.warnings.length} warning{parseResult.warnings.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {onToggleCollapse && (
          <IconButton
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand preview' : 'Collapse preview'}
            title={isCollapsed ? 'Expand preview' : 'Collapse preview'}
            className="text-ink-subtle hover:text-ink"
          >
            <svg
              className={`w-4 h-4 transition-transform duration-snap ${isCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </IconButton>
        )}
      </div>

      {!isCollapsed && (
        <div className="p-6">
          {!parseResult ? (
            <div className="flex items-center justify-center py-8 text-ink-subtle">
              <div className="w-6 h-6 border-2 border-border border-t-accent rounded-full animate-spin mr-3"></div>
              <span>Processing workout...</span>
            </div>
          ) : parseResult.success && parseResult.workout ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-surface-subtle rounded-lg">
                <div className="text-center">
                  <div className="text-display-lg font-bold text-accent">
                    {parseResult.workout.exercises.length}
                  </div>
                  <div className="text-caption text-ink-subtle">Exercises</div>
                </div>
                <div className="text-center">
                  <div className="text-display-lg font-bold text-muscle-legs">
                    {parseResult.workout.supersets.length}
                  </div>
                  <div className="text-caption text-ink-subtle">Supersets</div>
                </div>
                <div className="text-center">
                  <div className="text-display-lg font-bold text-success">
                    {parseResult.workout.exercises.reduce((total, ex) => total + (ex.sets?.length || 0), 0) +
                     parseResult.workout.supersets.reduce((total, ss) => total + ss.reduce((ssTotal, ex) => ssTotal + (ex.sets?.length || 0), 0), 0)}
                  </div>
                  <div className="text-caption text-ink-subtle">Total Sets</div>
                </div>
              </div>

              {/* Regular Exercises */}
              {parseResult.workout.exercises.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-ink-muted flex items-center gap-2">
                    <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Exercises
                  </h4>
                  {parseResult.workout.exercises.map((exercise, index) =>
                    renderExercise(exercise, index)
                  )}
                </div>
              )}

              {/* Supersets */}
              {parseResult.workout.supersets.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-ink-muted flex items-center gap-2">
                    <svg className="w-4 h-4 text-muscle-legs" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Supersets
                  </h4>
                  {parseResult.workout.supersets.map((superset, index) =>
                    renderSuperset(superset, index)
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className="font-medium text-danger flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Parse Errors
              </h4>
              {parseResult.errors.map((error, index) => (
                <div key={index} className="p-3 bg-danger/10 border border-danger/40 rounded-lg">
                  <div className="text-danger font-medium">
                    Line {error.line}: {error.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
