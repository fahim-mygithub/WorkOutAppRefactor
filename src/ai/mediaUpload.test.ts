import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  uploadMedia,
  detectMediaKind,
  PHOTO_MAX_BYTES,
  GIF_MAX_BYTES,
  VIDEO_MAX_BYTES,
  MediaUploadError,
  isMediaUploadAvailable,
} from './mediaUpload';

function mockFetch(status = 200, body: any = { url: 'https://r2.test/media/u1/photo.jpg', kind: 'photo', bytes: 1024 }) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

const mockDeps = (fetchImpl: any, overrides = {}) => ({
  url: 'https://worker.ai.test',
  getToken: vi.fn().mockResolvedValue('token-123'),
  fetch: fetchImpl,
  compressPhoto: vi.fn(async (file: Blob) => file),
  isOnline: () => true,
  ...overrides,
});

describe('mediaUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectMediaKind', () => {
    it('detects photos by MIME or extension', () => {
      expect(detectMediaKind({ type: 'image/jpeg', name: 'pic.jpg' })).toBe('photo');
      expect(detectMediaKind({ type: 'image/png', name: 'screenshot.png' })).toBe('photo');
      expect(detectMediaKind({ type: 'image/webp', name: 'photo.webp' })).toBe('photo');
      expect(detectMediaKind({ type: '', name: 'machine.heic' })).toBe('photo');
    });

    it('detects GIFs', () => {
      expect(detectMediaKind({ type: 'image/gif', name: 'demo.gif' })).toBe('gif');
      expect(detectMediaKind({ type: '', name: 'exercise.GIF' })).toBe('gif');
    });

    it('detects videos', () => {
      expect(detectMediaKind({ type: 'video/mp4', name: 'bench.mp4' })).toBe('video');
      expect(detectMediaKind({ type: 'video/webm', name: 'squat.webm' })).toBe('video');
      expect(detectMediaKind({ type: '', name: 'pullup.mov' })).toBe('video');
    });

    it('returns null for unsupported files', () => {
      expect(detectMediaKind({ type: 'application/pdf', name: 'doc.pdf' })).toBeNull();
      expect(detectMediaKind({ type: 'audio/mp3', name: 'song.mp3' })).toBeNull();
    });
  });

  describe('client-side caps and validation', () => {
    it('rejects a photo over 8 MB before calling fetch', async () => {
      const fetchFn = mockFetch();
      const bigPhoto = new File([new Uint8Array(PHOTO_MAX_BYTES + 1)], 'big.jpg', { type: 'image/jpeg' });

      await expect(uploadMedia(bigPhoto, mockDeps(fetchFn))).rejects.toThrow(
        /Photo exceeds the 8 MB size limit/i,
      );
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('rejects a GIF over 15 MB before calling fetch', async () => {
      const fetchFn = mockFetch();
      const bigGif = new File([new Uint8Array(GIF_MAX_BYTES + 1)], 'big.gif', { type: 'image/gif' });

      await expect(uploadMedia(bigGif, mockDeps(fetchFn))).rejects.toThrow(
        /GIF exceeds the 15 MB size limit/i,
      );
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('rejects a video over 60 MB before calling fetch', async () => {
      const fetchFn = mockFetch();
      const bigVideo = new File([new Uint8Array(VIDEO_MAX_BYTES + 1)], 'big.mp4', { type: 'video/mp4' });

      await expect(uploadMedia(bigVideo, mockDeps(fetchFn))).rejects.toThrow(
        /Video exceeds the 60 MB size limit/i,
      );
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('rejects unsupported media formats before calling fetch', async () => {
      const fetchFn = mockFetch();
      const pdf = new File([new Uint8Array(100)], 'test.pdf', { type: 'application/pdf' });

      await expect(uploadMedia(pdf, mockDeps(fetchFn))).rejects.toThrow(
        /Unsupported media format/i,
      );
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  describe('photo compression', () => {
    it('compresses photos before uploading', async () => {
      const fetchFn = mockFetch(200, {
        url: 'https://r2.test/media/u1/photo.jpg',
        kind: 'photo',
        bytes: 500,
      });
      const compressPhoto = vi.fn().mockResolvedValue(new Blob(['compressed'], { type: 'image/jpeg' }));
      const photo = new File([new Uint8Array(1000)], 'input.png', { type: 'image/png' });

      const result = await uploadMedia(photo, mockDeps(fetchFn, { compressPhoto }));
      expect(compressPhoto).toHaveBeenCalledWith(photo);
      expect(result.url).toBe('https://r2.test/media/u1/photo.jpg');
      expect(result.kind).toBe('photo');
    });
  });

  describe('Worker error handling', () => {
    it('handles 413 file too large from Worker', async () => {
      const fetchFn = mockFetch(413, { error: { code: 'too-large', message: 'Payload Too Large' } });
      const photo = new File([new Uint8Array(100)], 'photo.jpg', { type: 'image/jpeg' });

      await expect(uploadMedia(photo, mockDeps(fetchFn))).rejects.toThrow(
        /Payload Too Large|File is too large/i,
      );
    });

    it('handles 415 unsupported media from Worker', async () => {
      const fetchFn = mockFetch(415, { error: { code: 'unsupported-media', message: 'Unsupported type' } });
      const photo = new File([new Uint8Array(100)], 'photo.jpg', { type: 'image/jpeg' });

      await expect(uploadMedia(photo, mockDeps(fetchFn))).rejects.toThrow(
        /Unsupported/i,
      );
    });

    it('handles 429 rate limit reached', async () => {
      const fetchFn = mockFetch(429, { error: { code: 'limit', message: 'Daily cap reached' } });
      const gif = new File([new Uint8Array(100)], 'clip.gif', { type: 'image/gif' });

      await expect(uploadMedia(gif, mockDeps(fetchFn))).rejects.toMatchObject({
        code: 'limit',
      });
    });

    it('handles 401 signed out', async () => {
      const fetchFn = mockFetch(401, { error: { code: 'signed-out', message: 'Unauthorized' } });
      const video = new File([new Uint8Array(100)], 'clip.mp4', { type: 'video/mp4' });

      await expect(uploadMedia(video, mockDeps(fetchFn))).rejects.toMatchObject({
        code: 'signed-out',
      });
    });

    it('handles 403 not allowed', async () => {
      const fetchFn = mockFetch(403, { error: { code: 'not-allowed', message: 'Forbidden' } });
      const video = new File([new Uint8Array(100)], 'clip.mp4', { type: 'video/mp4' });

      await expect(uploadMedia(video, mockDeps(fetchFn))).rejects.toMatchObject({
        code: 'not-allowed',
      });
    });

    it('rejects immediately when offline', async () => {
      const fetchFn = mockFetch();
      const photo = new File([new Uint8Array(100)], 'photo.jpg', { type: 'image/jpeg' });

      await expect(uploadMedia(photo, mockDeps(fetchFn, { isOnline: () => false }))).rejects.toMatchObject({
        code: 'offline',
      });
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('rejects when unconfigured', async () => {
      const fetchFn = mockFetch();
      const photo = new File([new Uint8Array(100)], 'photo.jpg', { type: 'image/jpeg' });

      await expect(uploadMedia(photo, mockDeps(fetchFn, { url: '' }))).rejects.toMatchObject({
        code: 'unconfigured',
      });
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('rejects when token is null', async () => {
      const fetchFn = mockFetch();
      const photo = new File([new Uint8Array(100)], 'photo.jpg', { type: 'image/jpeg' });

      await expect(
        uploadMedia(photo, mockDeps(fetchFn, { getToken: vi.fn().mockResolvedValue(null) })),
      ).rejects.toMatchObject({
        code: 'signed-out',
      });
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  describe('successful upload', () => {
    it('uploads file with ID token to ${url}/media and returns metadata', async () => {
      const fetchFn = mockFetch(200, {
        url: 'https://r2.test/media/u1/workout.mp4',
        kind: 'video',
        bytes: 54321,
      });

      const video = new File([new Uint8Array(1000)], 'workout.mp4', { type: 'video/mp4' });
      const result = await uploadMedia(video, mockDeps(fetchFn));

      expect(fetchFn).toHaveBeenCalledTimes(1);
      const [calledUrl, options] = fetchFn.mock.calls[0];
      expect(calledUrl).toBe('https://worker.ai.test/media');
      expect(options.method).toBe('POST');
      expect(options.headers.authorization).toBe('Bearer token-123');
      expect(options.body).toBeInstanceOf(FormData);
      expect(result).toEqual({
        url: 'https://r2.test/media/u1/workout.mp4',
        kind: 'video',
        bytes: 54321,
      });
    });
  });

  describe('isMediaUploadAvailable', () => {
    it('returns false when offline or unconfigured', () => {
      expect(isMediaUploadAvailable({ url: '', isOnline: () => true })).toBe(false);
      expect(isMediaUploadAvailable({ url: 'https://w.test', isOnline: () => false })).toBe(false);
      expect(
        isMediaUploadAvailable({
          url: 'https://w.test',
          isOnline: () => true,
          getToken: vi.fn().mockResolvedValue('tok'),
        }),
      ).toBe(true);
    });
  });
});
