import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ParseIssue } from '../../parser/workoutParser';

interface HighlightedTextareaProps {
  id?: string;
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
    id,
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
        let highlightClass = 'bg-danger/20 border-b-2 border-danger'; // Low confidence
        if (confidence >= 90) {
          highlightClass = 'bg-accent-2/20 border-b-2 border-accent-2'; // High confidence
        } else if (confidence >= 70) {
          highlightClass = 'bg-warning/20 border-b-2 border-warning'; // Medium confidence
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
      '<span class="text-accent font-semibold">$1</span><span class="text-accent/80">×</span><span class="text-muscle-pull font-semibold">$2</span>'
    );

    // Highlight weights (e.g., @185lbs, @80kg)
    highlighted = highlighted.replace(
      /@\s*(\d+(?:\.\d+)?)\s*(lbs?|kg)?/gi,
      '<span class="text-muscle-core">@</span><span class="text-muscle-core font-semibold">$1</span><span class="text-muscle-core">$2</span>'
    );

    // Highlight superset notation (ss, superset)
    highlighted = highlighted.replace(
      /\b(ss|superset)\b/gi,
      '<span class="text-muscle-cardio font-bold bg-muscle-cardio/20 rounded">$1</span>'
    );

    // Highlight rest times (e.g., rest 90s, rest 2min)
    highlighted = highlighted.replace(
      /\b(rest)\s+(\d+)\s*(s|sec|seconds?|min|minutes?)\b/gi,
      '<span class="text-success">$1</span> <span class="text-success font-semibold">$2</span><span class="text-success">$3</span>'
    );

    // Highlight tempo notation (e.g., tempo 3-1-2-0)
    highlighted = highlighted.replace(
      /\b(tempo)\s+(\d+-\d+-\d+-\d+)\b/gi,
      '<span class="text-warning">$1</span> <span class="text-warning font-semibold">$2</span>'
    );

    // Highlight RPE (e.g., RPE 8, @RPE9)
    highlighted = highlighted.replace(
      /(@?\s*RPE)\s*(\d+(?:\.\d+)?)/gi,
      '<span class="text-danger">$1</span> <span class="text-danger font-semibold">$2</span>'
    );

    // Highlight percentage notation (e.g., 85%, @85%)
    highlighted = highlighted.replace(
      /(@?\s*)(\d+)(%)/gi,
      '<span class="text-muscle-mobility">$1</span><span class="text-muscle-mobility font-semibold">$2</span><span class="text-muscle-mobility">$3</span>'
    );

    // Highlight notes/comments (lines starting with # or //)
    highlighted = highlighted.replace(
      /^\s*(#|\/\/)(.*)$/gm,
      '<span class="text-ink-subtle italic">$1$2</span>'
    );

    // Highlight exercise names (basic pattern - words that are likely exercise names)
    // This is a simple heuristic and could be improved with a exercise name database
    highlighted = highlighted.replace(
      /\b([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+){1,4})(?=\s*\d+[x×\*]|$)/g,
      '<span class="text-muscle-legs font-medium">$1</span>'
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

  // The highlight layer and the textarea must lay text out identically, so both
  // share one padding/wrapping class string (plus the caller's typography). The
  // wrapper owns the Tempo surface: raised fill, rounded-xl, amber focus ring.
  const layerClass = `w-full px-4 py-3 whitespace-pre-wrap break-words ${className}`;

  return (
    <div className="relative rounded-xl bg-surface-raised transition-shadow duration-snap focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-surface-subtle">
      {/* Highlight layer */}
      <div
        ref={highlightRef}
        aria-hidden="true"
        className={`absolute inset-0 pointer-events-none overflow-hidden ${layerClass}`}
        style={{
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
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={onClick}
        onKeyUp={onKeyUp}
        onKeyDown={onKeyDown}
        onScroll={handleScroll}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={`relative block resize-y rounded-xl border-0 bg-transparent text-ink placeholder:text-ink-subtle focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${layerClass}`}
        style={{
          zIndex: 2,
        }}
      />
    </div>
  );
});

HighlightedTextarea.displayName = 'HighlightedTextarea';