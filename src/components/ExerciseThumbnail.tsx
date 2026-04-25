import React, { useState, useRef, useEffect } from 'react';
import { Play, Dumbbell } from 'lucide-react';
import { Exercise } from '../types/exercise';
import { getVideoWithFallbacks } from '../utils/videoHelpers';

interface ExerciseThumbnailProps {
  exercise: Exercise;
  className?: string;
  showPlayButton?: boolean;
  onClick?: () => void;
  lazy?: boolean;
}

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

  return (
    <div
      ref={containerRef}
      className={`relative bg-gray-900 rounded-lg overflow-hidden cursor-pointer group aspect-video ${className}`}
      onClick={handleClick}
    >
      {/* Video Thumbnail */}
      {isIntersecting && primaryVideoUrl && !videoError ? (
        <>
          <video
            ref={videoRef}
            src={primaryVideoUrl}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              videoLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoadedData={handleVideoLoad}
            onError={handleVideoError}
            muted
            playsInline
            preload="metadata"
            disablePictureInPicture
            controlsList="nodownload nofullscreen"
          />

          {/* Loading state while video loads */}
          {!videoLoaded && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          )}
        </>
      ) : (
        /* Fallback when no video or error */
        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
          <Dumbbell className="w-8 h-8 text-gray-500" />
        </div>
      )}

      {/* Play Button Overlay */}
      {showPlayButton && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black bg-opacity-60 rounded-full p-3 group-hover:bg-opacity-80 transition-all duration-200 group-hover:scale-110">
            <Play className="w-6 h-6 text-white" />
          </div>
        </div>
      )}

      {/* Gradient Overlay for Better Text Visibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

      {/* Exercise Name Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <p className="text-white text-sm font-medium truncate">{exercise.name}</p>
      </div>

      {/* Loading placeholder when lazy loading */}
      {!isIntersecting && lazy && (
        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
          <div className="w-6 h-6 bg-gray-700 rounded animate-pulse"></div>
        </div>
      )}
    </div>
  );
};