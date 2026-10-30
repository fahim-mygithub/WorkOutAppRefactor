/**
 * Photos for the AI Worker: shrink on the device to a JPEG of at most
 * MAX_IMAGE_BYTES, then base64. The Worker rejects anything over
 * MAX_IMAGE_BASE64_CHARS (worker/src/schemas.ts), so the two caps must agree.
 */
import type { AiImage } from './types';

/** Largest JPEG sent, in bytes (~1.5 MB). */
export const MAX_IMAGE_BYTES = 1_500_000;
/** Base64 characters for `n` bytes. */
export const base64Length = (bytes: number): number => 4 * Math.ceil(bytes / 3);
/** The Worker's cap on a photo's base64 length (MAX_IMAGE_BYTES encoded). */
export const MAX_IMAGE_BASE64_CHARS = base64Length(MAX_IMAGE_BYTES);
/** Longest edge drawn: past this the model sees no more detail, only cost. */
export const MAX_IMAGE_EDGE = 1568;

export class ImageTooLargeError extends Error {
  constructor(message = 'That photo is too large.') {
    super(message);
    this.name = 'ImageTooLargeError';
  }
}

/** Throws ImageTooLargeError when the photo is over the Worker's cap. */
export function assertImageFits(image: AiImage): void {
  if (image.data.length > MAX_IMAGE_BASE64_CHARS) throw new ImageTooLargeError();
}

/** Draws the photo at `scale` (of the capped size) and encodes it as JPEG at `quality`. */
export type Encoder = (scale: number, quality: number) => Promise<Blob>;

/** Scale, quality pairs tried in order, each smaller than the last. */
const ATTEMPTS: ReadonlyArray<readonly [number, number]> = [
  [1, 0.85],
  [1, 0.72],
  [0.8, 0.72],
  [0.65, 0.65],
  [0.5, 0.6],
  [0.35, 0.55],
];

/** The first encoding that fits `maxBytes`, stepping quality and size down. */
export async function encodeWithinBudget(encode: Encoder, maxBytes = MAX_IMAGE_BYTES): Promise<Blob> {
  for (const [scale, quality] of ATTEMPTS) {
    const blob = await encode(scale, quality);
    if (blob.size <= maxBytes) return blob;
  }
  throw new ImageTooLargeError();
}

/** Plain base64 of a blob's bytes (no `data:` prefix). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? '');
      resolve(url.slice(url.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the photo.'));
    reader.readAsDataURL(blob);
  });
}

/** Decodes the file (camera orientation applied) and returns a canvas encoder. */
async function canvasEncoderFor(file: Blob): Promise<Encoder> {
  let source: CanvasImageSource;
  let width: number;
  let height: number;
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    [source, width, height] = [bitmap, bitmap.width, bitmap.height];
  } else {
    const img = new Image();
    const url = URL.createObjectURL(file);
    try {
      img.src = url;
      await img.decode();
    } finally {
      URL.revokeObjectURL(url);
    }
    [source, width, height] = [img, img.naturalWidth, img.naturalHeight];
  }
  const fit = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height, 1));
  return (scale, quality) =>
    new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * fit * scale));
      canvas.height = Math.max(1, Math.round(height * fit * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Could not read the photo.'));
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read the photo.'))), 'image/jpeg', quality);
    });
}

export interface CompressDeps {
  /** Test seam: the encoder for a file (defaults to a canvas). */
  encoderFor?: (file: Blob) => Promise<Encoder>;
}

/**
 * A camera photo as a JPEG under MAX_IMAGE_BYTES, base64. Throws
 * ImageTooLargeError when even the smallest attempt is over.
 */
export async function compressImage(file: Blob, deps: CompressDeps = {}): Promise<AiImage> {
  const encode = await (deps.encoderFor ?? canvasEncoderFor)(file);
  const blob = await encodeWithinBudget(encode);
  const image: AiImage = { mediaType: 'image/jpeg', data: await blobToBase64(blob) };
  assertImageFits(image);
  return image;
}
