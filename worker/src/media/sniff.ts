import { maxBytesForKind, type MediaKind, type SniffedMedia } from './types';

export {
  MAX_PHOTO_BYTES,
  MAX_GIF_BYTES,
  MAX_VIDEO_BYTES,
  UPLOAD_TOKEN_TTL_SECONDS,
  DEFAULT_DAILY_UPLOAD_LIMIT,
  maxBytesForKind,
} from './types';

/**
 * Sniffs the media type from magic bytes in the file's header.
 * Header content-type sent by the client is deliberately ignored.
 */
export function sniffMediaType(buffer: Uint8Array): SniffedMedia | null {
  if (buffer.length < 8) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { kind: 'photo', ext: 'jpg', mime: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { kind: 'photo', ext: 'png', mime: 'image/png' };
  }

  // GIF: GIF87a or GIF89a
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { kind: 'gif', ext: 'gif', mime: 'image/gif' };
  }

  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { kind: 'photo', ext: 'webp', mime: 'image/webp' };
  }

  // WEBM (EBML header): 1A 45 DF A3
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return { kind: 'video', ext: 'webm', mime: 'video/webm' };
  }

  // ISO Base Media File Format: starts with [4-byte size] 'ftyp' [4-byte major brand]
  if (
    buffer.length >= 12 &&
    buffer[4] === 0x66 && // 'f'
    buffer[5] === 0x74 && // 't'
    buffer[6] === 0x79 && // 'y'
    buffer[7] === 0x70 // 'p'
  ) {
    const brand = String.fromCharCode(buffer[8], buffer[9], buffer[10], buffer[11]).toLowerCase();

    // HEIC brands
    const heicBrands = ['heic', 'heix', 'heim', 'heis', 'mif1', 'msf1'];
    if (heicBrands.includes(brand)) {
      return { kind: 'photo', ext: 'heic', mime: 'image/heic' };
    }

    // QuickTime MOV brand
    if (brand === 'qt  ') {
      return { kind: 'video', ext: 'mov', mime: 'video/quicktime' };
    }

    // Check compatible brands up to first 64 bytes for heic
    const limit = Math.min(buffer.length - 3, 64);
    for (let i = 16; i < limit; i += 4) {
      const compBrand = String.fromCharCode(buffer[i], buffer[i + 1], buffer[i + 2], buffer[i + 3]).toLowerCase();
      if (['heic', 'heix', 'heim', 'heis'].includes(compBrand)) {
        return { kind: 'photo', ext: 'heic', mime: 'image/heic' };
      }
    }

    // Default ISO BMFF (isom, iso2, mp41, mp42, avc1, etc.)
    return { kind: 'video', ext: 'mp4', mime: 'video/mp4' };
  }

  // QuickTime MOV atom headers without ftyp (moov, mdat, wide, free)
  if (buffer.length >= 8) {
    const atom = String.fromCharCode(buffer[4], buffer[5], buffer[6], buffer[7]);
    if (['moov', 'mdat', 'wide', 'free'].includes(atom)) {
      return { kind: 'video', ext: 'mov', mime: 'video/quicktime' };
    }
  }

  return null;
}

export function isMediaSizeAllowed(kind: MediaKind, sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= maxBytesForKind(kind);
}

export function mimeFromExt(ext: string): string {
  const clean = ext.toLowerCase().replace(/^\./, '');
  switch (clean) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'gif':
      return 'image/gif';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'mov':
      return 'video/quicktime';
    default:
      return 'application/octet-stream';
  }
}
