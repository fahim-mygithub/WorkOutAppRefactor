import { useState, useCallback, useRef } from 'react';

interface UndoRedoState<T> {
  history: T[];
  currentIndex: number;
}

interface UndoRedoActions<T> {
  value: T;
  setValue: (value: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (initialValue: T) => void;
  clearHistory: () => void;
}

export function useUndoRedo<T>(
  initialValue: T,
  maxHistorySize: number = 50
): UndoRedoActions<T> {
  const [state, setState] = useState<UndoRedoState<T>>({
    history: [initialValue],
    currentIndex: 0,
  });

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastValueRef = useRef<T>(initialValue);

  const setValue = useCallback((newValue: T) => {
    // Don't add to history if value hasn't changed
    if (JSON.stringify(newValue) === JSON.stringify(lastValueRef.current)) {
      return;
    }

    lastValueRef.current = newValue;

    // Clear any pending debounced update
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Debounce history updates to avoid cluttering with every keystroke
    debounceTimeoutRef.current = setTimeout(() => {
      setState(prevState => {
        const newHistory = prevState.history.slice(0, prevState.currentIndex + 1);
        newHistory.push(newValue);

        // Limit history size
        if (newHistory.length > maxHistorySize) {
          newHistory.shift();
        }

        return {
          history: newHistory,
          currentIndex: newHistory.length - 1,
        };
      });
    }, 500); // 500ms debounce

    // Update current value immediately for responsive UI
    setState(prevState => ({
      ...prevState,
      history: [...prevState.history.slice(0, prevState.currentIndex + 1), newValue],
      currentIndex: prevState.currentIndex + 1,
    }));
  }, [maxHistorySize]);

  const undo = useCallback(() => {
    setState(prevState => {
      if (prevState.currentIndex > 0) {
        const newIndex = prevState.currentIndex - 1;
        lastValueRef.current = prevState.history[newIndex];
        return {
          ...prevState,
          currentIndex: newIndex,
        };
      }
      return prevState;
    });
  }, []);

  const redo = useCallback(() => {
    setState(prevState => {
      if (prevState.currentIndex < prevState.history.length - 1) {
        const newIndex = prevState.currentIndex + 1;
        lastValueRef.current = prevState.history[newIndex];
        return {
          ...prevState,
          currentIndex: newIndex,
        };
      }
      return prevState;
    });
  }, []);

  const reset = useCallback((newInitialValue: T) => {
    lastValueRef.current = newInitialValue;
    setState({
      history: [newInitialValue],
      currentIndex: 0,
    });
  }, []);

  const clearHistory = useCallback(() => {
    setState(prevState => ({
      history: [prevState.history[prevState.currentIndex]],
      currentIndex: 0,
    }));
  }, []);

  const currentValue = state.history[state.currentIndex] || initialValue;
  const canUndo = state.currentIndex > 0;
  const canRedo = state.currentIndex < state.history.length - 1;

  return {
    value: currentValue,
    setValue,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    clearHistory,
  };
}