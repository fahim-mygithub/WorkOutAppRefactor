import React, { useRef, useEffect } from 'react';
import { Exercise } from '../../types/exercise';
import { SearchMatch, highlightText } from '../../utils/searchUtils';

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
  searchStats,
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

  const getMatchTypeLabel = (matchType: string): string => {
    switch (matchType) {
      case 'exact': return 'Exact match';
      case 'name-prefix': return 'Name starts with';
      case 'word-exact': return 'Word match';
      case 'word-prefix': return 'Word starts with';
      case 'word-contains': return 'Contains';
      case 'fuzzy': return 'Similar';
      case 'muscle-exact': return 'Muscle group';
      case 'equipment-exact': return 'Equipment';
      case 'synonym': return 'Synonym';
      default: return 'Match';
    }
  };

  const getMatchTypeColor = (matchType: string): string => {
    switch (matchType) {
      case 'exact':
      case 'name-prefix':
        return 'text-green-400';
      case 'word-exact':
      case 'word-prefix':
        return 'text-blue-400';
      case 'word-contains':
        return 'text-cyan-400';
      case 'fuzzy':
        return 'text-yellow-400';
      case 'muscle-exact':
      case 'equipment-exact':
        return 'text-purple-400';
      case 'synonym':
        return 'text-orange-400';
      default:
        return 'text-gray-400';
    }
  };

  const positionClasses = position === 'top' 
    ? 'bottom-full mb-1' 
    : 'top-full mt-1';

  return (
    <div
      ref={dropdownRef}
      className={`absolute left-0 right-0 bg-gray-700 border-2 border-gray-600 rounded-md shadow-2xl z-[100] max-h-[300px] overflow-y-auto animate-slide-in transition-all-smooth ${positionClasses} ${className}`}
    >
      {/* Header with search stats */}
      <div className="px-3 py-2 border-b border-gray-600 bg-gray-800 sticky top-0">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-400 font-medium">
            {isSearching ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Searching...</span>
              </div>
            ) : (
              <span>
                {searchResults.length} match{searchResults.length !== 1 ? 'es' : ''} found
              </span>
            )}
          </div>
          {searchStats && searchStats.searchTime > 0 && (
            <div className="text-xs text-gray-500">
              {searchStats.searchTime.toFixed(1)}ms{searchStats.cacheHit ? ' (cached)' : ''}
            </div>
          )}
        </div>
      </div>
      
      {/* Loading state */}
      {isSearching && searchResults.length === 0 && (
        <div className="px-4 py-8 text-center text-gray-400">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <div className="text-sm">Searching exercises...</div>
        </div>
      )}

      {/* Search results */}
      {searchResults.map((result, index) => {
        const { exercise, score, matchType, highlightRanges } = result;
        return (
          <button
            key={exercise.id}
            onClick={() => onSelectExercise(exercise)}
            className="w-full px-4 py-3 text-left hover:bg-gray-600 focus:bg-gray-600 focus:outline-none transition-colors-smooth group border-b border-gray-700 last:border-b-0 hover-lift"
          >
            <div className="flex items-center gap-3">
              {/* Exercise Icon with rank indicator */}
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center relative">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {index < 3 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                {/* Exercise name with highlighting */}
                <div className="font-medium text-white group-hover:text-blue-300 transition-colors">
                  <span
                    dangerouslySetInnerHTML={{
                      __html: highlightRanges.length > 0
                        ? highlightText(exercise.name, highlightRanges)
                        : exercise.name
                    }}
                  />
                </div>

                {/* Exercise details */}
                <div className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {exercise.muscleGroup}
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                    </svg>
                    {exercise.equipment}
                  </span>
                </div>

                {/* Match info and metadata */}
                <div className="text-xs mt-1 flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded font-medium ${
                    exercise.difficulty === 'Beginner' ? 'bg-green-900 text-green-300' :
                    exercise.difficulty === 'Intermediate' ? 'bg-yellow-900 text-yellow-300' :
                    exercise.difficulty === 'Advanced' ? 'bg-red-900 text-red-300' :
                    'bg-gray-900 text-gray-300'
                  }`}>
                    {exercise.difficulty}
                  </span>

                  <span className={`px-2 py-0.5 rounded text-xs font-medium bg-gray-700 border ${getMatchTypeColor(matchType)}`}>
                    {getMatchTypeLabel(matchType)}
                  </span>

                  <span className="text-gray-500 font-mono">
                    {score}pts
                  </span>

                  {exercise.mechanic && (
                    <span className="text-gray-500">
                      {exercise.mechanic}
                    </span>
                  )}
                </div>
              </div>

              {/* Insert icon */}
              <div className="flex-shrink-0 text-gray-500 group-hover:text-green-400 transition-colors-smooth hover-scale">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>
          </button>
        );
      })}

      {/* No results message */}
      {!isSearching && searchResults.length === 0 && (
        <div className="px-4 py-6 text-center text-gray-400">
          <svg className="w-8 h-8 mx-auto mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <div className="text-sm font-medium mb-1">No exercises found</div>
          <div className="text-xs text-gray-500">
            Try "ohp" for overhead press or "bp" for bench press
          </div>
        </div>
      )}
      
      {/* Instructions at bottom */}
      {searchResults.length > 0 && (
        <div className="px-4 py-2 bg-gray-800 border-t border-gray-600 sticky bottom-0">
          <div className="text-xs text-gray-500 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span>Click to insert</span>
              <span>•</span>
              <span>ESC to close</span>
            </div>
            <div className="text-gray-600">
              {searchResults.length > 8 && `+${searchResults.length - 8} more`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};