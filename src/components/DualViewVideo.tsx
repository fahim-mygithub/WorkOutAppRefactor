import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Eye, EyeOff } from 'lucide-react';
import { VideoFallback } from './VideoFallback';
import { getVideoWithFallbacks, getFriendlyErrorMessage } from '../utils/videoHelpers';

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
        errorMessage="All video sources failed to load"
        compact={compact}
        className={className}
      />
    );
  }

  const videoHeight = compact ? 'h-32' : 'h-64';
  const isLoading = frontVideoState.isLoading || sideVideoState.isLoading;

  return (
    <div className={`relative bg-surface rounded-lg overflow-hidden group ${className}`}>
      {/* Video Container */}
      <div className={`flex ${showBothViews ? 'space-x-1' : ''} ${videoHeight}`}>
        {/* Front View Video */}
        {(showBothViews || !sideVideoUrl) && frontVideoUrl && !frontVideoState.hasError && (
          <div className={`relative ${showBothViews && sideVideoUrl ? 'w-1/2' : 'w-full'}`}>
            <video
              ref={frontVideoRef}
              muted={isMuted}
              loop
              playsInline
              preload="auto"
              className={`w-full ${videoHeight} object-cover`}
            />
            {!compact && (
              <div className="absolute top-2 left-2">
                <span className="bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                  Front View
                </span>
              </div>
            )}
          </div>
        )}

        {/* Side View Video */}
        {showBothViews && sideVideoUrl && !sideVideoState.hasError && (
          <div className="relative w-1/2">
            <video
              ref={sideVideoRef}
              muted={isMuted}
              loop
              playsInline
              preload="auto"
              className={`w-full ${videoHeight} object-cover`}
            />
            {!compact && (
              <div className="absolute top-2 left-2">
                <span className="bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                  Side View
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className={`absolute inset-0 bg-surface-subtle flex flex-col items-center justify-center ${videoHeight}`}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mb-2"></div>
          <p className="text-ink text-xs">Loading videos...</p>
        </div>
      )}

      {/* Video Controls Overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center space-x-4">
          <button
            onClick={togglePlay}
            className="bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full p-3 transition-all duration-200"
            aria-label={isGlobalPlaying ? 'Pause videos' : 'Play videos'}
          >
            {isGlobalPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </button>

          <button
            onClick={toggleMute}
            className="bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full p-3 transition-all duration-200"
            aria-label={isMuted ? 'Unmute videos' : 'Mute videos'}
          >
            {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </button>

          {/* View Toggle Button - only show if we have both videos */}
          {sideVideoUrl && !sideVideoState.hasError && (
            <button
              onClick={toggleViewMode}
              className="bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full p-3 transition-all duration-200"
              aria-label={showBothViews ? 'Show single view' : 'Show both views'}
            >
              {showBothViews ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
            </button>
          )}
        </div>
      </div>

      {/* Video Title Overlay */}
      {!compact && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
          <p className="text-white text-sm font-medium">{exerciseName}</p>
          {showBothViews && sideVideoUrl && (
            <p className="text-white text-xs opacity-75">Front & Side Views</p>
          )}
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="absolute top-2 right-2">
          <div className="bg-black bg-opacity-50 rounded-full p-2">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      )}
    </div>
  );
};