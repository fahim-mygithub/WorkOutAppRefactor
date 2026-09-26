import React, { useState, useEffect, useRef } from 'react';
import { WorkoutParser, ParseResult } from '../../parser/workoutParser';
import { ParsedExercise } from '../../parser/types';
import { useAppSelector } from '../../store/hooks';
import { Card } from '../ui/card';
import { IconButton } from '../ui/icon-button';
import { Check, ChevronDown, Loader2 } from 'lucide-react';

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

  const formatSet = (set: NonNullable<ParsedExercise['sets']>[number]) => {
    const reps = typeof set.reps === 'number' ? `${set.reps}` : `${set.reps.min}-${set.reps.max}`;
    return set.weight ? `${reps} × ${set.weight}${set.unit || 'lbs'}` : `${reps} reps`;
  };

  // One row per exercise: name + set count, then the sets as a quiet tabular line.
  const renderExercise = (exercise: ParsedExercise, index: number, supersetLabel?: string) => {
    const sets = exercise.sets ?? [];
    return (
      <li key={`${exercise.name}-${index}`} className="py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-body font-semibold text-ink">{exercise.name}</span>
          <span className="shrink-0 text-body-sm text-ink-muted">
            <span className="font-tabular">{sets.length}</span> set{sets.length !== 1 ? 's' : ''}
          </span>
        </div>
        {(supersetLabel || sets.length > 0) && (
          <p className="mt-0.5 truncate font-tabular text-body-sm text-ink-muted">
            {supersetLabel && <span className="mr-2 text-accent-2">{supersetLabel}</span>}
            {sets.map(formatSet).join(' · ')}
          </p>
        )}
      </li>
    );
  };

  if (!workoutText.trim()) {
    return (
      <Card className={`px-4 py-5 ${className}`}>
        <h3 className="text-body font-semibold text-ink">Preview</h3>
        <p className="mt-1 text-body-sm text-ink-muted">
          Start typing and your exercises show up here as you write.
        </p>
      </Card>
    );
  }

  const totalSets = parseResult?.workout
    ? parseResult.workout.exercises.reduce((total, ex) => total + (ex.sets?.length || 0), 0) +
      parseResult.workout.supersets.reduce((total, ss) => total + ss.reduce((ssTotal, ex) => ssTotal + (ex.sets?.length || 0), 0), 0)
    : 0;

  return (
    <Card className={className}>
      <div className="flex items-center justify-between gap-2 py-2 pl-4 pr-2">
        <div className="flex min-w-0 items-center gap-3">
          <h3 className="text-body font-semibold text-ink">Preview</h3>

          <span className="flex min-w-0 items-center gap-3 text-body-sm" aria-live="polite">
            {isValidating ? (
              <span className="flex items-center gap-1.5 text-ink-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Reading
              </span>
            ) : parseResult ? (
              <>
                {parseResult.success ? (
                  <span className="flex items-center gap-1 text-accent-2">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    Looks good
                  </span>
                ) : (
                  <span className="text-danger">
                    <span className="font-tabular">{parseResult.errors.length}</span> error{parseResult.errors.length !== 1 ? 's' : ''}
                  </span>
                )}
                {parseResult.warnings.length > 0 && (
                  <span className="truncate text-warning">
                    <span className="font-tabular">{parseResult.warnings.length}</span> warning{parseResult.warnings.length !== 1 ? 's' : ''}
                  </span>
                )}
              </>
            ) : null}
          </span>
        </div>

        {onToggleCollapse && (
          <IconButton
            variant="ghost"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand preview' : 'Collapse preview'}
            title={isCollapsed ? 'Expand preview' : 'Collapse preview'}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-snap ${isCollapsed ? '' : 'rotate-180'}`}
              aria-hidden="true"
            />
          </IconButton>
        )}
      </div>

      {!isCollapsed && (
        <div className="px-4 pb-4">
          {!parseResult ? (
            <p className="flex items-center gap-2 py-4 text-body-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Reading your workout
            </p>
          ) : parseResult.success && parseResult.workout ? (
            <>
              {/* Summary: numbers first, labels under */}
              <dl className="grid grid-cols-3 gap-3 py-2">
                {[
                  { value: parseResult.workout.exercises.length, label: 'exercises' },
                  { value: parseResult.workout.supersets.length, label: 'supersets' },
                  { value: totalSets, label: 'sets' },
                ].map((stat) => (
                  <div key={stat.label}>
                    <dt className="sr-only">{stat.label}</dt>
                    <dd className="font-display font-tabular text-display text-ink">{stat.value}</dd>
                    <dd aria-hidden="true" className="text-body-sm text-ink-muted">{stat.label}</dd>
                  </div>
                ))}
              </dl>

              <ul className="mt-2 divide-y divide-hairline border-t border-hairline">
                {parseResult.workout.exercises.map((exercise, index) =>
                  renderExercise(exercise, index)
                )}
                {parseResult.workout.supersets.map((superset, supersetIndex) =>
                  superset.map((exercise, exerciseIndex) =>
                    renderExercise(
                      exercise,
                      supersetIndex * 100 + exerciseIndex,
                      `Superset ${supersetIndex + 1}`,
                    )
                  )
                )}
              </ul>
            </>
          ) : (
            <ul className="divide-y divide-hairline">
              {parseResult.errors.map((error, index) => (
                <li key={index} className="flex gap-3 py-3 text-body-sm">
                  <span className="shrink-0 font-tabular text-ink-muted">Line {error.line}</span>
                  <span className="min-w-0 text-danger">{error.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
};
