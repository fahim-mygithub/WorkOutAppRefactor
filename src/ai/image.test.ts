import { describe, it, expect, vi } from 'vitest';
import {
  MAX_IMAGE_BASE64_CHARS,
  MAX_IMAGE_BYTES,
  ImageTooLargeError,
  assertImageFits,
  base64Length,
  blobToBase64,
  compressImage,
  encodeWithinBudget,
} from './image';

const blobOf = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });

describe('image size cap', () => {
  it('is ~1.5 MB of JPEG, and its base64 length matches the Worker cap', () => {
    expect(MAX_IMAGE_BYTES).toBe(1_500_000);
    expect(MAX_IMAGE_BASE64_CHARS).toBe(2_000_000);
    expect(base64Length(MAX_IMAGE_BYTES)).toBe(MAX_IMAGE_BASE64_CHARS);
  });

  it('assertImageFits passes at the cap and throws above it', () => {
    expect(() => assertImageFits({ mediaType: 'image/jpeg', data: 'A'.repeat(MAX_IMAGE_BASE64_CHARS) })).not.toThrow();
    expect(() => assertImageFits({ mediaType: 'image/jpeg', data: 'A'.repeat(MAX_IMAGE_BASE64_CHARS + 4) })).toThrow(
      ImageTooLargeError,
    );
  });
});

describe('encodeWithinBudget', () => {
  it('keeps the first encoding that fits', async () => {
    const encode = vi.fn().mockResolvedValue(blobOf(1000));
    const blob = await encodeWithinBudget(encode, 2000);
    expect(blob.size).toBe(1000);
    expect(encode).toHaveBeenCalledTimes(1);
    expect(encode).toHaveBeenCalledWith(1, expect.any(Number));
  });

  it('steps quality and size down until it fits', async () => {
    const sizes = [5000, 4000, 2500, 1900];
    const encode = vi.fn().mockImplementation(async () => blobOf(sizes.shift() ?? 100));
    const blob = await encodeWithinBudget(encode, 2000);
    expect(blob.size).toBe(1900);
    expect(encode).toHaveBeenCalledTimes(4);
    const [first, last] = [encode.mock.calls[0], encode.mock.calls[3]];
    expect(last[0] * last[1]).toBeLessThan(first[0] * first[1]);
  });

  it('throws ImageTooLargeError when nothing fits', async () => {
    const encode = vi.fn().mockResolvedValue(blobOf(5000));
    await expect(encodeWithinBudget(encode, 2000)).rejects.toBeInstanceOf(ImageTooLargeError);
  });
});

describe('blobToBase64 / compressImage', () => {
  it('encodes bytes as plain base64 (no data: prefix)', async () => {
    const blob = new Blob([new Uint8Array([104, 105, 33])]);
    await expect(blobToBase64(blob)).resolves.toBe('aGkh');
  });

  it('returns a JPEG payload under the cap', async () => {
    const file = new File([new Uint8Array(10)], 'machine.heic', { type: 'image/heic' });
    const encoderFor = vi.fn().mockResolvedValue(async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }));
    const image = await compressImage(file, { encoderFor });
    expect(image).toEqual({ mediaType: 'image/jpeg', data: 'AQID' });
    expect(encoderFor).toHaveBeenCalledWith(file);
  });

  it('rejects a photo that cannot be shrunk under the cap', async () => {
    const file = new File([new Uint8Array(10)], 'huge.jpg', { type: 'image/jpeg' });
    const encoderFor = vi.fn().mockResolvedValue(async () => blobOf(MAX_IMAGE_BYTES + 1));
    await expect(compressImage(file, { encoderFor })).rejects.toBeInstanceOf(ImageTooLargeError);
  });
});
