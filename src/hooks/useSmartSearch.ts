import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Exercise } from '../types/exercise';
import { smartExerciseSearch, SearchMatch, SearchOptions } from '../utils/searchUtils';

interface UseSmartSearchOptions extends SearchOptions {
  debounceMs?: number;
  enableCaching?: boolean;
  cacheSize?: number;
}

interface UseSmartSearchResult {
  results: SearchMatch[];
  isSearching: boolean;
  hasResults: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;
  searchStats: {
    totalMatches: number;
    searchTime: number;
    cacheHit: boolean;
  };
}

// Simple LRU cache implementation
class SearchCache {
  private cache = new Map<string, { results: SearchMatch[]; timestamp: number }>();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  get(key: string): SearchMatch[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.results;
  }

  set(key: string, results: SearchMatch[]): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      results,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export function useSmartSearch(
  exercises: Exercise[],
  options: UseSmartSearchOptions = {}
): UseSmartSearchResult {
  const {
    debounceMs = 150,
    enableCaching = true,
    cacheSize = 100,
    maxResults = 15,
    minScore = 50,
    fuzzyTolerance = 2,
    enableAbbreviations = true,
    enableSynonyms = true,
  } = options;

  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStats, setSearchStats] = useState({
    totalMatches: 0,
    searchTime: 0,
    cacheHit: false,
  });

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchCacheRef = useRef<SearchCache | null>(null);
  const lastSearchQueryRef = useRef<string>('');

  // Initialize cache
  useEffect(() => {
    if (enableCaching && !searchCacheRef.current) {
      searchCacheRef.current = new SearchCache(cacheSize);
    }
  }, [enableCaching, cacheSize]);

  // Memoize search options
  const searchOptions = useMemo(() => ({
    maxResults,
    minScore,
    fuzzyTolerance,
    enableAbbreviations,
    enableSynonyms,
  }), [maxResults, minScore, fuzzyTolerance, enableAbbreviations, enableSynonyms]);

  // Perform the actual search
  const performSearch = useCallback((query: string): SearchMatch[] => {
    if (!query.trim() || exercises.length === 0) {
      return [];
    }

    const startTime = performance.now();

    // Check cache first
    const cacheKey = `${query.toLowerCase()}-${JSON.stringify(searchOptions)}`;
    if (enableCaching && searchCacheRef.current) {
      const cachedResults = searchCacheRef.current.get(cacheKey);
      if (cachedResults) {
        const searchTime = performance.now() - startTime;
        setSearchStats({
          totalMatches: cachedResults.length,
          searchTime,
          cacheHit: true,
        });
        return cachedResults;
      }
    }

    // Perform search
    const searchResults = smartExerciseSearch(exercises, query, searchOptions);

    // Cache results
    if (enableCaching && searchCacheRef.current) {
      searchCacheRef.current.set(cacheKey, searchResults);
    }

    const searchTime = performance.now() - startTime;
    setSearchStats({
      totalMatches: searchResults.length,
      searchTime,
      cacheHit: false,
    });

    return searchResults;
  }, [exercises, searchOptions, enableCaching]);

  // Debounced search effect
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (searchQuery !== lastSearchQueryRef.current) {
      lastSearchQueryRef.current = searchQuery;

      if (!searchQuery.trim()) {
        setResults([]);
        setIsSearching(false);
        setSearchStats({ totalMatches: 0, searchTime: 0, cacheHit: false });
        return;
      }

      setIsSearching(true);

      debounceTimeoutRef.current = setTimeout(() => {
        try {
          const searchResults = performSearch(searchQuery);
          setResults(searchResults);
        } catch (error) {
          console.error('Search error:', error);
          setResults([]);
        } finally {
          setIsSearching(false);
        }
      }, debounceMs);
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchQuery, debounceMs, performSearch]);

  // Clear search function
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setResults([]);
    setIsSearching(false);
    setSearchStats({ totalMatches: 0, searchTime: 0, cacheHit: false });
    lastSearchQueryRef.current = '';

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    results,
    isSearching,
    hasResults: results.length > 0,
    searchQuery,
    setSearchQuery,
    clearSearch,
    searchStats,
  };
}

/**
 * Hook for instant search without debouncing (useful for filtering already loaded data)
 */
export function useInstantSearch(
  exercises: Exercise[],
  query: string,
  options: SearchOptions = {}
): SearchMatch[] {
  return useMemo(() => {
    if (!query.trim() || exercises.length === 0) {
      return [];
    }
    return smartExerciseSearch(exercises, query, options);
  }, [exercises, query, options]);
}

/**
 * Hook for search suggestions based on partial input
 */
export function useSearchSuggestions(
  exercises: Exercise[],
  query: string,
  options: SearchOptions = {}
): string[] {
  return useMemo(() => {
    if (!query.trim() || query.length < 2) {
      return [];
    }

    const suggestions = new Set<string>();
    const queryLower = query.toLowerCase();

    exercises.forEach(exercise => {
      const words = exercise.name.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.startsWith(queryLower) && word !== queryLower) {
          suggestions.add(word);
        }
      });

      // Add full exercise name if it starts with query
      if (exercise.name.toLowerCase().startsWith(queryLower)) {
        suggestions.add(exercise.name);
      }
    });

    return Array.from(suggestions)
      .sort((a, b) => a.length - b.length) // Shorter suggestions first
      .slice(0, 5); // Limit to 5 suggestions
  }, [exercises, query]);
}