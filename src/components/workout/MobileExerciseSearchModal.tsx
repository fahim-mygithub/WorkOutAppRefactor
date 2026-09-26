import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Exercise } from '../../types/exercise';
import { ExerciseHueDot } from '../ExerciseThumbnail';
import { useSmartSearch } from '../../hooks/useSmartSearch';
import { useKeyboardDetection } from '../../hooks/useKeyboardDetection';
import { highlightText } from '../../utils/searchUtils';
import { ALL_MUSCLE_TERMS } from '../../lib/muscleTerms';
import { cn } from '../../lib/utils';
import { X, Search, Plus } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '../ui/sheet';
import { IconButton } from '../ui/icon-button';

interface MobileExerciseSearchModalProps {
  exercises: Exercise[];
  isOpen: boolean;
  onClose: () => void;
  onSelectExercise: (exercise: Exercise) => void;
  className?: string;
}

/**
 * Full-screen "Add exercise" picker for phones (Tempo): search pill, one row
 * of muscle chips, and results as hairline rows with a hue dot. Tapping a row
 * adds the exercise and closes. Swipe down to dismiss.
 */
export const MobileExerciseSearchModal: React.FC<MobileExerciseSearchModalProps> = ({
  exercises,
  isOpen,
  onClose,
  onSelectExercise,
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('all');
  const [touchStartY, setTouchStartY] = useState(0);
  const [touchStartTime, setTouchStartTime] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const { isVisible: isKeyboardVisible, height: keyboardHeight } = useKeyboardDetection();

  // Smart search with mobile-optimized settings
  const {
    results: searchResults,
    isSearching,
    setSearchQuery,
    clearSearch,
  } = useSmartSearch(exercises, {
    debounceMs: 150,
    maxResults: 24,
    minScore: 25,
    enableAbbreviations: true,
    enableSynonyms: true,
  });

  // Filter results by muscle
  const filteredResults = useMemo(() => {
    let results = searchTerm.trim() ? searchResults :
      exercises.slice(0, 24).map(exercise => ({
        exercise,
        score: 0,
        matchType: 'default' as const,
        matchedWords: [],
        highlightRanges: [],
      }));

    // Muscle chips share the body map's vocabulary: a substring match against
    // the comma-joined muscleGroup field (same as the Library's filter).
    if (selectedMuscleGroup !== 'all') {
      const term = selectedMuscleGroup.toLowerCase();
      results = results.filter(result =>
        result.exercise.muscleGroup.toLowerCase().includes(term)
      );
    }

    return results;
  }, [searchResults, exercises, selectedMuscleGroup, searchTerm]);

  // Update search query
  useEffect(() => {
    if (searchTerm.trim()) {
      setSearchQuery(searchTerm);
    } else {
      clearSearch();
    }
  }, [searchTerm, setSearchQuery, clearSearch]);

  // Reset transient state when modal opens / focus search. Scroll-lock,
  // Escape, focus-trap and backdrop are owned by the Sheet primitive.
  useEffect(() => {
    if (isOpen) {
      // Focus search input when modal opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      setSearchTerm('');
      setSelectedMuscleGroup('all');
    }
  }, [isOpen]);

  // Touch gesture handlers for swipe-to-close
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStartY(touch.clientY);
    setTouchStartTime(Date.now());
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Prevent default to avoid page scroll during swipe
    if (e.touches[0].clientY > touchStartY + 10) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const touchEndY = touch.clientY;
    const touchDuration = Date.now() - touchStartTime;
    const swipeDistance = touchEndY - touchStartY;
    const swipeVelocity = swipeDistance / touchDuration;

    // Close modal if swipe down is significant (100px+ or fast swipe)
    if (swipeDistance > 100 || (swipeDistance > 50 && swipeVelocity > 0.3)) {
      onClose();
    }
  };

  // Haptic feedback helper
  const triggerHapticFeedback = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    // Check if haptic feedback is supported
    if ('vibrate' in navigator) {
      switch (type) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(20);
          break;
        case 'heavy':
          navigator.vibrate(50);
          break;
      }
    }
  };

  const handleSelectExercise = (exercise: Exercise) => {
    // Provide haptic feedback on selection
    triggerHapticFeedback('light');

    onSelectExercise(exercise);

    // Close modal after adding exercise for better mobile UX
    onClose();
  };

  const calculateModalHeight = () => {
    if (isKeyboardVisible) {
      return `calc(100svh - ${keyboardHeight}px)`;
    }
    return '100svh';
  };

  return (
    <Sheet open={isOpen} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        ref={modalRef}
        className={cn('inset-0 flex max-h-none w-full flex-col rounded-none bg-surface p-0 pt-3 touch-pan-y', className)}
        style={{ height: calculateModalHeight() }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header, search and filters stay put above the scrolling results */}
        <div className="flex-shrink-0 px-4">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="text-title">Add exercise</SheetTitle>
            <IconButton variant="ghost" onClick={onClose} aria-label="Close exercise search">
              <X size={20} aria-hidden="true" />
            </IconButton>
          </div>

          <div className="relative mt-3">
            <Search
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle"
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search exercises"
              aria-label="Search exercises"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-touch-lg w-full rounded-full bg-surface-raised pl-11 pr-4 text-body text-ink placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>

          <div
            role="group"
            aria-label="Filter by muscle"
            className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {['all', ...ALL_MUSCLE_TERMS].map((term) => {
              const selected = selectedMuscleGroup === term;
              return (
                <button
                  key={term}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedMuscleGroup(selected && term !== 'all' ? 'all' : term)}
                  className={cn(
                    'min-h-touch-min shrink-0 whitespace-nowrap rounded-full px-4 text-body-sm font-semibold transition-colors duration-snap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    selected ? 'bg-accent-2 text-accent-2-fg' : 'bg-surface-raised text-ink-muted hover:text-ink',
                  )}
                >
                  {term === 'all' ? 'All' : term}
                </button>
              );
            })}
          </div>

          <p className="mt-2 px-1 text-body-sm text-ink-muted" aria-live="polite">
            {isSearching
              ? 'Searching'
              : `${filteredResults.length} ${filteredResults.length === 1 ? 'exercise' : 'exercises'}`}
          </p>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
          {filteredResults.length === 0 && !isSearching ? (
            <div className="px-4 py-12 text-center">
              <p className="text-body text-ink">No exercises found</p>
              <p className="mt-1 text-body-sm text-ink-muted">
                Try a shorter search, or tap All to clear the muscle filter.
              </p>
            </div>
          ) : isSearching && filteredResults.length === 0 ? (
            <p className="py-12 text-center text-body-sm text-ink-muted">Searching exercises</p>
          ) : (
            <ul className="overflow-hidden rounded-[20px] bg-surface-subtle">
              {filteredResults.map((result, index) => {
                const { exercise, highlightRanges } = result;
                return (
                  <li key={exercise.id} className={index > 0 ? 'border-t border-hairline' : undefined}>
                    <button
                      type="button"
                      onClick={() => handleSelectExercise(exercise)}
                      aria-label={`Add ${exercise.name}`}
                      className="flex min-h-[64px] w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-snap hover:bg-surface-raised/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                    >
                      <ExerciseHueDot muscleGroup={exercise.muscleGroup} />
                      <span className="min-w-0 flex-1">
                        <span
                          className="block truncate text-body font-semibold text-ink [&_mark]:bg-transparent [&_mark]:px-0 [&_mark]:text-accent"
                          dangerouslySetInnerHTML={{
                            __html: highlightRanges.length > 0
                              ? highlightText(exercise.name, highlightRanges)
                              : exercise.name
                          }}
                        />
                        <span className="mt-0.5 block truncate text-body-sm text-ink-muted">
                          {exercise.muscleGroup}
                          {exercise.equipment ? ` · ${exercise.equipment}` : ''}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-raised text-ink"
                      >
                        <Plus size={18} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
