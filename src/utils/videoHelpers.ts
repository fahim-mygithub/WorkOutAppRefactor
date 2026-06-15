/**
 * Video utility functions to handle URL transformations and fallbacks
 */

/**
 * Returns the video URL to load.
 *
 * Historically this rewrote media.musclewiki.com URLs to a local `/api/video`
 * Vite proxy in dev "to avoid CORS issues". That proxy is now actively broken:
 * media.musclewiki.com sits behind Cloudflare, which fingerprints the TLS
 * client and 403-blocks Node's HTTPS stack (what the Vite proxy uses) even with
 * a perfect browser User-Agent. A real browser loading the URL directly has an
 * allowed fingerprint and gets 200 — verified in-browser (readyState 4, 1280x720).
 *
 * `<video src>` plays cross-origin media without CORS (we never read pixels via
 * canvas or fetch() the bytes), so we load the CDN URL directly in both dev and
 * prod. This is also exactly what production already did. The trailing `#t=0.1`
 * media fragment in the source URLs is preserved (it just seeks the poster frame).
 */
export const transformVideoUrl = (originalUrl: string): string => {
  return originalUrl.trim();
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