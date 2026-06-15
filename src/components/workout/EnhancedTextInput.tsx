import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Exercise } from '../../types/exercise';
import { ExerciseSearchDropdown } from './ExerciseSearchDropdown';
import { MobileExerciseSearchModal } from './MobileExerciseSearchModal';
import { InlineSuggestions } from './InlineSuggestions';
import { HighlightedTextarea } from './HighlightedTextarea';
import { PastWorkouts } from './PastWorkouts';
import { ToastContainer } from '../Toast';
import { useAppSelector } from '../../store/hooks';
import { useAuth } from '../../contexts/AuthContext';
import { useParseValidation } from '../../hooks/useParseValidation';
import { useSmartSearch } from '../../hooks/useSmartSearch';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useToast } from '../../hooks/useToast';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { IconButton } from '../ui/icon-button';

interface EnhancedTextInputProps {
  workoutText: string;
  workoutName: string;
  onWorkoutTextChange: (text: string) => void;
  onWorkoutNameChange: (name: string) => void;
  onParseWorkout: () => void;
  onLoadExample: () => void;
  isParseDisabled?: boolean;
  className?: string;
  showInlineSuggestions?: boolean;
}

export const EnhancedTextInput: React.FC<EnhancedTextInputProps> = ({
  workoutText,
  workoutName,
  onWorkoutTextChange,
  onWorkoutNameChange,
  onParseWorkout,
  onLoadExample,
  isParseDisabled = false,
  className = '',
  showInlineSuggestions = true,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState('');
  const [showExerciseDropdown, setShowExerciseDropdown] = useState(false);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [autoCorrectCount, setAutoCorrectCount] = useState(0);
  const [insertFeedback, setInsertFeedback] = useState<{ show: boolean; exerciseName: string }>({ show: false, exerciseName: '' });
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [highlightText, setHighlightText] = useState<{ start: number; end: number; active: boolean }>({ start: 0, end: 0, active: false });

  const { exercises } = useAppSelector((state) => state.exercise);
  const { user } = useAuth(); // For user ID when saving custom exercises
  const { isMobile } = useIsMobile();
  const { toasts, removeToast, showSuccess } = useToast();

  // Initialize parse validation hook
  const {
    issues,
    hasIssues,
    isValidating,
    validateText,
    applyCorrection,
    applyAllHighConfidence,
  } = useParseValidation(exercises, 1000); // 1 second debounce

  // Smart search with enhanced options for text input
  const {
    results: searchResults,
    isSearching,
    hasResults,
    setSearchQuery,
    clearSearch,
    searchStats,
  } = useSmartSearch(exercises, {
    debounceMs: 100,
    maxResults: 12,
    minScore: 30,
    enableAbbreviations: true,
    enableSynonyms: true,
  });

  // Update search query when search term changes
  useEffect(() => {
    if (exerciseSearchTerm.trim() && showExerciseDropdown) {
      setSearchQuery(exerciseSearchTerm);
    } else {
      clearSearch();
    }
  }, [exerciseSearchTerm, showExerciseDropdown, setSearchQuery, clearSearch]);

  // Handle cursor position changes
  const handleTextareaClick = useCallback(() => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart || 0);
    }
  }, []);

  const handleTextareaKeyUp = useCallback(() => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart || 0);
    }
  }, []);

  // Insert exercise name at cursor position
  const insertExerciseAtCursor = useCallback((exercise: Exercise) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;

    const textBefore = workoutText.substring(0, start);
    const textAfter = workoutText.substring(end);

    // Check if we need to add a newline before or after
    const needsNewlineBefore = textBefore.length > 0 && !textBefore.endsWith('\n');
    const needsNewlineAfter = textAfter.length > 0 && !textAfter.startsWith('\n');

    const prefix = needsNewlineBefore ? '\n' : '';
    const suffix = needsNewlineAfter ? '\n' : '';

    // Use a common workout format: 3x10 Exercise Name
    const exerciseText = `${prefix}3x10 ${exercise.name}${suffix}`;
    const newText = textBefore + exerciseText + textAfter;

    onWorkoutTextChange(newText);

    // Set cursor position after the inserted text
    setTimeout(() => {
      const newCursorPosition = start + exerciseText.length;
      textarea.setSelectionRange(newCursorPosition, newCursorPosition);
      textarea.focus();
      setCursorPosition(newCursorPosition);
    }, 0);

    // Highlight the newly added text
    const highlightStart = start + prefix.length;
    const highlightEnd = highlightStart + exerciseText.trim().length - suffix.length;
    setHighlightText({ start: highlightStart, end: highlightEnd, active: true });

    // Remove highlight after animation
    setTimeout(() => {
      setHighlightText({ start: 0, end: 0, active: false });
    }, 2000);

    // Close dropdown/modal and clear search
    setShowExerciseDropdown(false);
    setShowMobileModal(false);
    setExerciseSearchTerm('');

    // Show success toast
    showSuccess(`Added: ${exercise.name}`, 2000);

    // Show success feedback (for legacy support)
    setInsertFeedback({ show: true, exerciseName: exercise.name });
    setTimeout(() => setInsertFeedback({ show: false, exerciseName: '' }), 2000);
  }, [workoutText, onWorkoutTextChange, showSuccess]);

  // Validate workout text for exercise suggestions
  useEffect(() => {
    if (showInlineSuggestions && workoutText.trim().length > 10) {
      validateText(workoutText);
    }
  }, [workoutText, validateText, showInlineSuggestions]);

  // Handle applying a single correction
  const handleApplyCorrection = useCallback((originalName: string, suggestedExercise: Exercise) => {
    const correctionFn = applyCorrection(originalName, suggestedExercise);
    const correctedText = correctionFn(workoutText);
    
    if (correctedText !== workoutText) {
      onWorkoutTextChange(correctedText);
      
      // Show success feedback
      console.log(`✅ Applied correction: "${originalName}" → "${suggestedExercise.name}"`);
      
      // Re-validate after a short delay
      setTimeout(() => {
        validateText(correctedText);
      }, 500);
    }
  }, [workoutText, onWorkoutTextChange, applyCorrection, validateText]);

  // Handle applying all high-confidence corrections
  const handleApplyAllHighConfidence = useCallback(() => {
    const { correctedText, corrections } = applyAllHighConfidence(workoutText);
    
    if (corrections > 0) {
      onWorkoutTextChange(correctedText);
      setAutoCorrectCount(corrections);
      
      console.log(`🤖 Auto-corrected ${corrections} exercises`);
      
      // Re-validate after corrections
      setTimeout(() => {
        validateText(correctedText);
      }, 500);
      
      // Clear auto-correct count after showing feedback
      setTimeout(() => {
        setAutoCorrectCount(0);
      }, 3000);
    }
  }, [workoutText, onWorkoutTextChange, applyAllHighConfidence, validateText]);

  // Handle keeping exercise as custom
  const handleKeepAsCustom = useCallback((exerciseName: string) => {
    console.log(`✅ Keeping exercise as custom: "${exerciseName}"`);
    // The exercise will remain in the text as-is
    // The InlineSuggestions component handles saving to Firebase
  }, []);

  // Handle dismissing suggestions
  const handleDismissSuggestions = useCallback(() => {
    setShowSuggestions(false);
  }, []);

  // Handle exercise search input changes
  const handleExerciseSearchChange = useCallback((value: string) => {
    setExerciseSearchTerm(value);

    if (isMobile) {
      // On mobile, open full-screen modal for any input
      if (value.trim().length > 0) {
        setShowMobileModal(true);
      }
    } else {
      // On desktop, show dropdown for any input
      setShowExerciseDropdown(value.trim().length > 0);
    }
  }, [isMobile]);

  // Handle exercise search key events
  const handleExerciseSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (isMobile) {
        setShowMobileModal(false);
      } else {
        setShowExerciseDropdown(false);
      }
      setExerciseSearchTerm('');
    } else if (e.key === 'Enter' && searchResults.length === 1) {
      e.preventDefault();
      insertExerciseAtCursor(searchResults[0].exercise);
    }
  }, [searchResults, insertExerciseAtCursor, isMobile]);

  // Handle search input focus on mobile (open modal immediately)
  const handleSearchInputFocus = useCallback(() => {
    if (isMobile) {
      setShowMobileModal(true);
    }
  }, [isMobile]);

  // Handle mobile modal close
  const handleMobileModalClose = useCallback(() => {
    setShowMobileModal(false);
    setExerciseSearchTerm('');
  }, []);

  // Handle global keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + Space: Open exercise search
    if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
      e.preventDefault();
      const searchInput = document.querySelector('input[placeholder*="Search for exercises"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
      return;
    }

    // Ctrl/Cmd + D: Duplicate current line
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      if (textareaRef.current) {
        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const lines = workoutText.split('\n');
        const currentLineIndex = workoutText.substring(0, start).split('\n').length - 1;

        if (currentLineIndex < lines.length) {
          const currentLine = lines[currentLineIndex];
          const newLines = [...lines];
          newLines.splice(currentLineIndex + 1, 0, currentLine);
          const newText = newLines.join('\n');
          onWorkoutTextChange(newText);

          // Position cursor at the end of duplicated line
          setTimeout(() => {
            const newPosition = start + currentLine.length + 1;
            textarea.setSelectionRange(newPosition, newPosition);
          }, 0);
        }
      }
      return;
    }

    // Ctrl/Cmd + /: Show shortcuts help
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      setShowShortcutsHelp(!showShortcutsHelp);
      return;
    }

    // Alt + Up/Down: Move line up/down
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      if (textareaRef.current) {
        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const lines = workoutText.split('\n');
        const currentLineIndex = workoutText.substring(0, start).split('\n').length - 1;

        if (e.key === 'ArrowUp' && currentLineIndex > 0) {
          // Move line up
          const newLines = [...lines];
          [newLines[currentLineIndex - 1], newLines[currentLineIndex]] =
            [newLines[currentLineIndex], newLines[currentLineIndex - 1]];
          onWorkoutTextChange(newLines.join('\n'));
        } else if (e.key === 'ArrowDown' && currentLineIndex < lines.length - 1) {
          // Move line down
          const newLines = [...lines];
          [newLines[currentLineIndex], newLines[currentLineIndex + 1]] =
            [newLines[currentLineIndex + 1], newLines[currentLineIndex]];
          onWorkoutTextChange(newLines.join('\n'));
        }
      }
      return;
    }

    // Tab: Auto-complete if suggestions available
    if (e.key === 'Tab' && issues.length > 0 && !e.shiftKey) {
      const firstIssue = issues[0];
      if (firstIssue.suggestions.length > 0 && firstIssue.suggestions[0].confidence >= 80) {
        e.preventDefault();
        handleApplyCorrection(firstIssue.exerciseName, firstIssue.suggestions[0].exercise);
        return;
      }
    }
  }, [workoutText, onWorkoutTextChange, showShortcutsHelp, issues, handleApplyCorrection]);

  const exampleText = `3x10 Squats @185lbs
3x8 Bench Press @155lbs
3x12 Barbell Rows @135lbs
4x15 Push Ups
3x8-12 Dumbbell Curls @30lbs ss 3x12 Tricep Extensions @25lbs`;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Workout Name */}
      <Card className="p-6">
        <Label htmlFor="workout-name" className="mb-2 block">
          Workout Name
        </Label>
        <Input
          id="workout-name"
          type="text"
          value={workoutName}
          onChange={(e) => onWorkoutNameChange(e.target.value)}
          placeholder="Push Day, Pull Day, etc."
        />
      </Card>

      {/* Exercise Search */}
      <Card className="p-6">
        <Label htmlFor="exercise-search" className="mb-2 block">
          Search Exercises
        </Label>
        <div className="relative z-10">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
            <svg className="w-4 h-4 text-ink-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <Input
            id="exercise-search"
            type="text"
            placeholder={isMobile ? "Tap to search exercises..." : "Search for exercises to add to your workout..."}
            value={exerciseSearchTerm}
            onChange={(e) => handleExerciseSearchChange(e.target.value)}
            onKeyDown={handleExerciseSearchKeyDown}
            onFocus={handleSearchInputFocus}
            readOnly={isMobile} // Prevent keyboard on mobile, just open modal
            className="pl-10"
          />

          {/* Exercise Search Dropdown - Desktop only */}
          {showExerciseDropdown && !isMobile && (
            <ExerciseSearchDropdown
              searchResults={searchResults}
              isSearching={isSearching}
              onSelectExercise={insertExerciseAtCursor}
              onClose={() => {
                setShowExerciseDropdown(false);
                setExerciseSearchTerm('');
              }}
              className="mt-1"
              searchStats={searchStats}
            />
          )}
        </div>

        <div className="mt-2 text-caption text-ink-subtle space-y-1">
          <div>
            Search by exercise name, muscle group, or equipment. Click an exercise to insert it at your cursor position.
          </div>
          {exerciseSearchTerm && (
            <div className="flex items-center gap-2 text-caption">
              {isSearching ? (
                <>
                  <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-accent">Searching...</span>
                </>
              ) : hasResults ? (
                <>
                  <span className="text-success">
                    Found {searchResults.length} match{searchResults.length !== 1 ? 'es' : ''}
                  </span>
                  {searchStats.searchTime > 0 && (
                    <span className="text-ink-subtle">
                      ({searchStats.searchTime.toFixed(1)}ms{searchStats.cacheHit ? ', cached' : ''})
                    </span>
                  )}
                </>
              ) : (
                <span className="text-warning">No matches found - try "ohp" for overhead press</span>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Past Workouts */}
      <PastWorkouts
        onSelectWorkout={(workoutText, workoutName) => {
          onWorkoutTextChange(workoutText);
          if (workoutName) {
            onWorkoutNameChange(workoutName);
          }
          // Show feedback
          setInsertFeedback({ show: true, exerciseName: workoutName || 'Past Workout Template' });
          setTimeout(() => setInsertFeedback({ show: false, exerciseName: '' }), 2000);
        }}
        mode="autofill"
        showSavedWorkouts={true}
        className="mt-6"
      />

      {/* Text Input Section */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <Label className="block">
            Workout Text
          </Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLoadExample}
            className="text-accent hover:text-accent"
          >
            Load Example
          </Button>
        </div>

        <HighlightedTextarea
          ref={textareaRef}
          value={workoutText}
          onChange={onWorkoutTextChange}
          onClick={handleTextareaClick}
          onKeyUp={handleTextareaKeyUp}
          onKeyDown={handleKeyDown}
          placeholder={exampleText}
          rows={12}
          parseIssues={showInlineSuggestions ? issues : []}
          className="w-full p-3 bg-surface border border-border rounded-lg text-ink focus:ring-2 focus:ring-accent focus:border-transparent font-mono text-body-sm"
          highlightText={highlightText}
        />
        
        {/* Live character and line count */}
        {/* Insert feedback */}
        {insertFeedback.show && (
          <div className="mt-2 p-2 bg-accent/10 border border-accent/40 rounded flex items-center gap-2 animate-fade-in">
            <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-body-sm text-accent">
              Added "{insertFeedback.exerciseName}" to workout
            </span>
          </div>
        )}

        {/* Auto-correct feedback */}
        {autoCorrectCount > 0 && (
          <div className="mt-2 p-2 bg-success/10 border border-success/40 rounded flex items-center gap-2">
            <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-body-sm text-success">
              Auto-corrected {autoCorrectCount} exercise{autoCorrectCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Parse validation suggestions */}
        {showInlineSuggestions && showSuggestions && (
          <InlineSuggestions
            issues={issues}
            isValidating={isValidating}
            onApplyCorrection={handleApplyCorrection}
            onApplyAllHighConfidence={handleApplyAllHighConfidence}
            onKeepAsCustom={handleKeepAsCustom}
            onDismiss={handleDismissSuggestions}
            exerciseDatabase={exercises}
            userId={user?.uid}
          />
        )}

        <div className="mt-2 text-caption text-ink-subtle flex justify-between items-center">
          <span>
            {workoutText.length} characters, {workoutText.split('\n').length} lines
            {hasIssues && showSuggestions && (
              <span className="ml-2 text-warning">
                • {issues.length} suggestion{issues.length !== 1 ? 's' : ''}
                {issues.length > 0 && issues[0].suggestions[0]?.confidence >= 80 && (
                  <span className="ml-1 text-accent">(Press Tab to accept)</span>
                )}
              </span>
            )}
          </span>

          <div className="flex items-center gap-2">
            <IconButton
              variant="ghost"
              size="sm"
              onClick={() => setShowShortcutsHelp(!showShortcutsHelp)}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (Ctrl+/)"
              className="h-6 w-6 text-ink-subtle"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </IconButton>
            <span>Cursor: {cursorPosition}</span>
          </div>
        </div>

        {/* Keyboard Shortcuts Help */}
        {showShortcutsHelp && (
          <div className="mt-3 p-4 bg-surface-subtle border border-border rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-ink">Keyboard Shortcuts</h4>
              <IconButton
                variant="ghost"
                size="sm"
                onClick={() => setShowShortcutsHelp(false)}
                aria-label="Close keyboard shortcuts"
                className="h-7 w-7 text-ink-subtle"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </IconButton>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-body-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-ink">Exercise search</span>
                  <kbd className="px-2 py-1 bg-surface rounded text-caption">Ctrl+Space</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink">Duplicate line</span>
                  <kbd className="px-2 py-1 bg-surface rounded text-caption">Ctrl+D</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink">Move line up/down</span>
                  <kbd className="px-2 py-1 bg-surface rounded text-caption">Alt+↑/↓</kbd>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-ink">Accept suggestion</span>
                  <kbd className="px-2 py-1 bg-surface rounded text-caption">Tab</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink">Show shortcuts</span>
                  <kbd className="px-2 py-1 bg-surface rounded text-caption">Ctrl+/</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink">Close dropdown</span>
                  <kbd className="px-2 py-1 bg-surface rounded text-caption">Esc</kbd>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Parse Workout Button */}
      <Card className="p-6">
        <Button
          variant="primary"
          size="lg"
          onClick={onParseWorkout}
          disabled={isParseDisabled}
          className="w-full"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Parse Workout
          {hasIssues && showSuggestions && (
            <span className="ml-2 px-2 py-0.5 bg-warning/20 text-warning text-caption rounded">
              {issues.length} issue{issues.length !== 1 ? 's' : ''}
            </span>
          )}
        </Button>

        {hasIssues && showSuggestions && (
          <div className="mt-2 text-caption text-ink-subtle text-center">
            Fix suggestions above or parse as-is to create custom exercises
          </div>
        )}
      </Card>

      {/* Format Guide */}
      <Card className="p-6">
        <h3 className="text-title font-medium text-ink mb-3">Format Guide</h3>
        <div className="text-body-sm text-ink-subtle space-y-2">
          <p>• <span className="text-accent">3x10 Exercise Name</span> - 3 sets of 10 reps</p>
          <p>• <span className="text-accent">3x8-12 Exercise Name</span> - 3 sets of 8-12 reps</p>
          <p>• <span className="text-accent">3x8 Bench Press @155lbs</span> - with weight</p>
          <p>• <span className="text-accent">Exercise 1 ss Exercise 2</span> - superset</p>
          <p>• <span className="text-accent">Push Ups 4x15</span> - exercise name first</p>
        </div>
      </Card>

      {/* Mobile Exercise Search Modal */}
      <MobileExerciseSearchModal
        exercises={exercises}
        isOpen={showMobileModal}
        onClose={handleMobileModalClose}
        onSelectExercise={insertExerciseAtCursor}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};