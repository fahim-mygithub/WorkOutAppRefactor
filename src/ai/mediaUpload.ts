/**
 * Client media upload service for Cloudflare R2 via the AI Worker.
 *
 * Uploads photos, GIFs, and videos to `${VITE_AI_URL}/media`.
 * Enforces client-side size caps matching the Worker:
 *  - Photos <= 8 MB (compressed before upload)
 *  - GIFs <= 15 MB
 *  - Videos <= 60 MB
 */

import { auth } from '../firebase/config';
import { MAX_IMAGE_EDGE } from './image';

export const PHOTO_MAX_BYTES = 8 * 1024 * 1024; // 8 MB
export const GIF_MAX_BYTES = 15 * 1024 * 1024;  // 15 MB
export const VIDEO_MAX_BYTES = 60 * 1024 * 1024; // 60 MB

export type MediaKind = 'photo' | 'gif' | 'video';

export interface MediaUploadResult {
  url: string;
  kind: MediaKind;
  bytes: number;
}

export interface MediaUploadDeps {
  /** Worker URL. Defaults to VITE_AI_URL. */
  url?: string;
  /** Firebase ID token of the signed-in user. */
  getToken?: () => Promise<string | null>;
  /** Injectable fetch implementation. */
  fetch?: typeof fetch;
  /** Custom photo compression for testing. */
  compressPhoto?: (file: Blob) => Promise<Blob>;
  /** Check if device is online. */
  isOnline?: () => boolean;
}

export class MediaUploadError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'MediaUploadError';
  }
}

/** Check if device is currently reporting offline. */
function checkOffline(deps?: MediaUploadDeps): boolean {
  if (deps?.isOnline) return !deps.isOnline();
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** Determine whether media upload is available based on config, auth, and network. */
export function isMediaUploadAvailable(deps?: MediaUploadDeps): boolean {
  const url = deps?.url ?? import.meta.env.VITE_AI_URL ?? '';
  if (!url) return false;
  if (checkOffline(deps)) return false;
  if (!auth.currentUser && !deps?.getToken) return false;
  return true;
}

/** Detect media kind from MIME type or file extension. */
export function detectMediaKind(file: { name?: string; type?: string }): MediaKind | null {
  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();

  if (mime === 'image/gif' || name.endsWith('.gif')) {
    return 'gif';
  }
  if (
    mime.startsWith('video/') ||
    name.endsWith('.mp4') ||
    name.endsWith('.webm') ||
    name.endsWith('.mov')
  ) {
    return 'video';
  }
  if (
    mime.startsWith('image/') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.webp') ||
    name.endsWith('.heic')
  ) {
    return 'photo';
  }
  return null;
}

/**
 * Compresses a photo like src/ai/image.ts using HTML Canvas.
 * Scales down to MAX_IMAGE_EDGE and encodes as JPEG.
 */
async function defaultCompressPhoto(file: Blob): Promise<Blob> {
  if (typeof document === 'undefined') {
    return file;
  }

  try {
    let source: CanvasImageSource;
    let width: number;
    let height: number;

    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      [source, width, height] = [bitmap, bitmap.width, bitmap.height];
    } else {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      try {
        img.src = objUrl;
        await img.decode();
      } finally {
        URL.revokeObjectURL(objUrl);
      }
      [source, width, height] = [img, img.naturalWidth, img.naturalHeight];
    }

    const fit = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height, 1));
    const targetWidth = Math.max(1, Math.round(width * fit));
    const targetHeight = Math.max(1, Math.round(height * fit));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

    return await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob || file),
        'image/jpeg',
        0.85,
      );
    });
  } catch {
    // If canvas decoding fails, proceed with the original file
    return file;
  }
}

const defaults = (): Required<Omit<MediaUploadDeps, 'compressPhoto' | 'isOnline'>> & Pick<MediaUploadDeps, 'compressPhoto' | 'isOnline'> => ({
  url: import.meta.env.VITE_AI_URL ?? '',
  getToken: async () => (auth.currentUser ? auth.currentUser.getIdToken() : null),
  fetch: (...args) => fetch(...args),
  compressPhoto: undefined,
  isOnline: undefined,
});

