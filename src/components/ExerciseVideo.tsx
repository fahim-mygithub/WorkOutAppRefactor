import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { VideoFallback } from './VideoFallback';
import { getVideoWithFallbacks, getFriendlyErrorMessage } from '../utils/videoHelpers';
import { useIsMobile } from '../hooks/useIsMobile';

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
      setErrorMessage('All video sources failed to load');
    }
  };

  useEffect(() => {
    // Reset states when video URL props change (not currentVideoUrl state)
    if (videoUrl !== videoRef.current?.dataset.lastVideoUrl) {
      const { primary: newPrimary } = getVideoWithFallbacks(videoUrl, fallbackVideoUrls);
      
      setCurrentVideoUrl(newPrimary);
      setRetryCount(0);
      setHasError(false);
      setIsLoading(true);
      setErrorMessage('');
      
      if (videoRef.current) {
        videoRef.current.dataset.lastVideoUrl = videoUrl;
      }
      return; // Exit early, let the effect run again with new currentVideoUrl
    }
    
    const video = videoRef.current;
    if (!video) return;

    // Reset loading state when video URL changes
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');

    // Validate current video URL
    if (!isValidVideoUrl(currentVideoUrl)) {
      setErrorMessage('Invalid video URL format');
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
  }, [autoPlay, currentVideoUrl, videoUrl, fallbackVideoUrls, exerciseName, retryCount]); // Need retryCount for fallback mechanism

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

  return (
    <div className={`relative bg-surface rounded-lg overflow-hidden group ${className}`}>
      <video
        ref={videoRef}
        muted={isMuted}
        loop
        playsInline
        preload={isMobile && compact ? "metadata" : "auto"}
        className={`w-full object-cover ${
          compact
            ? isMobile
              ? 'aspect-video' // Use aspect-video for mobile grid
              : 'h-32'
            : 'h-64'
        }`}
        poster=""
        // Mobile optimizations
        controlsList="nodownload nofullscreen"
        disablePictureInPicture
      />

      {isLoading && (
        <div className={`absolute inset-0 bg-surface-subtle flex flex-col items-center justify-center ${
          compact
            ? isMobile
              ? 'aspect-video' // Match video aspect ratio on mobile
              : 'h-32'
            : 'h-64'
        }`}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mb-2"></div>
          {retryCount > 0 && (
            <p className="text-ink text-xs">Trying source {retryCount + 1}...</p>
          )}
        </div>
      )}

      {/* Video Controls Overlay - Hide on compact mobile to avoid conflicts */}
      {!(isMobile && compact) && (
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center space-x-4">
            <button
              onClick={togglePlay}
              className={`bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200 ${
                isMobile ? 'p-2' : 'p-3'
              }`}
              aria-label={isPlaying ? 'Pause video' : 'Play video'}
            >
              {isPlaying ? (
                <Pause className={isMobile ? "w-4 h-4" : "w-6 h-6"} />
              ) : (
                <Play className={isMobile ? "w-4 h-4" : "w-6 h-6"} />
              )}
            </button>

            <button
              onClick={toggleMute}
              className={`bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all duration-200 ${
                isMobile ? 'p-2' : 'p-3'
              }`}
              aria-label={isMuted ? 'Unmute video' : 'Mute video'}
            >
              {isMuted ? (
                <VolumeX className={isMobile ? "w-4 h-4" : "w-6 h-6"} />
              ) : (
                <Volume2 className={isMobile ? "w-4 h-4" : "w-6 h-6"} />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Video Title Overlay */}
      {!compact && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
          <p className="text-white text-sm font-medium">{exerciseName}</p>
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