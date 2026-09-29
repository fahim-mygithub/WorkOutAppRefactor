import React, { useState, useRef, useEffect } from 'react';
import { Dumbbell, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { VideoFallback } from './VideoFallback';
import { getVideoWithFallbacks, getFriendlyErrorMessage } from '../utils/videoHelpers';
import { useIsMobile } from '../hooks/useIsMobile';
import { cn } from '../lib/utils';

interface ExerciseVideoProps {
  videoUrl: string;
  exerciseName: string;
  autoPlay?: boolean;
  muted?: boolean;
  compact?: boolean;
  className?: string;
  fallbackVideoUrls?: string[];
  instructions?: string[];
  dualView?: boolean; // New prop for side-by-side display
}

const isValidVideoUrl = (url: string): boolean => {
  try {
    // Handle relative URLs for proxy in development
    if (url.startsWith('/api/video/') && import.meta.env.DEV) {
      return url.includes('.mp4') || url.includes('.webm') || url.includes('.ogg');
    }
    
    const urlObj = new URL(url);
    return (urlObj.protocol === 'https:' || urlObj.protocol === 'http:') && 
           (url.includes('.mp4') || url.includes('.webm') || url.includes('.ogg'));
  } catch {
    return false;
  }
};

export const ExerciseVideo: React.FC<ExerciseVideoProps> = ({
  videoUrl,
  exerciseName,
  autoPlay = false,
  muted = true,
  compact = false,
  className = '',
  fallbackVideoUrls = [],
  instructions = [],
  dualView = false
}) => {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  // Transform URLs to use proxy in development
  const { primary, fallbacks } = getVideoWithFallbacks(videoUrl, fallbackVideoUrls);
  const [currentVideoUrl, setCurrentVideoUrl] = useState(primary);
  const [retryCount, setRetryCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isMobile } = useIsMobile();

  const tryFallbackVideo = () => {
    const allUrls = [primary, ...fallbacks];
    const nextUrl = allUrls[retryCount + 1];
    
    if (nextUrl && isValidVideoUrl(nextUrl)) {
      setCurrentVideoUrl(nextUrl);
      setRetryCount(prev => prev + 1);
      setIsLoading(true);
      setHasError(false);
      setErrorMessage('');
    } else {
      setHasError(true);
      setIsLoading(false);
      setErrorMessage('None of the video sources loaded.');
    }
  };

  // Stable key so the load effect doesn't re-run every render (callers pass a
  // fresh fallback array each time).
  const fallbackKey = fallbackVideoUrls.join('|');

  // Restart from the primary source whenever the requested video changes.
  useEffect(() => {
    setCurrentVideoUrl(getVideoWithFallbacks(videoUrl).primary);
    setRetryCount(0);
    setHasError(false);
    setIsLoading(true);
    setErrorMessage('');
  }, [videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reset loading state when video URL changes
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');

    // Validate current video URL
    if (!isValidVideoUrl(currentVideoUrl)) {
      setErrorMessage('This video link is not a playable file.');
      tryFallbackVideo();
      return;
    }

    const handleLoadedData = () => {
      setIsLoading(false);
      setHasError(false);
      if (autoPlay) {
        video.play().catch((error) => {
          console.warn('Autoplay failed:', error);
          setIsPlaying(false);
        });
      }
    };

    const handleError = (event: Event) => {
      const error = (event.target as HTMLVideoElement)?.error;
      const message = getFriendlyErrorMessage(currentVideoUrl, error);
      
      setErrorMessage(message);
      console.warn(`Video failed to load (${currentVideoUrl}):`, message);
      
      // Try fallback video if available
      if (retryCount < fallbacks.length) {
        setTimeout(tryFallbackVideo, 2000);
      } else {
        setIsLoading(false);
        setHasError(true);
      }
    };

    const handleLoadStart = () => {
      setIsLoading(true);
      setHasError(false);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    // Add event listeners
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    // Set video src and load
    video.src = currentVideoUrl;
    video.load();

    return () => {
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [autoPlay, currentVideoUrl, fallbackKey, retryCount]); // retryCount drives the fallback mechanism

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(() => {
        console.warn('Failed to play video');
      });
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  if (hasError) {
    return (
      <VideoFallback
        exerciseName={exerciseName}
        instructions={instructions}
        errorMessage={errorMessage}
        retryCount={retryCount}
        compact={compact}
        className={className}
        onRetry={fallbacks.length > retryCount ? tryFallbackVideo : undefined}
      />
    );
  }

  const heightClass = compact
    ? isMobile
      ? 'aspect-video' // Use aspect-video for mobile grid
      : 'h-32'
    : 'h-64';

  // Tempo: the clip sits on a raised tile and fades in once it has a frame;
  // until then a quiet glyph holds the space (no spinner). Controls are always
  // visible small round buttons, since touch screens have no hover.
  return (
    <div className={cn('relative overflow-hidden rounded-2xl bg-surface-raised', className)}>
      <video
        ref={videoRef}
        muted={isMuted}
        loop
        playsInline
        preload={isMobile && compact ? "metadata" : "auto"}
        className={cn(
          'w-full object-cover transition-opacity duration-smooth',
          heightClass,
          isLoading ? 'opacity-0' : 'opacity-100',
        )}
        poster=""
        // Mobile optimizations
        controlsList="nodownload nofullscreen"
        disablePictureInPicture
      />

      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-raised">
          <Dumbbell className="h-7 w-7 animate-pulse text-ink-subtle" aria-hidden="true" />
          {retryCount > 0 && (
            <p className="text-caption text-ink-muted">Trying another source</p>
          )}
        </div>
      )}

      {/* Title chip */}
      {!compact && (
        <p className="absolute bottom-3 left-3 max-w-[60%] truncate rounded-full bg-surface/80 px-3 py-1 text-caption text-ink">
          {exerciseName}
        </p>
      )}

      {/* Controls — hidden on compact mobile tiles to avoid tap conflicts */}
      {!(isMobile && compact) && !isLoading && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-touch-min w-touch-min items-center justify-center rounded-full bg-surface/80 text-ink transition-colors duration-snap hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={isPlaying ? 'Pause video' : 'Play video'}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" fill="currentColor" aria-hidden="true" />
            ) : (
              <Play className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className="flex h-touch-min w-touch-min items-center justify-center rounded-full bg-surface/80 text-ink transition-colors duration-snap hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={isMuted ? 'Unmute video' : 'Mute video'}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      )}
    </div>
  );
};
