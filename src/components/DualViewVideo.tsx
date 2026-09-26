import React, { useState, useRef, useEffect } from 'react';
import { Dumbbell, Play, Pause, Volume2, VolumeX, Eye, EyeOff } from 'lucide-react';
import { VideoFallback } from './VideoFallback';
import { getVideoWithFallbacks, getFriendlyErrorMessage } from '../utils/videoHelpers';
import { cn } from '../lib/utils';

interface DualViewVideoProps {
  videoUrls: string[];
  exerciseName: string;
  autoPlay?: boolean;
  muted?: boolean;
  compact?: boolean;
  className?: string;
  instructions?: string[];
}

const isValidVideoUrl = (url: string): boolean => {
  try {
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

interface VideoState {
  isPlaying: boolean;
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string;
  currentUrl: string;
  retryCount: number;
}

export const DualViewVideo: React.FC<DualViewVideoProps> = ({
  videoUrls,
  exerciseName,
  autoPlay = false,
  muted = true,
  compact = false,
  className = '',
  instructions = []
}) => {
  const [isMuted, setIsMuted] = useState(muted);
  const [isGlobalPlaying, setIsGlobalPlaying] = useState(autoPlay);
  const [showBothViews, setShowBothViews] = useState(true);

  // Filter and prepare video URLs
  const validUrls = videoUrls.filter(url => url && isValidVideoUrl(url)).slice(0, 2);
  const frontVideoUrl = validUrls[0] || '';
  const sideVideoUrl = validUrls[1] || '';

  const frontVideoRef = useRef<HTMLVideoElement>(null);
  const sideVideoRef = useRef<HTMLVideoElement>(null);

  // Individual video states
  const [frontVideoState, setFrontVideoState] = useState<VideoState>({
    isPlaying: autoPlay,
    isLoading: true,
    hasError: false,
    errorMessage: '',
    currentUrl: frontVideoUrl,
    retryCount: 0
  });

  const [sideVideoState, setSideVideoState] = useState<VideoState>({
    isPlaying: autoPlay,
    isLoading: true,
    hasError: false,
    errorMessage: '',
    currentUrl: sideVideoUrl,
    retryCount: 0
  });

  // Setup video event handlers
  const setupVideoEvents = (
    videoRef: React.RefObject<HTMLVideoElement | null>,
    setState: React.Dispatch<React.SetStateAction<VideoState>>,
    url: string
  ) => {
    const video = videoRef.current;
    if (!video || !url) return;

    const handleLoadedData = () => {
      setState(prev => ({ ...prev, isLoading: false, hasError: false }));
      if (autoPlay && isGlobalPlaying) {
        video.play().catch((error) => {
          console.warn('Autoplay failed:', error);
          setIsGlobalPlaying(false);
        });
      }
    };

    const handleError = () => {
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true,
        errorMessage: 'Failed to load video'
      }));
    };

    const handleLoadStart = () => {
      setState(prev => ({ ...prev, isLoading: true, hasError: false }));
    };

    const handlePlay = () => {
      setState(prev => ({ ...prev, isPlaying: true }));
    };

    const handlePause = () => {
      setState(prev => ({ ...prev, isPlaying: false }));
    };

    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    video.src = url;
    video.load();

    return () => {
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  };

  useEffect(() => {
    if (frontVideoUrl) {
      return setupVideoEvents(frontVideoRef, setFrontVideoState, frontVideoUrl);
    }
  }, [frontVideoUrl, autoPlay, isGlobalPlaying]);

  useEffect(() => {
    if (sideVideoUrl) {
      return setupVideoEvents(sideVideoRef, setSideVideoState, sideVideoUrl);
    }
  }, [sideVideoUrl, autoPlay, isGlobalPlaying]);

  const togglePlay = () => {
    const newPlayingState = !isGlobalPlaying;
    setIsGlobalPlaying(newPlayingState);

    [frontVideoRef, sideVideoRef].forEach(ref => {
      const video = ref.current;
      if (!video) return;

      if (newPlayingState) {
        video.play().catch(() => console.warn('Failed to play video'));
      } else {
        video.pause();
      }
    });
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    [frontVideoRef, sideVideoRef].forEach(ref => {
      const video = ref.current;
      if (video) {
        video.muted = newMutedState;
      }
    });
  };

  const toggleViewMode = () => {
    setShowBothViews(!showBothViews);
  };

  // If both videos have errors, show fallback
  if (frontVideoState.hasError && sideVideoState.hasError) {
    return (
      <VideoFallback
        exerciseName={exerciseName}
        instructions={instructions}
        errorMessage="None of the video sources loaded."
        compact={compact}
        className={className}
      />
    );
  }

  const videoHeight = compact ? 'h-32' : 'h-64';
  const isLoading = frontVideoState.isLoading || sideVideoState.isLoading;
  const canSplit = Boolean(sideVideoUrl) && !sideVideoState.hasError;

  // Tempo: raised tile, views separated by a hairline gap, clips fade in once
  // loaded, and controls are always-visible round buttons (no hover-only UI).
  return (
    <div className={cn('relative overflow-hidden rounded-2xl bg-surface-raised', className)}>
      {/* Video Container */}
      <div className={cn('flex', showBothViews && 'gap-px bg-hairline', videoHeight)}>
        {/* Front View Video */}
        {(showBothViews || !sideVideoUrl) && frontVideoUrl && !frontVideoState.hasError && (
          <div className={cn('relative bg-surface-raised', showBothViews && sideVideoUrl ? 'w-1/2' : 'w-full')}>
            <video
              ref={frontVideoRef}
              muted={isMuted}
              loop
              playsInline
              preload="auto"
              className={cn(
                'w-full object-cover transition-opacity duration-smooth',
                videoHeight,
                frontVideoState.isLoading ? 'opacity-0' : 'opacity-100',
              )}
            />
            {!compact && <ViewLabel>Front</ViewLabel>}
          </div>
        )}

        {/* Side View Video */}
        {showBothViews && sideVideoUrl && !sideVideoState.hasError && (
          <div className="relative w-1/2 bg-surface-raised">
            <video
              ref={sideVideoRef}
              muted={isMuted}
              loop
              playsInline
              preload="auto"
              className={cn(
                'w-full object-cover transition-opacity duration-smooth',
                videoHeight,
                sideVideoState.isLoading ? 'opacity-0' : 'opacity-100',
              )}
            />
            {!compact && <ViewLabel>Side</ViewLabel>}
          </div>
        )}
      </div>

      {/* Loading placeholder */}
      {isLoading && (
        <div className={cn('absolute inset-0 flex items-center justify-center bg-surface-raised', videoHeight)}>
          <Dumbbell className="h-7 w-7 animate-pulse text-ink-subtle" aria-hidden="true" />
          <span className="sr-only">Loading videos</span>
        </div>
      )}

      {/* Controls */}
      {!isLoading && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          <ControlButton
            onClick={togglePlay}
            label={isGlobalPlaying ? 'Pause videos' : 'Play videos'}
          >
            {isGlobalPlaying ? (
              <Pause className="h-4 w-4" fill="currentColor" aria-hidden="true" />
            ) : (
              <Play className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden="true" />
            )}
          </ControlButton>

          <ControlButton onClick={toggleMute} label={isMuted ? 'Unmute videos' : 'Mute videos'}>
            {isMuted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
          </ControlButton>

          {/* View toggle — only when there is a second angle */}
          {canSplit && (
            <ControlButton
              onClick={toggleViewMode}
              label={showBothViews ? 'Show single view' : 'Show both views'}
            >
              {showBothViews ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </ControlButton>
          )}
        </div>
      )}
    </div>
  );
};

function ViewLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute left-2 top-2 rounded-full bg-surface/80 px-2.5 py-0.5 text-caption text-ink">
      {children}
    </span>
  );
}

function ControlButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-touch-min w-touch-min items-center justify-center rounded-full bg-surface/80 text-ink transition-colors duration-snap hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {children}
    </button>
  );
}
