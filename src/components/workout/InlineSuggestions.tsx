import React, { useState } from 'react';
import { ParseIssue } from '../../parser/workoutParser';
import { Exercise } from '../../types/exercise';
import { ExerciseSelectionModal } from './ExerciseSelectionModal';
import { useAppDispatch } from '../../store/hooks';
import { saveCustomExercise } from '../../store/slices/customExerciseSlice';
import { CustomExerciseService } from '../../services/customExerciseService';
import { Button } from '../ui/button';
import { IconButton } from '../ui/icon-button';
import { ArrowRight, Loader2, X } from 'lucide-react';

interface InlineSuggestionsProps {
  issues: ParseIssue[];
  onApplyCorrection: (originalName: string, suggestedExercise: Exercise) => void;
  onApplyAllHighConfidence: () => void;
  onKeepAsCustom: (originalName: string) => void;
  onDismiss: () => void;
  isValidating?: boolean;
  exerciseDatabase: Exercise[];
  userId?: string; // For saving custom exercises
}

export const InlineSuggestions: React.FC<InlineSuggestionsProps> = ({
  issues,
  onApplyCorrection,
  onApplyAllHighConfidence,
  onKeepAsCustom,
  onDismiss,
  isValidating = false,
  exerciseDatabase,
  userId,
}) => {
  const [selectedIssueForModal, setSelectedIssueForModal] = useState<ParseIssue | null>(null);
  const [customExerciseStatus, setCustomExerciseStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
  const dispatch = useAppDispatch();

  // Handle opening exercise selection modal
  const handleOpenExerciseModal = (issue: ParseIssue) => {
    setSelectedIssueForModal(issue);
  };

  // Handle closing exercise selection modal
  const handleCloseExerciseModal = () => {
    setSelectedIssueForModal(null);
  };

  // Handle exercise selection from modal
  const handleSelectExercise = (exercise: Exercise) => {
    if (selectedIssueForModal) {
      onApplyCorrection(selectedIssueForModal.exerciseName, exercise);
      setSelectedIssueForModal(null);
    }
  };

  // Handle keeping exercise as custom
  const handleKeepAsCustom = async (exerciseName: string) => {
    if (!userId) {
      console.warn('User not logged in, keeping exercise locally only');
      onKeepAsCustom(exerciseName);
      return;
    }

    setCustomExerciseStatus(prev => ({ ...prev, [exerciseName]: 'saving' }));

    try {
      const customExerciseData = CustomExerciseService.createCustomExerciseFromText(exerciseName, userId);
      
      await dispatch(saveCustomExercise({ 
        userId, 
        exerciseData: customExerciseData 
      })).unwrap();

      setCustomExerciseStatus(prev => ({ ...prev, [exerciseName]: 'saved' }));
      
      // Call the callback to update the UI
      onKeepAsCustom(exerciseName);

      // Clear status after 3 seconds
      setTimeout(() => {
        setCustomExerciseStatus(prev => {
          const newState = { ...prev };
          delete newState[exerciseName];
          return newState;
        });
      }, 3000);

    } catch (error) {
      console.error('Failed to save custom exercise:', error);
      setCustomExerciseStatus(prev => ({ ...prev, [exerciseName]: 'error' }));
      
      // Still call the callback to update UI locally
      onKeepAsCustom(exerciseName);

      // Clear error status after 5 seconds
      setTimeout(() => {
        setCustomExerciseStatus(prev => {
          const newState = { ...prev };
          delete newState[exerciseName];
          return newState;
        });
      }, 5000);
    }
  };
  if (isValidating) {
    return (
      <p className="flex items-center gap-2 pt-1 text-body-sm text-ink-muted" aria-live="polite">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Checking exercise names
      </p>
    );
  }

  if (issues.length === 0) {
    return null;
  }

  const highConfidenceCount = issues.filter(
    issue => issue.suggestions.length > 0 && issue.suggestions[0].confidence >= 90
  ).length;

  // Match confidence is informational, not an outcome: ice for a near-certain
  // match, muted for a likely one, warning when it's a guess.
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'bg-accent-2/15 text-accent-2';
    if (confidence >= 70) return 'bg-surface text-ink-muted';
    return 'bg-warning/15 text-warning';
  };

  const getKeepLabel = (exerciseName: string) => {
    switch (customExerciseStatus[exerciseName]) {
      case 'saving':
        return 'Saving';
      case 'saved':
        return 'Saved';
      case 'error':
        return 'Not saved';
      default:
        return 'Keep';
    }
  };

  return (
    <div className="mt-2 rounded-2xl bg-surface-raised px-4 pb-3 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-body-sm font-semibold text-ink">
          <span className="font-tabular">{issues.length}</span> exercise{issues.length !== 1 ? 's' : ''} not found
        </p>

        <div className="flex items-center gap-1">
          {highConfidenceCount > 0 && (
            <Button
              variant="secondary"
              size="md"
              onClick={onApplyAllHighConfidence}
              className="bg-surface"
              title={`Auto-fix ${highConfidenceCount} high-confidence matches`}
            >
              Fix {highConfidenceCount}
            </Button>
          )}
          <IconButton
            variant="ghost"
            onClick={onDismiss}
            aria-label="Dismiss suggestions"
            title="Dismiss suggestions"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      {/* Suggestions: one row per unrecognized name */}
      <ul className="divide-y divide-hairline">
        {issues.slice(0, 5).map((issue, index) => {
          const topSuggestion = issue.suggestions[0];
          if (!topSuggestion) return null;
          const keepStatus = customExerciseStatus[issue.exerciseName];

          return (
            <li key={`${issue.exerciseName}-${index}`} className="py-3">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-body-sm">
                <span className="text-ink-muted line-through decoration-ink-subtle">
                  {issue.exerciseName}
                </span>
                <ArrowRight className="h-3 w-3 shrink-0 text-ink-subtle" aria-label="suggested" />
                <span className="min-w-0 truncate font-semibold text-ink">
                  {topSuggestion.exercise.name}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 font-tabular text-caption ${getConfidenceColor(topSuggestion.confidence)}`}
                >
                  {topSuggestion.confidence}%
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="truncate text-caption text-ink-subtle">
                  {topSuggestion.exercise.muscleGroup}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => handleOpenExerciseModal(issue)}
                    className="bg-surface"
                    title="Browse and select from exercise database"
                  >
                    Fix
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => handleKeepAsCustom(issue.exerciseName)}
                    disabled={keepStatus === 'saving'}
                    className={
                      keepStatus === 'saved'
                        ? 'text-success hover:text-success'
                        : keepStatus === 'error'
                          ? 'text-danger hover:text-danger'
                          : undefined
                    }
                    title="Save as custom exercise"
                  >
                    {getKeepLabel(issue.exerciseName)}
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="border-t border-hairline pt-2 text-caption text-ink-subtle">
        {issues.length > 5 && (
          <>
            Showing <span className="font-tabular">5</span> of <span className="font-tabular">{issues.length}</span>.{' '}
          </>
        )}
        Fix picks from the library; Keep saves it as your own exercise.
      </p>

      {/* Exercise Selection Modal */}
      <ExerciseSelectionModal
        isOpen={selectedIssueForModal !== null}
        onClose={handleCloseExerciseModal}
        onSelect={handleSelectExercise}
        originalExerciseName={selectedIssueForModal?.exerciseName || ''}
        exerciseDatabase={exerciseDatabase}
        title="Select a replacement"
      />
    </div>
  );
};