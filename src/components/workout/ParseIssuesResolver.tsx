import React from 'react';
import { Exercise } from '../../types/exercise';
import { Button } from '../ui/button';
import { IconButton } from '../ui/icon-button';

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
    <div className="bg-warning/10 border border-warning/30 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-warning" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.485 3.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 3.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <h3 className="font-semibold text-ink">
            Found {visibleIssues.length} exercise{visibleIssues.length !== 1 ? 's' : ''} that might need correction
          </h3>
        </div>

        <div className="flex gap-2">
          {highConfidenceCount > 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleApplyAllHighConfidence}
              className="bg-success hover:bg-success/90 text-ink-inverse"
              title="Apply corrections with 85%+ confidence"
            >
              Auto-fix {highConfidenceCount} high-confidence
            </Button>
          )}

          {selectedCorrectionsCount > 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleApplySelectedCorrections}
            >
              Apply {selectedCorrectionsCount} selected
            </Button>
          )}

          <IconButton
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            aria-label="Dismiss corrections"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </IconButton>
        </div>
      </div>

      <div className="space-y-3">
        {visibleIssues.map((issue, index) => (
          <div key={issue.exerciseName + index} className="bg-surface-raised border border-border rounded p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-medium text-ink">
                  "{issue.exerciseName}" not found
                </h4>
                <p className="text-body-sm text-ink-subtle mt-1">
                  Line {issue.lineNumber}: {issue.context}
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleIgnoreExercise(issue.exerciseName)}
                title="Keep as custom exercise"
              >
                Keep as-is
              </Button>
            </div>

            {issue.suggestions.length > 0 ? (
              <div className="space-y-2">
                <p className="text-body-sm text-ink-subtle mb-2">Did you mean:</p>
                {issue.suggestions.slice(0, 3).map((suggestion, suggestionIndex) => (
                  <div
                    key={suggestionIndex}
                    className={`flex items-center justify-between p-3 border rounded cursor-pointer transition-all ${
                      selectedCorrections[issue.exerciseName] === suggestion
                        ? 'border-accent bg-accent/10'
                        : 'border-border hover:border-ink-subtle hover:bg-surface-subtle'
                    }`}
                    onClick={() => handleSelectSuggestion(issue.exerciseName, suggestion)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">
                          {suggestion.exercise.name}
                        </span>
                        <span className={`text-caption px-2 py-1 rounded ${
                          suggestion.confidence >= 85 ? 'bg-success/15 text-success' :
                          suggestion.confidence >= 70 ? 'bg-warning/15 text-warning' :
                          'bg-danger/15 text-danger'
                        }`}>
                          {suggestion.confidence}% match
                        </span>
                      </div>
                      <div className="text-body-sm text-ink-subtle mt-1">
                        {suggestion.exercise.muscleGroup} • {suggestion.exercise.equipment}
                      </div>
                      <div className="text-caption text-ink-subtle mt-1">
                        {suggestion.reason}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onApplyCorrection(issue.exerciseName, suggestion.exercise, issue.lineNumber);
                        }}
                      >
                        Replace
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-body-sm text-ink-subtle italic">
                No similar exercises found. This will be kept as a custom exercise.
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center pt-3 border-t border-warning/30">
        <p className="text-body-sm text-ink-subtle">
          Exercises not found in database will be saved as custom exercises
        </p>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
          >
            Continue with custom exercises
          </Button>
        </div>
      </div>
    </div>
  );
};