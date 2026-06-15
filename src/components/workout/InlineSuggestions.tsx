import React, { useState } from 'react';
import { ParseIssue } from '../../parser/workoutParser';
import { Exercise } from '../../types/exercise';
import { ExerciseSelectionModal } from './ExerciseSelectionModal';
import { useAppDispatch } from '../../store/hooks';
import { saveCustomExercise } from '../../store/slices/customExerciseSlice';
import { CustomExerciseService } from '../../services/customExerciseService';
import { Button } from '../ui/button';
import { IconButton } from '../ui/icon-button';

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
      <div className="mt-2 p-3 bg-surface-raised border border-border rounded-lg">
        <div className="flex items-center gap-2 text-ink-subtle text-body-sm">
          <div className="w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin"></div>
          Checking exercise names...
        </div>
      </div>
    );
  }

  if (issues.length === 0) {
    return null;
  }

  const highConfidenceCount = issues.filter(
    issue => issue.suggestions.length > 0 && issue.suggestions[0].confidence >= 90
  ).length;

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'bg-success/15 text-success border-success/40';
    if (confidence >= 70) return 'bg-warning/15 text-warning border-warning/40';
    return 'bg-danger/15 text-danger border-danger/40';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 90) {
      return (
        <svg className="w-3 h-3 text-success" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      );
    }
    if (confidence >= 70) {
      return (
        <svg className="w-3 h-3 text-warning" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      );
    }
    return (
      <svg className="w-3 h-3 text-danger" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    );
  };

  return (
    <div className="mt-2 p-4 bg-surface-raised border border-border rounded-lg space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-warning" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-body-sm font-medium text-ink">
            {issues.length} exercise{issues.length !== 1 ? 's' : ''} not found
          </span>
        </div>

        <div className="flex items-center gap-2">
          {highConfidenceCount > 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={onApplyAllHighConfidence}
              className="bg-success hover:bg-success/90 text-ink-inverse"
              title={`Auto-fix ${highConfidenceCount} high-confidence matches`}
            >
              Auto-fix {highConfidenceCount}
            </Button>
          )}
          <IconButton
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            aria-label="Dismiss suggestions"
            title="Dismiss suggestions"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </IconButton>
        </div>
      </div>

      {/* Suggestions */}
      <div className="space-y-2">
        {issues.slice(0, 5).map((issue, index) => {
          const topSuggestion = issue.suggestions[0];
          if (!topSuggestion) return null;

          return (
            <div key={`${issue.exerciseName}-${index}`} className="flex items-center justify-between p-2 bg-surface-subtle rounded border border-border">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Original text */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-danger font-medium text-body-sm line-through">
                    {issue.exerciseName}
                  </span>
                  <svg className="w-3 h-3 text-ink-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>

                {/* Suggestion */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-ink font-medium text-body-sm truncate">
                    {topSuggestion.exercise.name}
                  </span>

                  {/* Confidence badge */}
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded border text-caption flex-shrink-0 ${getConfidenceColor(topSuggestion.confidence)}`}>
                    {getConfidenceIcon(topSuggestion.confidence)}
                    {topSuggestion.confidence}%
                  </div>
                </div>

                {/* Exercise details */}
                <div className="text-caption text-ink-subtle flex-shrink-0 hidden sm:block">
                  {topSuggestion.exercise.muscleGroup}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 ml-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleOpenExerciseModal(issue)}
                  title="Browse and select from exercise database"
                >
                  Fix
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleKeepAsCustom(issue.exerciseName)}
                  disabled={customExerciseStatus[issue.exerciseName] === 'saving'}
                  className="bg-success hover:bg-success/90 text-ink-inverse"
                  title="Save as custom exercise"
                >
                  {customExerciseStatus[issue.exerciseName] === 'saving' ? 'Saving...' :
                   customExerciseStatus[issue.exerciseName] === 'saved' ? 'Saved ✓' :
                   customExerciseStatus[issue.exerciseName] === 'error' ? 'Error' :
                   'Keep'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer info */}
      {issues.length > 5 && (
        <div className="text-caption text-ink-subtle text-center pt-2 border-t border-border">
          Showing 5 of {issues.length} suggestions
        </div>
      )}

      {/* Help text */}
      <div className="text-caption text-ink-subtle">
        Click "Fix" to browse exercise database or "Keep" to save as custom exercise.
      </div>

      {/* Exercise Selection Modal */}
      <ExerciseSelectionModal
        isOpen={selectedIssueForModal !== null}
        onClose={handleCloseExerciseModal}
        onSelect={handleSelectExercise}
        originalExerciseName={selectedIssueForModal?.exerciseName || ''}
        exerciseDatabase={exerciseDatabase}
        title="Select Replacement Exercise"
      />
    </div>
  );
};