import React from 'react';
import { Exercise } from '../../types/exercise';
import { Button } from '../ui/button';
import { IconButton } from '../ui/icon-button';
import { Card } from '../ui/card';
import { X } from 'lucide-react';

interface ParseIssue {
  exerciseName: string;
  suggestions: ExerciseSuggestion[];
  lineNumber: number;
  context: string;
}

interface ExerciseSuggestion {
  exercise: Exercise;
  confidence: number;
  reason: string;
}

interface ParseIssuesResolverProps {
  issues: ParseIssue[];
  workoutText: string;
  onApplyCorrection: (originalName: string, suggestedExercise: Exercise, lineNumber: number) => void;
  onApplyAllCorrections: (corrections: { originalName: string; suggestedExercise: Exercise; lineNumber: number }[]) => void;
  onDismiss: () => void;
  onIgnoreExercise: (exerciseName: string) => void;
}

export const ParseIssuesResolver: React.FC<ParseIssuesResolverProps> = ({
  issues,
  workoutText,
  onApplyCorrection,
  onApplyAllCorrections,
  onDismiss,
  onIgnoreExercise,
}) => {
  const [dismissedExercises, setDismissedExercises] = React.useState<Set<string>>(new Set());
  const [selectedCorrections, setSelectedCorrections] = React.useState<Record<string, ExerciseSuggestion>>({});

  const visibleIssues = issues.filter(issue => !dismissedExercises.has(issue.exerciseName));

  const handleSelectSuggestion = (exerciseName: string, suggestion: ExerciseSuggestion) => {
    setSelectedCorrections(prev => ({
      ...prev,
      [exerciseName]: suggestion
    }));
  };

  const handleApplyAllHighConfidence = () => {
    const corrections = visibleIssues
      .filter(issue => issue.suggestions.length > 0 && issue.suggestions[0].confidence >= 85)
      .map(issue => ({
        originalName: issue.exerciseName,
        suggestedExercise: issue.suggestions[0].exercise,
        lineNumber: issue.lineNumber
      }));
    
    if (corrections.length > 0) {
      onApplyAllCorrections(corrections);
    }
  };

  const handleApplySelectedCorrections = () => {
    const corrections = Object.entries(selectedCorrections).map(([exerciseName, suggestion]) => {
      const issue = visibleIssues.find(i => i.exerciseName === exerciseName);
      return {
        originalName: exerciseName,
        suggestedExercise: suggestion.exercise,
        lineNumber: issue?.lineNumber || 1
      };
    });
    
    if (corrections.length > 0) {
      onApplyAllCorrections(corrections);
    }
  };

  const handleIgnoreExercise = (exerciseName: string) => {
    setDismissedExercises(prev => new Set([...prev, exerciseName]));
    onIgnoreExercise(exerciseName);
  };

  if (visibleIssues.length === 0) return null;

  const highConfidenceCount = visibleIssues.filter(
    issue => issue.suggestions.length > 0 && issue.suggestions[0].confidence >= 85
  ).length;

  const selectedCorrectionsCount = Object.keys(selectedCorrections).length;

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-body font-semibold text-ink">
            <span className="font-tabular">{visibleIssues.length}</span> exercise{visibleIssues.length !== 1 ? 's' : ''} might need a fix
          </h3>
          <p className="mt-0.5 text-body-sm text-ink-muted">
            Names the library doesn't know are kept as custom exercises.
          </p>
        </div>
        <IconButton
          variant="ghost"
          onClick={onDismiss}
          aria-label="Dismiss corrections"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </div>

      <ul className="divide-y divide-hairline border-t border-hairline">
        {visibleIssues.map((issue, index) => (
          <li key={issue.exerciseName + index} className="py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="truncate text-body font-semibold text-ink">
                  {issue.exerciseName}
                </h4>
                <p className="truncate text-body-sm text-ink-muted">
                  <span className="font-tabular">Line {issue.lineNumber}</span>: {issue.context}
                </p>
              </div>

              <Button
                variant="ghost"
                onClick={() => handleIgnoreExercise(issue.exerciseName)}
                title="Keep as custom exercise"
              >
                Keep as is
              </Button>
            </div>

            {issue.suggestions.length > 0 ? (
              <div className="mt-2">
                <p className="mb-1 text-caption text-ink-subtle">Did you mean</p>
                <div role="radiogroup" aria-label={`Suggestions for ${issue.exerciseName}`} className="space-y-1">
                  {issue.suggestions.slice(0, 3).map((suggestion, suggestionIndex) => {
                    const selected = selectedCorrections[issue.exerciseName] === suggestion;
                    return (
                      <div
                        key={suggestionIndex}
                        role="radio"
                        aria-checked={selected}
                        tabIndex={0}
                        className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-3 py-2 transition-colors duration-snap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          selected ? 'bg-surface-raised' : 'hover:bg-surface-raised/60'
                        }`}
                        onClick={() => handleSelectSuggestion(issue.exerciseName, suggestion)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectSuggestion(issue.exerciseName, suggestion);
                          }
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-body-sm font-semibold text-ink">
                              {suggestion.exercise.name}
                            </span>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 font-tabular text-caption ${
                              suggestion.confidence >= 85 ? 'bg-accent-2/15 text-accent-2' :
                              suggestion.confidence >= 70 ? 'bg-surface text-ink-muted' :
                              'bg-warning/15 text-warning'
                            }`}>
                              {suggestion.confidence}%
                            </span>
                          </div>
                          <div className="truncate text-caption text-ink-muted">
                            {suggestion.exercise.muscleGroup} · {suggestion.exercise.equipment}. {suggestion.reason}
                          </div>
                        </div>

                        <Button
                          variant="secondary"
                          size="sm"
                          className="shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onApplyCorrection(issue.exerciseName, suggestion.exercise, issue.lineNumber);
                          }}
                        >
                          Replace
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="mt-1 text-body-sm text-ink-muted">
                Nothing similar in the library. It stays a custom exercise.
              </p>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        {selectedCorrectionsCount > 0 && (
          <Button variant="primary" size="lg" onClick={handleApplySelectedCorrections}>
            Apply <span className="font-tabular">{selectedCorrectionsCount}</span> selected
          </Button>
        )}
        {highConfidenceCount > 0 && (
          <Button
            variant="secondary"
            size="lg"
            onClick={handleApplyAllHighConfidence}
            title="Apply corrections with 85%+ confidence"
          >
            Fix <span className="font-tabular">{highConfidenceCount}</span> close match{highConfidenceCount !== 1 ? 'es' : ''}
          </Button>
        )}
        <Button variant="ghost" onClick={onDismiss}>
          Continue with custom exercises
        </Button>
      </div>
    </Card>
  );
};