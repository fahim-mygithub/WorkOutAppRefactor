import React, { useState, useRef, useEffect } from 'react';
import { Play, Dumbbell } from 'lucide-react';
import { Exercise } from '../types/exercise';
import { getVideoWithFallbacks } from '../utils/videoHelpers';
import { MUSCLE_GROUP_META, type MuscleGroup } from './home/muscleGroup';
import { cn } from '../lib/utils';

// Catalog `muscleGroup` is a comma-joined list mixing muscles and equipment
// ("Barbell, Glutes, Quads"). The first token that names a muscle decides the
// exercise's hue; equipment tokens are skipped. Checked in order.
const MUSCLE_HUES: Array<[RegExp, MuscleGroup]> = [
  [/chest|shoulder|deltoid|tricep/i, 'push'],
  [/bicep|lat|trap|lower back|forearm|wrist|neck/i, 'pull'],
  [/glute|quad|hamstring|calve|calf|gastrocnemius|soleus|tibialis|groin|femoris|feet/i, 'legs'],
  [/abdominal|oblique|\babs\b|core/i, 'core'],
  [/cardio/i, 'cardio'],
  [/yoga|stretch|mobility/i, 'mobility'],
];

/** Resolve an exercise's `muscleGroup` string to one of the 7 muscle hues. */
export function exerciseHue(muscleGroup: string): MuscleGroup {
  for (const token of muscleGroup.split(',')) {
    const hit = MUSCLE_HUES.find(([re]) => re.test(token));
    if (hit) return hit[1];
  }
  return 'full-body';
}

/**
 * The Tempo exercise marker for list rows: a small muscle-hue dot. Decorative
 * (the row's text already names the muscles), so it is hidden from AT.
 */
export function ExerciseHueDot({ muscleGroup, className }: { muscleGroup: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'h-2.5 w-2.5 shrink-0 rounded-full',
        MUSCLE_GROUP_META[exerciseHue(muscleGroup)].bgClass,
        className,
      )}
    />
  );
}

interface ExerciseThumbnailProps {
  exercise: Exercise;
  className?: string;
  showPlayButton?: boolean;
  onClick?: () => void;
  lazy?: boolean;
}

/**
 * Video still for an exercise, lazy-loaded when it scrolls near view. Tempo:
 * a rounded raised tile; while loading or without a clip it shows a quiet
 * dumbbell glyph rather than a spinner.
 */
export const ExerciseThumbnail: React.FC<ExerciseThumbnailProps> = ({
  exercise,
  className = '',
  showPlayButton = true,
  onClick,
  lazy = true,
}) => {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isIntersecting, setIsIntersecting] = useState(!lazy);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || isIntersecting) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px', // Load images 50px before they come into view
        threshold: 0.1,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [lazy, isIntersecting]);

  const handleVideoLoad = () => {
    setVideoLoaded(true);
    setVideoError(false);
  };

  const handleVideoError = () => {
    setVideoError(true);
    setVideoLoaded(false);
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  // Get the primary video URL for thumbnail
  const primaryVideoUrl = exercise.videoLinks.length > 0
    ? getVideoWithFallbacks(exercise.videoLinks[0], []).primary
    : '';

  const showVideo = isIntersecting && primaryVideoUrl && !videoError;

  return (
    <div
      ref={containerRef}
      className={cn(
        'group relative aspect-video cursor-pointer overflow-hidden rounded-2xl bg-surface-raised',
        className,
      )}
      onClick={handleClick}
    >
      {showVideo && (
        <video
          ref={videoRef}
          src={primaryVideoUrl}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-smooth',
            videoLoaded ? 'opacity-100' : 'opacity-0',
          )}
          onLoadedData={handleVideoLoad}
          onError={handleVideoError}
          muted
          playsInline
          preload="metadata"
          disablePictureInPicture
          controlsList="nodownload nofullscreen"
        />
      )}

      {/* Placeholder while lazy, loading, or when there is no clip. */}
      {!(showVideo && videoLoaded) && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-raised">
          <Dumbbell className="h-7 w-7 text-ink-subtle" aria-hidden="true" />
        </div>
      )}

      {showPlayButton && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface/80 text-ink transition-transform duration-snap group-hover:scale-105">
            <Play className="ml-0.5 h-5 w-5" fill="currentColor" aria-hidden="true" />
          </span>
        </div>
      )}
    </div>
  );
};
