import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ParseIssue } from '../../parser/workoutParser';

interface HighlightedTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onClick?: () => void;
  onKeyUp?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  parseIssues?: ParseIssue[];
  disabled?: boolean;
  highlightText?: { start: number; end: number; active: boolean };
}

export const HighlightedTextarea = React.forwardRef<HTMLTextAreaElement, HighlightedTextareaProps>((
  {
    value,
    onChange,
    onClick,
    onKeyUp,
    onKeyDown,
    placeholder,
    rows = 12,
    className = '',
    parseIssues = [],
    disabled = false,
    highlightText,
  },
  ref
) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Create highlighted version of the text with syntax highlighting
  const createHighlightedText = useCallback(() => {
    let highlightedText = value;

    // Apply new text highlight first if active
    if (highlightText?.active && highlightText.start !== highlightText.end) {
      const before = value.substring(0, highlightText.start);
      const highlighted = value.substring(highlightText.start, highlightText.end);
      const after = value.substring(highlightText.end);

      highlightedText = before +
        `<span class="text-highlight">${highlighted}</span>` +
        after;
    }

    // Apply syntax highlighting
    highlightedText = applySyntaxHighlighting(highlightedText);

    // Then apply parse issue highlights if any
    if (parseIssues.length > 0) {
      // Sort issues by position (descending) to avoid position shifts during replacement
      const sortedIssues = [...parseIssues].sort((a, b) => {
        const aIndex = value.toLowerCase().indexOf(a.exerciseName.toLowerCase());
        const bIndex = value.toLowerCase().indexOf(b.exerciseName.toLowerCase());
        return bIndex - aIndex;
      });

      // Apply highlights
      for (const issue of sortedIssues) {
        const exerciseName = issue.exerciseName;
        const confidence = issue.suggestions[0]?.confidence || 0;

        // Determine highlight color based on confidence
        let highlightClass = 'bg-red-900/40 border-b-2 border-red-400'; // Low confidence
        if (confidence >= 90) {
          highlightClass = 'bg-green-900/40 border-b-2 border-green-400'; // High confidence
        } else if (confidence >= 70) {
          highlightClass = 'bg-yellow-900/40 border-b-2 border-yellow-400'; // Medium confidence
        }

        // Use case-insensitive replacement but preserve original case
        // Remove existing spans first to avoid nested spans
        const cleanExerciseName = exerciseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?<!<[^>]*>)\\b${cleanExerciseName}\\b(?![^<]*>)`, 'gi');

        highlightedText = highlightedText.replace(regex, (match) => {
          return `<span class="${highlightClass}" title="Suggestion: ${issue.suggestions[0]?.exercise.name || 'No suggestions'}">${match}</span>`;
        });
      }
    }

    return highlightedText.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
  }, [value, parseIssues, highlightText]);

  // Apply syntax highlighting to workout text
  const applySyntaxHighlighting = useCallback((text: string) => {
    let highlighted = text;

    // Highlight sets and reps (e.g., 3x10, 5x5, 4x8-12)
    highlighted = highlighted.replace(
      /(\d+)\s*[x×\*]\s*(\d+(?:-\d+)?)/gi,
      '<span class="text-blue-400 font-semibold">$1</span><span class="text-blue-300">×</span><span class="text-cyan-400 font-semibold">$2</span>'
    );

    // Highlight weights (e.g., @185lbs, @80kg)
    highlighted = highlighted.replace(
      /@\s*(\d+(?:\.\d+)?)\s*(lbs?|kg)?/gi,
      '<span class="text-purple-400">@</span><span class="text-purple-300 font-semibold">$1</span><span class="text-purple-400">$2</span>'
    );

    // Highlight superset notation (ss, superset)
    highlighted = highlighted.replace(
      /\b(ss|superset)\b/gi,
      '<span class="text-orange-400 font-bold bg-orange-900/30 px-1 rounded">$1</span>'
    );

    // Highlight rest times (e.g., rest 90s, rest 2min)
    highlighted = highlighted.replace(
      /\b(rest)\s+(\d+)\s*(s|sec|seconds?|min|minutes?)\b/gi,
      '<span class="text-green-400">$1</span> <span class="text-green-300 font-semibold">$2</span><span class="text-green-400">$3</span>'
    );

    // Highlight tempo notation (e.g., tempo 3-1-2-0)
    highlighted = highlighted.replace(
      /\b(tempo)\s+(\d+-\d+-\d+-\d+)\b/gi,
      '<span class="text-yellow-400">$1</span> <span class="text-yellow-300 font-semibold">$2</span>'
    );

    // Highlight RPE (e.g., RPE 8, @RPE9)
    highlighted = highlighted.replace(
      /(@?\s*RPE)\s*(\d+(?:\.\d+)?)/gi,
      '<span class="text-red-400">$1</span> <span class="text-red-300 font-semibold">$2</span>'
    );

    // Highlight percentage notation (e.g., 85%, @85%)
    highlighted = highlighted.replace(
      /(@?\s*)(\d+)(%)/gi,
      '<span class="text-indigo-400">$1</span><span class="text-indigo-300 font-semibold">$2</span><span class="text-indigo-400">$3</span>'
    );

    // Highlight notes/comments (lines starting with # or //)
    highlighted = highlighted.replace(
      /^\s*(#|\/\/)(.*)$/gm,
      '<span class="text-gray-500 italic">$1$2</span>'
    );

    // Highlight exercise names (basic pattern - words that are likely exercise names)
    // This is a simple heuristic and could be improved with a exercise name database
    highlighted = highlighted.replace(
      /\b([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+){1,4})(?=\s*\d+[x×\*]|$)/g,
      '<span class="text-emerald-300 font-medium">$1</span>'
    );

    return highlighted;
  }, []);

  // Sync scroll between textarea and highlight layer
  const handleScroll = useCallback(() => {
    if (textareaRef.current) {
      const newScrollTop = textareaRef.current.scrollTop;
      const newScrollLeft = textareaRef.current.scrollLeft;
      setScrollTop(newScrollTop);
      setScrollLeft(newScrollLeft);
    }
  }, []);

  // Update highlight layer scroll when scroll state changes
  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = scrollTop;
      highlightRef.current.scrollLeft = scrollLeft;
    }
  }, [scrollTop, scrollLeft]);

  return (
    <div className="relative">
      {/* Highlight layer */}
      <div
        ref={highlightRef}
        className={`absolute inset-0 pointer-events-none overflow-hidden whitespace-pre-wrap break-words ${className}`}
        style={{
          fontSize: 'inherit',
          fontFamily: 'inherit',
          lineHeight: 'inherit',
          padding: '12px', // Match textarea padding
          border: '1px solid transparent', // Match textarea border
          color: 'transparent',
          zIndex: 1,
        }}
        dangerouslySetInnerHTML={{
          __html: createHighlightedText()
        }}
      />
      
      {/* Actual textarea */}
      <textarea
        ref={(el) => {
          textareaRef.current = el;
          if (typeof ref === 'function') {
            ref(el);
          } else if (ref) {
            ref.current = el;
          }
        }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={onClick}
        onKeyUp={onKeyUp}
        onKeyDown={onKeyDown}
        onScroll={handleScroll}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={`relative bg-transparent resize-y ${className}`}
        style={{
          zIndex: 2,
        }}
      />
    </div>
  );
});

HighlightedTextarea.displayName = 'HighlightedTextarea';