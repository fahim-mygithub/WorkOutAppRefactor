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
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { IconButton } from '../ui/icon-button';

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
    hasResults,
    setSearchQuery,
    clearSearch,
    searchStats,
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

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner':
        return 'bg-success/15 text-success border-success/40';
      case 'intermediate':
        return 'bg-warning/15 text-warning border-warning/40';
      case 'advanced':
        return 'bg-danger/15 text-danger border-danger/40';
      default:
        return 'bg-surface-subtle text-ink-subtle border-border';
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="mx-auto flex max-h-[85vh] max-w-2xl flex-col p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-6">
          <div>
            <SheetTitle className="text-title font-semibold text-ink">
              Replace Exercise
            </SheetTitle>
            {currentExerciseName && (
              <SheetDescription className="mt-1 text-body-sm text-ink-subtle">
                Currently: {currentExerciseName}
              </SheetDescription>
            )}
          </div>

          <IconButton
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close exercise search"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </IconButton>
        </div>

        {/* Search Input */}
        <div className="border-b border-border p-6">
          <div className="relative">
            <div className="absolute left-3 top-1/2 z-10 -translate-y-1/2 transform">
              <svg className="w-5 h-5 text-ink-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search exercises by name, muscle group, or equipment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-caption text-ink-subtle">
            <div className="flex items-center gap-2">
              {isSearching ? (
                <>
                  <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin"></div>
                  <span>Searching...</span>
                </>
              ) : (
                <span>
                  {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} found
                </span>
              )}
              {searchStats && searchStats.searchTime > 0 && (
                <span className="text-ink-subtle">
                  ({searchStats.searchTime.toFixed(1)}ms{searchStats.cacheHit ? ', cached' : ''})
                </span>
              )}
            </div>
            <span>
              Use ↑↓ to navigate, Enter to select, Esc to close
            </span>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {filteredResults.length === 0 && !isSearching ? (
            <div className="p-6 text-center text-ink-subtle">
              <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-body font-medium mb-2">No exercises found</p>
              <p className="text-body-sm">Try "ohp" for overhead press or "bp" for bench press</p>
            </div>
          ) : isSearching && filteredResults.length === 0 ? (
            <div className="p-6 text-center text-ink-subtle">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-body-sm">Searching exercises...</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredResults.map((result, index) => {
                const { exercise, score, matchType, highlightRanges } = result;
                return (
                  <button
                    key={exercise.id}
                    ref={el => { resultRefs.current[index] = el; }}
                    onClick={() => handleSelectExercise(exercise)}
                    className={`w-full px-6 py-4 text-left hover:bg-surface-subtle focus:bg-surface-subtle focus:outline-none transition-colors ${
                      index === selectedIndex ? 'bg-surface-subtle ring-2 ring-accent ring-inset' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex-shrink-0 w-10 h-10 bg-surface-subtle rounded-full flex items-center justify-center relative">
                            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            {index < 3 && score > 0 && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-accent-fg text-caption rounded-full flex items-center justify-center font-bold">
                                {index + 1}
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-ink truncate flex-1">
                                <span
                                  dangerouslySetInnerHTML={{
                                    __html: highlightRanges.length > 0
                                      ? highlightText(exercise.name, highlightRanges)
                                      : exercise.name
                                  }}
                                />
                              </h4>
                              {exercise.id?.startsWith('custom-') && (
                                <CustomExerciseBadge size="sm" showText={false} />
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-body-sm text-ink-subtle mt-1">
                              <span className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="truncate">
                                  {exercise.muscleGroups && exercise.muscleGroups.length > 1
                                    ? exercise.muscleGroups.slice(0, 2).join(', ') + (exercise.muscleGroups.length > 2 ? '...' : '')
                                    : exercise.muscleGroup
                                  }
                                </span>
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                                </svg>
                                {exercise.equipment}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Tags */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-1 rounded text-caption font-medium border ${getDifficultyColor(exercise.difficulty)}`}>
                            {exercise.difficulty}
                          </span>

                          {score > 0 && (
                            <span className="px-2 py-1 rounded text-caption font-medium bg-accent/15 text-accent border border-accent/40">
                              {matchType} ({score}pts)
                            </span>
                          )}

                          {exercise.mechanic && (
                            <span className="px-2 py-1 rounded text-caption font-medium bg-surface-subtle text-ink-subtle border border-border">
                              {exercise.mechanic}
                            </span>
                          )}

                          {exercise.force && (
                            <span className="px-2 py-1 rounded text-caption font-medium bg-surface-subtle text-ink-subtle border border-border">
                              {exercise.force}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex-shrink-0 ml-4">
                        <svg className="w-5 h-5 text-ink-subtle group-hover:text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4">
          <div className="flex justify-between items-center">
            <p className="text-body-sm text-ink-subtle">
              Select an exercise to replace "{currentExerciseName}"
            </p>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
