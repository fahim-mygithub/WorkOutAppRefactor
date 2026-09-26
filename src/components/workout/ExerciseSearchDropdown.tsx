import React, { useRef, useEffect } from 'react';
import { Exercise } from '../../types/exercise';
import { SearchMatch, highlightText } from '../../utils/searchUtils';
import { Plus } from 'lucide-react';
import { ExerciseHueDot } from '../ExerciseThumbnail';
import { cn } from '../../lib/utils';

interface ExerciseSearchDropdownProps {
  searchResults: SearchMatch[];
  isSearching?: boolean;
  onSelectExercise: (exercise: Exercise) => void;
  onClose: () => void;
  position?: 'top' | 'bottom';
  maxHeight?: string;
  className?: string;
  searchStats?: {
    totalMatches: number;
    searchTime: number;
    cacheHit: boolean;
  };
}

export const ExerciseSearchDropdown: React.FC<ExerciseSearchDropdownProps> = ({
  searchResults = [],
  isSearching = false,
  onSelectExercise,
  onClose,
  position = 'bottom',
  maxHeight = '300px',
  className = '',
  // searchStats is accepted for API compatibility; timing is dev detail, not UI.
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!searchResults || (searchResults.length === 0 && !isSearching)) return null;

  const positionClasses = position === 'top'
    ? 'bottom-full mb-2'
    : 'top-full mt-2';

  // Only the first eight rows fit comfortably; the rest are a scroll away.
  const hiddenCount = searchResults.length > 8 ? searchResults.length - 8 : 0;

  return (
    <div
      ref={dropdownRef}
      style={{ maxHeight }}
      className={cn(
        'absolute left-0 right-0 z-[100] overflow-y-auto rounded-2xl bg-surface-subtle shadow-e3',
        positionClasses,
        className,
      )}
    >
      {/* Status line */}
      <p className="sticky top-0 z-10 bg-surface-subtle px-4 pb-1 pt-3 text-body-sm text-ink-muted" aria-live="polite">
        {isSearching
          ? 'Searching'
          : `${searchResults.length} ${searchResults.length === 1 ? 'match' : 'matches'}`}
        {hiddenCount > 0 && !isSearching && <span className="text-ink-subtle">, scroll for more</span>}
      </p>

      {isSearching && searchResults.length === 0 && (
        <p className="px-4 py-6 text-center text-body-sm text-ink-muted">Searching exercises</p>
      )}

      {searchResults.length > 0 && (
        <ul className="pb-1">
          {searchResults.map((result, index) => {
            const { exercise, highlightRanges } = result;
            return (
              <li key={exercise.id} className={index > 0 ? 'border-t border-hairline' : undefined}>
                <button
                  type="button"
                  onClick={() => onSelectExercise(exercise)}
                  className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-snap hover:bg-surface-raised/60 focus-visible:bg-surface-raised/60 focus-visible:outline-none"
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
                  <Plus size={18} aria-hidden="true" className="shrink-0 text-ink-subtle" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!isSearching && searchResults.length === 0 && (
        <div className="px-4 py-6 text-center">
          <p className="text-body-sm text-ink">No exercises found</p>
          <p className="mt-1 text-body-sm text-ink-muted">
            Try shorthand like "ohp" for overhead press or "bp" for bench press.
          </p>
        </div>
      )}
    </div>
  );
};
