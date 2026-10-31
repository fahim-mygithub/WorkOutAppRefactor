/**
 * Media type constants, limits, and common interfaces for Cloudflare R2 media storage.
 */

export type MediaKind = 'photo' | 'gif' | 'video';

export interface SniffedMedia {
  kind: MediaKind;
  ext: string;
  mime: string;
}

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_GIF_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_VIDEO_BYTES = 60 * 1024 * 1024; // 60 MB
export const UPLOAD_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const DEFAULT_DAILY_UPLOAD_LIMIT = 50;

export function maxBytesForKind(kind: MediaKind): number {
  switch (kind) {
    case 'photo':
      return MAX_PHOTO_BYTES;
    case 'gif':
      return MAX_GIF_BYTES;
    case 'video':
      return MAX_VIDEO_BYTES;
  }
}

export interface UploadTokenPayload {
  uid: string;
  exerciseId: string;
  createdAt: number;
}

export interface MediaUploadResult {
  url: string;
  kind: MediaKind;
  bytes: number;
}

export type MediaErrorCode =
  | 'invalid-argument'
  | 'unauthenticated'
  | 'permission-denied'
  | 'not-found'
  | 'payload-too-large'
  | 'unsupported-media-type'
  | 'resource-exhausted'
  | 'internal';

export interface MediaErrorResponse {
  error: {
    code: MediaErrorCode;
    message: string;
  };
}
