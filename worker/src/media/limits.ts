/**
 * Size caps enforced while the bytes stream in, so an oversized or wrong-type
 * body is cut off instead of being buffered in full first.
 */
import { sniffMediaType } from './sniff';
import { MAX_VIDEO_BYTES, maxBytesForKind, type SniffedMedia } from './types';

/** Largest accepted request: the biggest file plus multipart framing. */
export const MAX_UPLOAD_REQUEST_BYTES = MAX_VIDEO_BYTES + 1024 * 1024;

export type MediaLimitCode = 'empty' | 'too-large' | 'unsupported';

export class MediaLimitError extends Error {
  constructor(
    readonly code: MediaLimitCode,
    message: string,
  ) {
    super(message);
    this.name = 'MediaLimitError';
  }
}

/** Bytes sniffed before the type is decided (enough for every supported header). */
const SNIFF_BYTES = 64;

/**
 * Reads a media body, sniffing its type from the first bytes and enforcing
 * that type's size cap as chunks arrive. Cancels the stream on any failure.
 */
export async function readCappedMedia(
  body: ReadableStream<Uint8Array> | null,
): Promise<{ bytes: Uint8Array; sniffed: SniffedMedia }> {
  if (!body) throw new MediaLimitError('empty', 'File is empty.');
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let sniffed: SniffedMedia | null = null;
  let cap = MAX_VIDEO_BYTES;

  const decide = (head: Uint8Array) => {
    sniffed = sniffMediaType(head);
    if (!sniffed) {
      throw new MediaLimitError(
        'unsupported',
        'Unsupported media format. Expected photo (jpeg/png/webp/heic), gif, or video (mp4/webm/mov).',
      );
    }
    cap = maxBytesForKind(sniffed.kind);
  };
  const joined = () => {
    const out = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) {
      out.set(c, at);
      at += c.length;
    }
    return out;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
      if (!sniffed && total >= SNIFF_BYTES) decide(joined().subarray(0, SNIFF_BYTES));
      if (total > cap) {
        throw new MediaLimitError(
          'too-large',
          sniffed
            ? `File exceeds limit for ${(sniffed as SniffedMedia).kind} (${cap} bytes).`
            : 'File exceeds the maximum size limit.',
        );
      }
    }
    if (total === 0) throw new MediaLimitError('empty', 'File is empty.');
    const bytes = joined();
    if (!sniffed) decide(bytes);
    return { bytes, sniffed: sniffed as unknown as SniffedMedia };
  } catch (err) {
    await reader.cancel().catch(() => {});
    throw err;
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parses a multipart request while refusing to read more than `maxBytes`:
 * checks the declared Content-Length first, then counts the streamed bytes.
 */
export async function parseCappedFormData(request: Request, maxBytes: number): Promise<FormData> {
  const tooLarge = () => new MediaLimitError('too-large', 'Upload exceeds the maximum 60 MB size limit.');
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await request.body?.cancel().catch(() => {});
    throw tooLarge();
  }
  if (!request.body) throw new Error('Missing request body.');

  let seen = 0;
  let tripped = false;
  const limiter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      seen += chunk.length;
      if (seen > maxBytes) {
        tripped = true;
        controller.error(tooLarge());
        return;
      }
      controller.enqueue(chunk);
    },
  });
  const limited = new Response(request.body.pipeThrough(limiter), {
    headers: { 'content-type': request.headers.get('content-type') ?? '' },
  });
  try {
    return await limited.formData();
  } catch (err) {
    if (tripped) throw tooLarge();
    throw err;
  }
}
