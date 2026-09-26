import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronRight, Search, X } from 'lucide-react';
import { Exercise } from '../../types/exercise';
import { useParseValidation } from '../../hooks/useParseValidation';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../ui/sheet';
import { IconButton } from '../ui/icon-button';
import { ExerciseHueDot } from '../ExerciseThumbnail';
import { cn } from '../../lib/utils';

interface ExerciseSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  originalExerciseName: string;
  exerciseDatabase: Exercise[];
  title?: string;
}

export const ExerciseSelectionModal: React.FC<ExerciseSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  originalExerciseName,
  exerciseDatabase,
  title = 'Select exercise'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Use fuzzy matching to get suggestions
  const { applyCorrection } = useParseValidation(exerciseDatabase, 100);
  const [suggestions, setSuggestions] = useState<Exercise[]>([]);

  // Initialize search with original exercise name and get suggestions
  useEffect(() => {
    if (isOpen) {
      setSearchTerm(originalExerciseName);
      setSelectedIndex(0);

      // Get fuzzy matches for the original exercise name
      const fuzzyMatches = exerciseDatabase
        .map(exercise => {
          const similarity = calculateSimilarity(originalExerciseName.toLowerCase(), exercise.name.toLowerCase());
          return { exercise, similarity };
        })
        .filter(({ similarity }) => similarity > 0.3)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 10)
        .map(({ exercise }) => exercise);

      setSuggestions(fuzzyMatches);

      // Focus search input
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 100);
    }
  }, [isOpen, originalExerciseName, exerciseDatabase]);

  // Filter exercises based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSuggestions([]);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = exerciseDatabase
      .filter(exercise =>
        exercise.name.toLowerCase().includes(term) ||
        exercise.muscleGroup.toLowerCase().includes(term) ||
        exercise.equipment.toLowerCase().includes(term) ||
        exercise.searchKeywords.some(keyword => keyword.includes(term))
      )
      .slice(0, 10);

    setSuggestions(filtered);
    setSelectedIndex(0);
  }, [searchTerm, exerciseDatabase]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!suggestions.length) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          onSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [suggestions, selectedIndex, onSelect, onClose]);

  // Calculate similarity (simple implementation)
  const calculateSimilarity = (str1: string, str2: string): number => {
    if (str1 === str2) return 1;
    if (str1.includes(str2) || str2.includes(str1)) return 0.8;

    // Simple Levenshtein-based similarity
    const distance = levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return (maxLength - distance) / maxLength;
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[j][i] = matrix[j - 1][i - 1];
        } else {
          matrix[j][i] = Math.min(
            matrix[j - 1][i - 1] + 1,
            matrix[j][i - 1] + 1,
            matrix[j - 1][i] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        className="mx-auto flex max-h-[85vh] max-w-2xl flex-col pb-0"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <SheetTitle className="text-title">{title}</SheetTitle>
            <SheetDescription className="truncate">
              Replacing {originalExerciseName}
            </SheetDescription>
          </div>
          <IconButton variant="ghost" onClick={onClose} aria-label="Close">
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
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Name, muscle, or equipment"
            aria-label="Search exercises"
            className="h-touch-lg w-full rounded-full bg-surface-raised pl-11 pr-4 text-body text-ink placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>

        {/* Results */}
        <div className="-mx-6 mt-3 flex-1 overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {suggestions.length > 0 ? (
            <ul>
              {suggestions.map((exercise, index) => (
                <li key={exercise.id} className={index > 0 ? 'border-t border-hairline' : undefined}>
                  <button
                    type="button"
                    onClick={() => onSelect(exercise)}
                    className={cn(
                      'flex min-h-[64px] w-full items-center gap-4 px-6 py-3 text-left transition-colors duration-snap hover:bg-surface-raised/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
                      index === selectedIndex && 'bg-surface-raised/60',
                    )}
                  >
                    <ExerciseHueDot muscleGroup={exercise.muscleGroup} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-semibold text-ink">
                        {exercise.name}
                      </span>
                      <span className="mt-0.5 block truncate text-body-sm text-ink-muted">
                        {exercise.muscleGroup}
                        {exercise.equipment ? ` · ${exercise.equipment}` : ''}
                      </span>
                    </span>
                    <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-ink-subtle" />
                  </button>
                </li>
              ))}
            </ul>
          ) : searchTerm ? (
            <div className="px-6 py-10 text-center">
              <p className="text-body text-ink">No exercises match "{searchTerm}"</p>
              <p className="mt-1 text-body-sm text-ink-muted">Try a shorter name or a muscle, like "chest".</p>
            </div>
          ) : (
            <p className="px-6 py-10 text-center text-body-sm text-ink-muted">
              Start typing to search exercises.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
