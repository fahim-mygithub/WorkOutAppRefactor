import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Exercise } from '../../types/exercise';
import { ExerciseThumbnail } from '../ExerciseThumbnail';
import { useSmartSearch } from '../../hooks/useSmartSearch';
import { useKeyboardDetection } from '../../hooks/useKeyboardDetection';
import { SearchMatch, highlightText } from '../../utils/searchUtils';
import { X, Search, Filter, ChevronDown, Plus } from 'lucide-react';

interface MobileExerciseSearchModalProps {
  exercises: Exercise[];
  isOpen: boolean;
  onClose: () => void;
  onSelectExercise: (exercise: Exercise) => void;
  className?: string;
}

const getDifficultyColor = (difficulty: string): string => {
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

export const MobileExerciseSearchModal: React.FC<MobileExerciseSearchModalProps> = ({
  exercises,
  isOpen,
  onClose,
  onSelectExercise,
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  const [touchStartTime, setTouchStartTime] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const { isVisible: isKeyboardVisible, height: keyboardHeight } = useKeyboardDetection();

  // Smart search with mobile-optimized settings
  const {
    results: searchResults,
    isSearching,
    hasResults,
    setSearchQuery,
    clearSearch,
    searchStats,
  } = useSmartSearch(exercises, {
    debounceMs: 150,
    maxResults: 24, // More results for grid view
    minScore: 25,
    enableAbbreviations: true,
    enableSynonyms: true,
  });

  // Get unique muscle groups for filter
  const muscleGroups = useMemo(() => {
    const groups = Array.from(new Set(exercises.map(e => e.muscleGroup)));
    return ['all', ...groups.sort()];
  }, [exercises]);

  // Filter results by muscle group
  const filteredResults = useMemo(() => {
    let results = searchTerm.trim() ? searchResults :
      exercises.slice(0, 24).map(exercise => ({
        exercise,
        score: 0,
        matchType: 'default' as const,
        matchedWords: [],
        highlightRanges: [],
      }));

    if (selectedMuscleGroup !== 'all') {
      results = results.filter(result =>
        result.exercise.muscleGroup === selectedMuscleGroup
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

  // Handle modal open/close
  useEffect(() => {
    if (isOpen) {
      // Focus search input when modal opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);

      // Lock body scroll
      document.body.style.overflow = 'hidden';
    } else {
      // Reset state and unlock body scroll
      setSearchTerm('');
      setSelectedMuscleGroup('all');
      setShowFilters(false);
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
      return `calc(100vh - ${keyboardHeight}px)`;
    }
    return '100vh';
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 ${className}`}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-75 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full bg-gray-900 flex flex-col touch-pan-y"
        style={{ height: calculateModalHeight() }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700">
          {/* Swipe handle indicator */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-8 h-1 bg-gray-600 rounded-full"></div>
          </div>

          <div className="flex items-center justify-between p-4 pt-2">
            <h2 className="text-lg font-semibold text-white">Add Exercise</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700 p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search exercises..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-12 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded transition-colors ${
                selectedMuscleGroup !== 'all' || showFilters
                  ? 'text-blue-400 bg-blue-900'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="relative">
              <select
                value={selectedMuscleGroup}
                onChange={(e) => setSelectedMuscleGroup(e.target.value)}
                className="w-full py-2 px-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
              >
                {muscleGroups.map(group => (
                  <option key={group} value={group}>
                    {group === 'all' ? 'All Muscle Groups' : group}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          )}

          {/* Search Stats */}
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-2">
              {isSearching ? (
                <>
                  <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  <span>Searching...</span>
                </>
              ) : (
                <span>
                  {filteredResults.length} exercise{filteredResults.length !== 1 ? 's' : ''} found
                </span>
              )}
            </div>
            {searchStats && searchStats.searchTime > 0 && (
              <span className="text-gray-500">
                {searchStats.searchTime.toFixed(1)}ms
              </span>
            )}
          </div>
        </div>

        {/* Results Grid */}
        <div className="flex-1 overflow-y-auto">
          {filteredResults.length === 0 && !isSearching ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Search className="w-12 h-12 text-gray-500 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No exercises found</h3>
              <p className="text-sm text-gray-400">
                Try adjusting your search or filter settings
              </p>
            </div>
          ) : isSearching && filteredResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-sm text-gray-400">Searching exercises...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 p-4">
              {filteredResults.map((result, index) => {
                const { exercise, highlightRanges } = result;
                return (
                  <div
                    key={exercise.id}
                    className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden"
                  >
                    {/* Exercise Thumbnail */}
                    <div className="aspect-video bg-gray-900 relative">
                      <ExerciseThumbnail
                        exercise={exercise}
                        className="w-full h-full"
                        showPlayButton={exercise.videoLinks.length > 0}
                        onClick={() => handleSelectExercise(exercise)}
                        lazy={true}
                      />
                      {/* Add button overlay */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center opacity-90 shadow-lg">
                          <Plus className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    </div>

                    {/* Exercise Info */}
                    <div className="p-3 space-y-2">
                      <h3 className="font-medium text-white text-sm leading-tight">
                        <span
                          dangerouslySetInnerHTML={{
                            __html: highlightRanges.length > 0
                              ? highlightText(exercise.name, highlightRanges)
                              : exercise.name
                          }}
                        />
                      </h3>

                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="truncate">{exercise.muscleGroup}</span>
                        <span>•</span>
                        <span className="truncate">{exercise.equipment}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${getDifficultyColor(exercise.difficulty)}`}>
                          {exercise.difficulty}
                        </span>

                        {!exercise.videoLinks.length && (
                          <button
                            onClick={() => handleSelectExercise(exercise)}
                            className="p-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            <Plus className="w-3 h-3 text-white" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom hint */}
        <div className="flex-shrink-0 bg-gray-800 border-t border-gray-700 p-3">
          <p className="text-xs text-gray-400 text-center">
            Tap exercises to add them to your workout
          </p>
        </div>
      </div>
    </div>
  );
};