import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Exercise } from '../../types/exercise';
import { useParseValidation } from '../../hooks/useParseValidation';

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
  title = 'Select Exercise'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  
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

  // Handle clicking outside modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        ref={modalRef}
        className="bg-gray-800 border border-gray-600 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="text-sm text-gray-400 mt-1">
              Replace "{originalExerciseName}" with:
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 p-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Input */}
        <div className="p-6 border-b border-gray-700">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search exercises by name, muscle group, or equipment..."
              className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto">
          {suggestions.length > 0 ? (
            <div className="p-2">
              {suggestions.map((exercise, index) => (
                <button
                  key={exercise.id}
                  onClick={() => onSelect(exercise)}
                  className={`w-full text-left p-4 rounded-lg transition-colors ${
                    index === selectedIndex
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">
                        {exercise.name}
                      </h3>
                      <div className="flex items-center gap-4 mt-1 text-sm opacity-75">
                        <span>{exercise.muscleGroup}</span>
                        <span>•</span>
                        <span>{exercise.equipment}</span>
                      </div>
                      {exercise.instructions.length > 0 && (
                        <p className="text-xs mt-2 opacity-60 line-clamp-2">
                          {exercise.instructions[0]}
                        </p>
                      )}
                    </div>
                    
                    {index === selectedIndex && (
                      <div className="ml-3 flex items-center">
                        <kbd className="px-2 py-1 text-xs bg-gray-800 rounded border border-gray-600">
                          Enter
                        </kbd>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : searchTerm ? (
            <div className="p-8 text-center text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No exercises found matching "{searchTerm}"</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400">
              <p>Start typing to search exercises</p>
            </div>
          )}
        </div>

        {/* Footer with keyboard shortcuts */}
        <div className="border-t border-gray-700 p-4">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>
                <kbd className="px-1.5 py-0.5 bg-gray-700 rounded border border-gray-600">↑↓</kbd> Navigate
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-gray-700 rounded border border-gray-600">Enter</kbd> Select
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-gray-700 rounded border border-gray-600">Esc</kbd> Cancel
              </span>
            </div>
            <span>{suggestions.length} results</span>
          </div>
        </div>
      </div>
    </div>
  );
};