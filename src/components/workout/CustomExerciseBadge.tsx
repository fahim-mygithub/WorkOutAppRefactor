import React from 'react';
import { PenLine } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CustomExerciseBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
  showText?: boolean;
}

/**
 * Marks a user-made exercise (Tempo): a small raised pill in ice, the
 * informational accent. Icon-only when `showText` is false, with the word
 * kept for screen readers.
 */
export const CustomExerciseBadge: React.FC<CustomExerciseBadgeProps> = ({
  className = '',
  size = 'sm',
  showText = true
}) => {
  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-surface-raised font-semibold text-accent-2',
        size === 'sm' ? 'px-2 py-0.5 text-caption' : 'px-2.5 py-1 text-body-sm',
        !showText && 'px-1.5',
        className,
      )}
    >
      <PenLine size={iconSize} aria-hidden="true" />
      {showText ? <span>Custom</span> : <span className="sr-only">Custom</span>}
    </span>
  );
};
