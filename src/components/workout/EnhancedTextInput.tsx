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
import { Check, ChevronDown, Keyboard, Loader2, Search, Wand2, X } from 'lucide-react';

const FORMAT_GUIDE: [syntax: string, meaning: string][] = [
  ['3x10 Squats', '3 sets of 10 reps'],
  ['3x8-12 Curls', '3 sets of 8 to 12'],
  ['3x8 Bench Press @155lbs', 'with weight'],
  ['Curls ss Tricep Extensions', 'superset'],
  ['Push Ups 4x15', 'name first works too'],
];

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

  const shortcuts: { label: string; keys: string }[] = [
    { label: 'Exercise search', keys: 'Ctrl+Space' },
    { label: 'Duplicate line', keys: 'Ctrl+D' },
    { label: 'Move line up or down', keys: 'Alt+↑/↓' },
    { label: 'Accept suggestion', keys: 'Tab' },
    { label: 'Show shortcuts', keys: 'Ctrl+/' },
    { label: 'Close dropdown', keys: 'Esc' },
  ];

  const showIssueHints = hasIssues && showSuggestions;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Name + text entry share one subtle card: the whole "write it" step. */}
      <Card className="space-y-5 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="workout-name" className="text-ink-muted">
            Workout name
          </Label>
          <Input
            id="workout-name"
            type="text"
            value={workoutName}
            onChange={(e) => onWorkoutNameChange(e.target.value)}
            placeholder="Push day, pull day, legs"
          />
        </div>

        {/* Exercise search */}
        <div className="space-y-1.5">
          <Label htmlFor="exercise-search" className="text-ink-muted">
            Add an exercise
          </Label>
          <div className="relative z-10">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-subtle"
            />
            <Input
              id="exercise-search"
              type="text"
              placeholder={isMobile ? 'Tap to search exercises' : 'Search for exercises to add to your workout'}
              value={exerciseSearchTerm}
              onChange={(e) => handleExerciseSearchChange(e.target.value)}
              onKeyDown={handleExerciseSearchKeyDown}
              onFocus={handleSearchInputFocus}
              readOnly={isMobile} // Prevent keyboard on mobile, just open modal
              className="rounded-full pl-11"
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

          {exerciseSearchTerm ? (
            <p className="flex items-center gap-2 text-caption text-ink-muted" aria-live="polite">
              {isSearching ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  <span>Searching</span>
                </>
              ) : hasResults ? (
                <span>
                  <span className="font-tabular">{searchResults.length}</span> match{searchResults.length !== 1 ? 'es' : ''}
                </span>
              ) : (
                <span>No matches. Try &ldquo;ohp&rdquo; for overhead press.</span>
              )}
            </p>
          ) : (
            <p className="text-caption text-ink-subtle">
              Search by name, muscle or equipment. It lands at your cursor.
            </p>
          )}
        </div>

        {/* Workout text */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="workout-text" className="text-ink-muted">
              Workout
            </Label>
            <Button variant="ghost" size="sm" onClick={onLoadExample}>
              Load example
            </Button>
          </div>

          <HighlightedTextarea
            ref={textareaRef}
            id="workout-text"
            value={workoutText}
            onChange={onWorkoutTextChange}
            onClick={handleTextareaClick}
            onKeyUp={handleTextareaKeyUp}
            onKeyDown={handleKeyDown}
            placeholder={exampleText}
            rows={10}
            parseIssues={showInlineSuggestions ? issues : []}
            className="font-num text-body"
            highlightText={highlightText}
          />

          {/* Insert / auto-correct feedback: quiet ice lines, not banners */}
          {insertFeedback.show && (
            <p className="flex items-center gap-2 pt-1 text-body-sm text-accent-2 animate-fade-in" role="status">
              <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              Added {insertFeedback.exerciseName}
            </p>
          )}
          {autoCorrectCount > 0 && (
            <p className="flex items-center gap-2 pt-1 text-body-sm text-accent-2" role="status">
              <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              Corrected {autoCorrectCount} exercise{autoCorrectCount !== 1 ? 's' : ''}
            </p>
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

          <div className="flex items-center justify-between gap-2 text-caption text-ink-subtle">
            <span>
              <span className="font-tabular">{workoutText.split('\n').length}</span> lines
              {showIssueHints && (
                <span className="ml-2 text-ink-muted">
                  <span className="font-tabular">{issues.length}</span> suggestion{issues.length !== 1 ? 's' : ''}
                  {issues.length > 0 && issues[0].suggestions[0]?.confidence >= 80 && ', Tab accepts'}
                </span>
              )}
            </span>

            <IconButton
              variant="ghost"
              onClick={() => setShowShortcutsHelp(!showShortcutsHelp)}
              aria-label="Keyboard shortcuts"
              aria-expanded={showShortcutsHelp}
              title="Keyboard shortcuts (Ctrl+/)"
            >
              <Keyboard className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </div>

          {/* Keyboard shortcuts (progressive disclosure) */}
          {showShortcutsHelp && (
            <div className="rounded-2xl bg-surface-raised px-4 py-2">
              <div className="flex items-center justify-between">
                <h4 className="text-body-sm font-semibold text-ink">Keyboard shortcuts</h4>
                <IconButton
                  variant="ghost"
                  onClick={() => setShowShortcutsHelp(false)}
                  aria-label="Close keyboard shortcuts"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </IconButton>
              </div>
              <ul className="divide-y divide-hairline text-body-sm">
                {shortcuts.map((s) => (
                  <li key={s.label} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-ink-muted">{s.label}</span>
                    <kbd className="rounded-md bg-surface px-2 py-0.5 font-mono text-caption text-ink">{s.keys}</kbd>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      {/* The one forward action on this tab */}
      <div className="space-y-2">
        <Button
          variant="primary"
          size="xl"
          onClick={onParseWorkout}
          disabled={isParseDisabled}
        >
          <Wand2 className="h-5 w-5" aria-hidden="true" />
          Parse workout
        </Button>
        {showIssueHints && (
          <p className="text-center text-caption text-ink-muted">
            Fix the names above, or parse as-is to keep them as custom exercises.
          </p>
        )}
      </div>

      {/* Past Workouts */}
      <PastWorkouts
        onSelectWorkout={(workoutText, workoutName) => {
          onWorkoutTextChange(workoutText);
          if (workoutName) {
            onWorkoutNameChange(workoutName);
          }
          // Show feedback
          setInsertFeedback({ show: true, exerciseName: workoutName || 'past workout' });
          setTimeout(() => setInsertFeedback({ show: false, exerciseName: '' }), 2000);
        }}
        mode="autofill"
        showSavedWorkouts={true}
      />

      {/* Format guide, one tap away */}
      <Card>
        <details className="group">
          <summary className="flex min-h-touch-lg cursor-pointer list-none items-center justify-between gap-2 rounded-[20px] px-4 text-body font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
            Format guide
            <ChevronDown className="h-4 w-4 text-ink-muted transition-transform duration-snap group-open:rotate-180" aria-hidden="true" />
          </summary>
          <dl className="divide-y divide-hairline px-4 pb-2 text-body-sm">
            {FORMAT_GUIDE.map(([syntax, meaning]) => (
              <div key={syntax} className="flex items-baseline justify-between gap-3 py-2.5">
                <dt className="min-w-0 font-mono text-ink">{syntax}</dt>
                <dd className="shrink-0 text-ink-muted">{meaning}</dd>
              </div>
            ))}
          </dl>
        </details>
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