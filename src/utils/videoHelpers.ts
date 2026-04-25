/**
 * Video utility functions to handle URL transformations and fallbacks
 */

/**
 * Transforms external video URLs to use local proxy in development
 * This helps bypass CORS issues when loading videos from external sources
 */
export const transformVideoUrl = (originalUrl: string): string => {
  const cleanUrl = originalUrl.trim();
  
  // Only transform in development mode
  if (import.meta.env.DEV && cleanUrl.includes('media.musclewiki.com')) {
    // Transform https://media.musclewiki.com/path/video.mp4 to /api/video/path/video.mp4
    const urlPath = cleanUrl.replace('https://media.musclewiki.com', '');
    return `/api/video${urlPath}`;
  }
  
  return cleanUrl;
};

/**
 * Transforms an array of video URLs for proxy usage
 */
export const transformVideoUrls = (urls: string[]): string[] => {
  return urls.map(transformVideoUrl);
};

/**
 * Checks if a URL is an external video URL that might have CORS issues
 */
export const isExternalVideoUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    const currentOrigin = window.location.origin;
    return urlObj.origin !== currentOrigin;
  } catch {
    return false;
  }
};

/**
 * Extracts exercise name for YouTube search
 */
export const createYouTubeSearchUrl = (exerciseName: string): string => {
  const searchQuery = encodeURIComponent(`${exerciseName} exercise tutorial proper form`);
  return `https://www.youtube.com/results?search_query=${searchQuery}`;
};

/**
 * Gets video URL with fallback options
 */
export const getVideoWithFallbacks = (primaryUrl: string, fallbackUrls: string[] = []): {
  primary: string;
  fallbacks: string[];
} => {
  return {
    primary: transformVideoUrl(primaryUrl),
    fallbacks: transformVideoUrls(fallbackUrls),
  };
};

/**
 * Determines if we should show a video loading error as user-friendly
 */
export const shouldShowFriendlyError = (url: string, error?: MediaError | null): boolean => {
  const isExternal = isExternalVideoUrl(url);
  const isCorsLikely = isExternal && (
    !error || 
    error.code === error.MEDIA_ERR_SRC_NOT_SUPPORTED ||
    error.code === error.MEDIA_ERR_NETWORK
  );
  
  return isCorsLikely;
};

/**
 * Gets a user-friendly error message based on the error type and URL
 */
export const getFriendlyErrorMessage = (url: string, error?: MediaError | null): string => {
  if (shouldShowFriendlyError(url, error)) {
    return 'Video temporarily unavailable';
  }
  
  if (error) {
    switch (error.code) {
      case error.MEDIA_ERR_ABORTED:
        return 'Video loading was interrupted';
      case error.MEDIA_ERR_NETWORK:
        return 'Network error loading video';
      case error.MEDIA_ERR_DECODE:
        return 'Unable to play video format';
      case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
        return 'Video format not supported';
      default:
        return 'Video temporarily unavailable';
    }
  }
  
  return 'Video temporarily unavailable';
};