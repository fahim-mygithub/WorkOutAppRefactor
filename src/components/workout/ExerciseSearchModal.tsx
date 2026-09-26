import React, { useState, useEffect, useRef } from 'react';
import { Exercise } from '../../types/exercise';
import { useSmartSearch } from '../../hooks/useSmartSearch';
import { highlightText } from '../../utils/searchUtils';
import { CustomExerciseBadge } from './CustomExerciseBadge';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '../ui/sheet';
import { IconButton } from '../ui/icon-button';
import { ExerciseHueDot } from '../ExerciseThumbnail';
import { ChevronRight, Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ExerciseSearchModalProps {
  exercises: Exercise[];
  isOpen: boolean;
  onClose: () => void;
  onSelectExercise: (exercise: Exercise) => void;
  currentExerciseName?: string;
}

export const ExerciseSearchModal: React.FC<ExerciseSearchModalProps> = ({
  exercises,
  isOpen,
  onClose,
  onSelectExercise,
  currentExerciseName = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Smart search with enhanced options for modal
  const {
    results: searchResults,
    isSearching,
    setSearchQuery,
    clearSearch,
  } = useSmartSearch(exercises, {
    debounceMs: 200, // Slightly longer for modal
    maxResults: 20, // More results in modal
    minScore: 25, // Lower threshold for broader matches
    enableAbbreviations: true,
    enableSynonyms: true,
  });

  // Update search query and filter out current exercise
  useEffect(() => {
    if (searchTerm.trim()) {
      setSearchQuery(searchTerm);
    } else {
      clearSearch();
    }
  }, [searchTerm, setSearchQuery, clearSearch]);

  // Get filtered results excluding current exercise
  const filteredResults = searchTerm.trim()
    ? searchResults.filter(result =>
        result.exercise.name.toLowerCase() !== currentExerciseName.toLowerCase()
      )
    : exercises
        .filter(exercise =>
          exercise.name.toLowerCase() !== currentExerciseName.toLowerCase()
        )
        .slice(0, 20)
        .map(exercise => ({
          exercise,
          score: 0,
          matchType: 'default',
          matchedWords: [],
          highlightRanges: [],
        }));

  // Update selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredResults.length]);

  // Keyboard navigation (arrows / enter). Escape + scroll-lock + focus-trap are
  // owned by the Sheet primitive (Radix Dialog), so they are no longer handled
  // here — only the bespoke up/down/enter result navigation remains.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex(prev =>
            prev < filteredResults.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex(prev =>
            prev > 0 ? prev - 1 : filteredResults.length - 1
          );
          break;
        case 'Enter':
          event.preventDefault();
          if (filteredResults[selectedIndex]) {
            handleSelectExercise(filteredResults[selectedIndex].exercise);
          }
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);

      // Focus search input when modal opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, filteredResults, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (isOpen && resultRefs.current[selectedIndex]) {
      resultRefs.current[selectedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex, isOpen]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedIndex(0);
      clearSearch();
    }
  }, [isOpen, clearSearch]);

  const handleSelectExercise = (exercise: Exercise) => {
    onSelectExercise(exercise);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="mx-auto flex max-h-[85vh] max-w-2xl flex-col pb-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <SheetTitle className="text-title">Replace exercise</SheetTitle>
            {currentExerciseName && (
              <SheetDescription className="truncate">
                Swapping out {currentExerciseName}
              </SheetDescription>
            )}
          </div>
          <IconButton variant="ghost" onClick={onClose} aria-label="Close exercise search">
            <X size={20} aria-hidden="true" />
          </IconButton>
        </div>

        {/* Search pill */}
        <div className="relative mt-4">
          <Search
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle"
          />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Name, muscle, or equipment"
            aria-label="Search exercises"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-touch-lg w-full rounded-full bg-surface-raised pl-11 pr-4 text-body text-ink placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>

        <p className="mt-3 px-1 text-body-sm text-ink-muted" aria-live="polite">
          {isSearching
            ? 'Searching'
            : `${filteredResults.length} ${filteredResults.length === 1 ? 'result' : 'results'}`}
        </p>

        {/* Results */}
        <div className="-mx-6 mt-2 flex-1 overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {filteredResults.length === 0 && !isSearching ? (
            <div className="px-6 py-10 text-center">
              <p className="text-body text-ink">No exercises found</p>
              <p className="mt-1 text-body-sm text-ink-muted">
                Try a shorter name, or shorthand like "ohp" or "bp".
              </p>
            </div>
          ) : isSearching && filteredResults.length === 0 ? (
            <p className="px-6 py-10 text-center text-body-sm text-ink-muted">Searching exercises</p>
          ) : (
            <ul>
              {filteredResults.map((result, index) => {
                const { exercise, highlightRanges } = result;
                return (
                  <li key={exercise.id} className={index > 0 ? 'border-t border-hairline' : undefined}>
                    <button
                      type="button"
                      ref={el => { resultRefs.current[index] = el; }}
                      onClick={() => handleSelectExercise(exercise)}
                      className={cn(
                        'flex min-h-[64px] w-full items-center gap-4 px-6 py-3 text-left transition-colors duration-snap hover:bg-surface-raised/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
                        index === selectedIndex && 'bg-surface-raised/60',
                      )}
                    >
                      <ExerciseHueDot muscleGroup={exercise.muscleGroup} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span
                            className="truncate text-body font-semibold text-ink [&_mark]:bg-transparent [&_mark]:px-0 [&_mark]:text-accent"
                            dangerouslySetInnerHTML={{
                              __html: highlightRanges.length > 0
                                ? highlightText(exercise.name, highlightRanges)
                                : exercise.name
                            }}
                          />
                          {exercise.id?.startsWith('custom-') && (
                            <CustomExerciseBadge size="sm" showText={false} className="shrink-0" />
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-body-sm text-ink-muted">
                          {exercise.muscleGroups && exercise.muscleGroups.length > 1
                            ? exercise.muscleGroups.slice(0, 2).join(', ') + (exercise.muscleGroups.length > 2 ? '…' : '')
                            : exercise.muscleGroup}
                          {exercise.equipment ? ` · ${exercise.equipment}` : ''}
                        </span>
                      </span>
                      <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-ink-subtle" />
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
