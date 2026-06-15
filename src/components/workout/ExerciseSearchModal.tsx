import React, { useState, useEffect, useRef } from 'react';
import { Exercise } from '../../types/exercise';
import { useSmartSearch } from '../../hooks/useSmartSearch';
import { highlightText } from '../../utils/searchUtils';
import { CustomExerciseBadge } from './CustomExerciseBadge';
import { APP_SCROLL_ID } from '../../lib/scroll';

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

  // Handle escape key and focus management
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'Escape':
          onClose();
          break;
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

    // The shell already sets body overflow:hidden, so lock the canonical
    // scroll container (#app-scroll) instead of fighting the shell on body.
    const scrollEl = document.getElementById(APP_SCROLL_ID);
    const previousOverflow = scrollEl?.style.overflow ?? '';

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      if (scrollEl) {
        scrollEl.style.overflow = 'hidden';
      }

      // Focus search input when modal opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (scrollEl) {
        scrollEl.style.overflow = previousOverflow;
      }
    };
  }, [isOpen, onClose, filteredResults, selectedIndex]);

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
        return 'bg-green-900 text-green-300 border-green-700';
      case 'intermediate':
        return 'bg-yellow-900 text-yellow-300 border-yellow-700';
      case 'advanced':
        return 'bg-red-900 text-red-300 border-red-700';
      default:
        return 'bg-gray-900 text-gray-300 border-gray-700';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div className="relative transform overflow-hidden rounded-lg bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
          <div className="flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Replace Exercise
                </h3>
                {currentExerciseName && (
                  <p className="text-sm text-gray-400 mt-1">
                    Currently: {currentExerciseName}
                  </p>
                )}
              </div>
              
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Search Input */}
            <div className="p-6 border-b border-gray-700">
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search exercises by name, muscle group, or equipment..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  {isSearching ? (
                    <>
                      <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                      <span>Searching...</span>
                    </>
                  ) : (
                    <span>
                      {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} found
                    </span>
                  )}
                  {searchStats && searchStats.searchTime > 0 && (
                    <span className="text-gray-500">
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
            <div className="flex-1 overflow-y-auto max-h-96">
              {filteredResults.length === 0 && !isSearching ? (
                <div className="p-6 text-center text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-lg font-medium mb-2">No exercises found</p>
                  <p className="text-sm">Try "ohp" for overhead press or "bp" for bench press</p>
                </div>
              ) : isSearching && filteredResults.length === 0 ? (
                <div className="p-6 text-center text-gray-400">
                  <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-sm">Searching exercises...</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {filteredResults.map((result, index) => {
                    const { exercise, score, matchType, highlightRanges } = result;
                    return (
                      <button
                        key={exercise.id}
                        ref={el => resultRefs.current[index] = el}
                        onClick={() => handleSelectExercise(exercise)}
                        className={`w-full px-6 py-4 text-left hover:bg-gray-700 focus:bg-gray-700 focus:outline-none transition-colors ${
                          index === selectedIndex ? 'bg-gray-700 ring-2 ring-blue-500 ring-inset' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex-shrink-0 w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center relative">
                                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                {index < 3 && score > 0 && (
                                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                                    {index + 1}
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-white truncate flex-1">
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
                                <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
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
                              <span className={`px-2 py-1 rounded text-xs font-medium border ${getDifficultyColor(exercise.difficulty)}`}>
                                {exercise.difficulty}
                              </span>

                              {score > 0 && (
                                <span className="px-2 py-1 rounded text-xs font-medium bg-blue-900 text-blue-300 border border-blue-700">
                                  {matchType} ({score}pts)
                                </span>
                              )}

                              {exercise.mechanic && (
                                <span className="px-2 py-1 rounded text-xs font-medium bg-gray-700 text-gray-300 border border-gray-600">
                                  {exercise.mechanic}
                                </span>
                              )}

                              {exercise.force && (
                                <span className="px-2 py-1 rounded text-xs font-medium bg-gray-700 text-gray-300 border border-gray-600">
                                  {exercise.force}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex-shrink-0 ml-4">
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <div className="border-t border-gray-700 px-6 py-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-400">
                  Select an exercise to replace "{currentExerciseName}"
                </p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};