/**
 * Upload one media file to `${VITE_AI_URL}/media`.
 * Resolves with the R2 storage metadata { url, kind, bytes } or throws MediaUploadError.
 */
export async function uploadMedia(
  file: File | Blob,
  deps?: MediaUploadDeps,
): Promise<MediaUploadResult> {
  const d = { ...defaults(), ...deps };

  if (checkOffline(d)) {
    throw new MediaUploadError("You're offline — try again when you're back.", 'offline');
  }

  if (!d.url) {
    throw new MediaUploadError('AI is not configured.', 'unconfigured', 503);
  }

  const token = await d.getToken();
  if (!token) {
    throw new MediaUploadError('Sign in to upload media.', 'signed-out', 401);
  }

  const filename = file instanceof File ? file.name : 'upload.bin';
  const kind = detectMediaKind({ name: filename, type: file.type });

  if (!kind) {
    throw new MediaUploadError(
      'Unsupported media format. Please upload a JPEG, PNG, WebP, GIF, MP4, WebM, or MOV file.',
      'unsupported-media',
      415,
    );
  }

  // Client-side size cap checks matching Worker
  if (kind === 'photo' && file.size > PHOTO_MAX_BYTES) {
    throw new MediaUploadError(
      'Photo exceeds the 8 MB size limit. Please choose a smaller photo.',
      'photo-too-large',
      413,
    );
  }

  if (kind === 'gif' && file.size > GIF_MAX_BYTES) {
    throw new MediaUploadError(
      'GIF exceeds the 15 MB size limit. Please choose a smaller GIF.',
      'gif-too-large',
      413,
    );
  }

  if (kind === 'video' && file.size > VIDEO_MAX_BYTES) {
    throw new MediaUploadError(
      'Video exceeds the 60 MB size limit. Please choose a smaller video.',
      'video-too-large',
      413,
    );
  }

  // Compress photo if applicable
  let uploadBlob: Blob = file;
  let uploadName = filename;

  if (kind === 'photo') {
    const compressor = d.compressPhoto || defaultCompressPhoto;
    uploadBlob = await compressor(file);
    if (!uploadName.endsWith('.jpg') && !uploadName.endsWith('.jpeg')) {
      uploadName = uploadName.replace(/\.[^.]+$/, '') + '.jpg';
    }
  }

  const endpoint = `${d.url.replace(/\/$/, '')}/media`;
  const formData = new FormData();
  formData.append('file', uploadBlob, uploadName);

  let res: Response;
  try {
    res = await d.fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: formData,
    });
  } catch (err) {
    throw new MediaUploadError('Upload failed. Check your connection.', 'network-error', undefined);
  }

  if (!res.ok) {
    let errorJson: { error?: { code?: string; message?: string } } | null = null;
    try {
      errorJson = await res.json();
    } catch {
      // response might not be JSON
    }

    const message = errorJson?.error?.message;
    const code = errorJson?.error?.code || 'upload-failed';

    if (res.status === 413) {
      throw new MediaUploadError(message || 'File is too large for the server.', 'too-large', 413);
    }
    if (res.status === 415) {
      throw new MediaUploadError(message || 'Unsupported media type.', 'unsupported-media', 415);
    }
    if (res.status === 429) {
      throw new MediaUploadError(
        message || 'Daily upload limit reached. Try again tomorrow.',
        'limit',
        429,
      );
    }
    if (res.status === 401) {
      throw new MediaUploadError(message || 'Sign in to upload media.', 'signed-out', 401);
    }
    if (res.status === 403) {
      throw new MediaUploadError(message || 'Media upload is not permitted.', 'not-allowed', 403);
    }

    throw new MediaUploadError(message || `Upload failed with status ${res.status}.`, code, res.status);
  }

  try {
    const data = (await res.json()) as MediaUploadResult;
    if (!data.url || !data.kind) {
      throw new Error('Invalid server response');
    }
    return data;
  } catch {
    throw new MediaUploadError('Server returned an invalid response.', 'invalid-response', res.status);
  }
}
