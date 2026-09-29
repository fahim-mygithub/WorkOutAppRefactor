/** Demo media the app will play: a direct https .mp4, .webm or .gif file. */
const MEDIA_PATH = /\.(mp4|webm|gif)$/i;

/**
 * Whether `url` is a direct https link to a demo clip (.mp4/.webm/.gif,
 * case-insensitive; query and hash ignored). Anything else — other schemes
 * (javascript:, http:), pages, or unparseable text — is refused.
 */
export function isDemoMediaUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === 'https:' && MEDIA_PATH.test(u.pathname);
  } catch {
    return false;
  }
}

/** Whether a demo URL points at a GIF (shown as an image, not a video). */
export function isGifUrl(url: string): boolean {
  try {
    return /\.gif$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}
