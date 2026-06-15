import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Exercise } from '../../types/exercise';
import { ExerciseThumbnail } from '../ExerciseThumbnail';
import { useSmartSearch } from '../../hooks/useSmartSearch';
import { useKeyboardDetection } from '../../hooks/useKeyboardDetection';
import { highlightText } from '../../utils/searchUtils';
import { X, Search, Filter, Plus } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '../ui/sheet';
import { Input } from '../ui/input';
import { IconButton } from '../ui/icon-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

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
      return 'bg-success/15 text-success border-success/40';
    case 'intermediate':
      return 'bg-warning/15 text-warning border-warning/40';
    case 'advanced':
      return 'bg-danger/15 text-danger border-danger/40';
    default:
      return 'bg-surface-subtle text-ink-subtle border-border';
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
      setShowFilters(false);
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
        className={`inset-0 flex max-h-none w-full flex-col rounded-none bg-surface p-0 touch-pan-y ${className}`}
        style={{ height: calculateModalHeight() }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-surface-raised border-b border-border">
          <div className="flex items-center justify-between p-4 pt-2">
            <SheetTitle className="text-title font-semibold text-ink">Add Exercise</SheetTitle>
            <IconButton
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close exercise search"
            >
              <X className="w-5 h-5" />
            </IconButton>
          </div>
        </div>

        {/* Search Input */}
        <div className="flex-shrink-0 bg-surface-raised border-b border-border p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-subtle z-10" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search exercises..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-12"
            />
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded transition-colors ${
                selectedMuscleGroup !== 'all' || showFilters
                  ? 'text-accent bg-accent/15'
                  : 'text-ink-subtle hover:text-ink'
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <Select
              value={selectedMuscleGroup}
              onValueChange={setSelectedMuscleGroup}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Muscle Groups" />
              </SelectTrigger>
              <SelectContent>
                {muscleGroups.map(group => (
                  <SelectItem key={group} value={group}>
                    {group === 'all' ? 'All Muscle Groups' : group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Search Stats */}
          <div className="flex items-center justify-between text-caption text-ink-subtle">
            <div className="flex items-center gap-2">
              {isSearching ? (
                <>
                  <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin"></div>
                  <span>Searching...</span>
                </>
              ) : (
                <span>
                  {filteredResults.length} exercise{filteredResults.length !== 1 ? 's' : ''} found
                </span>
              )}
            </div>
            {searchStats && searchStats.searchTime > 0 && (
              <span className="text-ink-subtle">
                {searchStats.searchTime.toFixed(1)}ms
              </span>
            )}
          </div>
        </div>

        {/* Results Grid */}
        <div className="flex-1 overflow-y-auto">
          {filteredResults.length === 0 && !isSearching ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Search className="w-12 h-12 text-ink-subtle mb-4" />
              <h3 className="text-body font-medium text-ink mb-2">No exercises found</h3>
              <p className="text-body-sm text-ink-subtle">
                Try adjusting your search or filter settings
              </p>
            </div>
          ) : isSearching && filteredResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-body-sm text-ink-subtle">Searching exercises...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 p-4">
              {filteredResults.map((result) => {
                const { exercise, highlightRanges } = result;
                return (
                  <div
                    key={exercise.id}
                    className="bg-surface-raised rounded-lg border border-border overflow-hidden"
                  >
                    {/* Exercise Thumbnail */}
                    <div className="aspect-video bg-surface-subtle relative">
                      <ExerciseThumbnail
                        exercise={exercise}
                        className="w-full h-full"
                        showPlayButton={exercise.videoLinks.length > 0}
                        onClick={() => handleSelectExercise(exercise)}
                        lazy={true}
                      />
                      {/* Add button overlay */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center opacity-90 shadow-e2">
                          <Plus className="w-4 h-4 text-accent-fg" />
                        </div>
                      </div>
                    </div>

                    {/* Exercise Info */}
                    <div className="p-3 space-y-2">
                      <h3 className="font-medium text-ink text-body-sm leading-tight">
                        <span
                          dangerouslySetInnerHTML={{
                            __html: highlightRanges.length > 0
                              ? highlightText(exercise.name, highlightRanges)
                              : exercise.name
                          }}
                        />
                      </h3>

                      <div className="flex items-center gap-2 text-caption text-ink-subtle">
                        <span className="truncate">{exercise.muscleGroup}</span>
                        <span>•</span>
                        <span className="truncate">{exercise.equipment}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-1 rounded text-caption font-medium border ${getDifficultyColor(exercise.difficulty)}`}>
                          {exercise.difficulty}
                        </span>

                        {!exercise.videoLinks.length && (
                          <IconButton
                            variant="primary"
                            size="sm"
                            onClick={() => handleSelectExercise(exercise)}
                            aria-label={`Add ${exercise.name}`}
                            className="h-7 w-7"
                          >
                            <Plus className="w-3 h-3" />
                          </IconButton>
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
        <div className="flex-shrink-0 bg-surface-raised border-t border-border p-3">
          <p className="text-caption text-ink-subtle text-center">
            Tap exercises to add them to your workout
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};
