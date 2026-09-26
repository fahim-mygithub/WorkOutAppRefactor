import React from 'react';
import { ExternalLink, RotateCcw, VideoOff } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface VideoFallbackProps {
  exerciseName: string;
  instructions?: string[];
  errorMessage?: string;
  retryCount?: number;
  compact?: boolean;
  className?: string;
  onRetry?: () => void;
  onSearchYouTube?: () => void;
}

/**
 * Shown in place of an exercise clip that won't load (Tempo): a quiet raised
 * tile that says what happened, offers a retry when another source exists, and
 * a way to watch elsewhere. The steps stay one tap away.
 */
export const VideoFallback: React.FC<VideoFallbackProps> = ({
  exerciseName,
  instructions = [],
  errorMessage,
  retryCount = 0,
  compact = false,
  className = '',
  onRetry,
  onSearchYouTube,
}) => {
  const handleSearchYouTube = () => {
    const searchQuery = encodeURIComponent(`${exerciseName} exercise tutorial`);
    const youtubeUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;
    window.open(youtubeUrl, '_blank', 'noopener,noreferrer');
    onSearchYouTube?.();
  };

  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl bg-surface-raised',
        compact ? 'min-h-32 p-3' : 'min-h-64 p-5',
        className,
      )}
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <VideoOff
          aria-hidden="true"
          className={cn('text-ink-subtle', compact ? 'mb-1 h-5 w-5' : 'mb-3 h-7 w-7')}
        />
        <p className={cn('font-semibold text-ink', compact ? 'text-body-sm' : 'text-body')}>
          Video unavailable
        </p>
        {errorMessage && (
          <p className={cn('mt-1 max-w-[34ch] text-ink-muted', compact ? 'text-caption' : 'text-body-sm')}>
            {errorMessage}
          </p>
        )}
        {retryCount > 0 && !compact && (
          <p className="mt-1 text-caption text-ink-subtle">
            Tried {retryCount + 1} sources
          </p>
        )}
      </div>

      <div className={cn('flex flex-wrap justify-center gap-2', compact ? 'mt-2' : 'mt-4')}>
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry} title="Try loading the video again">
            <RotateCcw size={14} aria-hidden="true" />
            Try again
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={handleSearchYouTube} title="Search for a tutorial on YouTube">
          <ExternalLink size={14} aria-hidden="true" />
          Watch on YouTube
        </Button>
      </div>

      {/* The steps, one tap away, for when there is no clip to follow */}
      {!compact && instructions.length > 0 && (
        <details className="mt-4 text-body-sm text-ink-muted">
          <summary className="flex min-h-touch-min cursor-pointer items-center justify-center rounded-full font-semibold text-ink transition-colors hover:text-accent">
            Show steps
          </summary>
          <ol className="mt-2 space-y-2">
            {instructions.slice(0, 3).map((instruction, index) => (
              <li key={index} className="flex gap-3">
                <span aria-hidden="true" className="w-4 shrink-0 text-right font-num font-tabular font-bold text-ink">
                  {index + 1}
                </span>
                <span className="min-w-0">{instruction}</span>
              </li>
            ))}
            {instructions.length > 3 && (
              <li className="pl-7 text-ink-subtle">
                {instructions.length - 3} more {instructions.length - 3 === 1 ? 'step' : 'steps'} in the exercise details
              </li>
            )}
          </ol>
        </details>
      )}
    </div>
  );
};
