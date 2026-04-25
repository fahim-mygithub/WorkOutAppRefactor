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
      <div className="bg-gray-800 rounded-lg p-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Workout Name
        </label>
        <input
          type="text"
          value={workoutName}
          onChange={(e) => onWorkoutNameChange(e.target.value)}
          placeholder="Push Day, Pull Day, etc."
          className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Exercise Search */}
      <div className="bg-gray-800 rounded-lg p-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Search Exercises
        </label>
        <div className="relative z-10">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder={isMobile ? "Tap to search exercises..." : "Search for exercises to add to your workout..."}
            value={exerciseSearchTerm}
            onChange={(e) => handleExerciseSearchChange(e.target.value)}
            onKeyDown={handleExerciseSearchKeyDown}
            onFocus={handleSearchInputFocus}
            readOnly={isMobile} // Prevent keyboard on mobile, just open modal
            className="w-full pl-10 p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent relative z-0"
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
        
        <div className="mt-2 text-xs text-gray-500 space-y-1">
          <div>
            Search by exercise name, muscle group, or equipment. Click an exercise to insert it at your cursor position.
          </div>
          {exerciseSearchTerm && (
            <div className="flex items-center gap-2 text-xs">
              {isSearching ? (
                <>
                  <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-blue-400">Searching...</span>
                </>
              ) : hasResults ? (
                <>
                  <span className="text-green-400">
                    Found {searchResults.length} match{searchResults.length !== 1 ? 'es' : ''}
                  </span>
                  {searchStats.searchTime > 0 && (
                    <span className="text-gray-500">
                      ({searchStats.searchTime.toFixed(1)}ms{searchStats.cacheHit ? ', cached' : ''})
                    </span>
                  )}
                </>
              ) : (
                <span className="text-yellow-400">No matches found - try "ohp" for overhead press</span>
              )}
            </div>
          )}
        </div>
      </div>

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
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <label className="block text-sm font-medium text-gray-300">
            Workout Text
          </label>
          <button
            onClick={onLoadExample}
            className="text-blue-400 hover:text-blue-300 text-sm transition-colors-smooth hover-scale"
          >
            Load Example
          </button>
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
          className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
          highlightText={highlightText}
        />
        
        {/* Live character and line count */}
        {/* Insert feedback */}
        {insertFeedback.show && (
          <div className="mt-2 p-2 bg-blue-900/20 border border-blue-700 rounded flex items-center gap-2 animate-fade-in">
            <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-blue-300">
              Added "{insertFeedback.exerciseName}" to workout
            </span>
          </div>
        )}

        {/* Auto-correct feedback */}
        {autoCorrectCount > 0 && (
          <div className="mt-2 p-2 bg-green-900/20 border border-green-700 rounded flex items-center gap-2">
            <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-green-300">
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

        <div className="mt-2 text-xs text-gray-500 flex justify-between items-center">
          <span>
            {workoutText.length} characters, {workoutText.split('\n').length} lines
            {hasIssues && showSuggestions && (
              <span className="ml-2 text-yellow-400">
                • {issues.length} suggestion{issues.length !== 1 ? 's' : ''}
                {issues.length > 0 && issues[0].suggestions[0]?.confidence >= 80 && (
                  <span className="ml-1 text-blue-400">(Press Tab to accept)</span>
                )}
              </span>
            )}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowShortcutsHelp(!showShortcutsHelp)}
              className="text-gray-400 hover:text-gray-300 transition-colors-smooth hover-scale"
              title="Keyboard shortcuts (Ctrl+/)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </button>
            <span>Cursor: {cursorPosition}</span>
          </div>
        </div>

        {/* Keyboard Shortcuts Help */}
        {showShortcutsHelp && (
          <div className="mt-3 p-4 bg-gray-700 border border-gray-600 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-white">Keyboard Shortcuts</h4>
              <button
                onClick={() => setShowShortcutsHelp(false)}
                className="text-gray-400 hover:text-white transition-colors-smooth hover-scale"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-300">Exercise search</span>
                  <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">Ctrl+Space</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Duplicate line</span>
                  <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">Ctrl+D</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Move line up/down</span>
                  <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">Alt+↑/↓</kbd>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-300">Accept suggestion</span>
                  <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">Tab</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Show shortcuts</span>
                  <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">Ctrl+/</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Close dropdown</span>
                  <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">Esc</kbd>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Parse Workout Button */}
      <div className="bg-gray-800 rounded-lg p-6">
        <button
          onClick={onParseWorkout}
          disabled={isParseDisabled}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors-smooth flex items-center justify-center gap-2 hover-lift btn-press focus-ring"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Parse Workout
          {hasIssues && showSuggestions && (
            <span className="ml-2 px-2 py-0.5 bg-yellow-600 text-yellow-100 text-xs rounded">
              {issues.length} issue{issues.length !== 1 ? 's' : ''}
            </span>
          )}
        </button>
        
        {hasIssues && showSuggestions && (
          <div className="mt-2 text-xs text-gray-400 text-center">
            Fix suggestions above or parse as-is to create custom exercises
          </div>
        )}
      </div>

      {/* Format Guide */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-medium text-white mb-3">Format Guide</h3>
        <div className="text-sm text-gray-400 space-y-2">
          <p>• <span className="text-blue-400">3x10 Exercise Name</span> - 3 sets of 10 reps</p>
          <p>• <span className="text-blue-400">3x8-12 Exercise Name</span> - 3 sets of 8-12 reps</p>
          <p>• <span className="text-blue-400">3x8 Bench Press @155lbs</span> - with weight</p>
          <p>• <span className="text-blue-400">Exercise 1 ss Exercise 2</span> - superset</p>
          <p>• <span className="text-blue-400">Push Ups 4x15</span> - exercise name first</p>
        </div>
      </div>

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