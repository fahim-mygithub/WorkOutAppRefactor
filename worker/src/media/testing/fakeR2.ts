/**
 * In-memory test double for Cloudflare R2 bucket with Range request support.
 */

interface StoredR2Object {
  data: Uint8Array;
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
  etag: string;
  uploaded: Date;
}

export function parseRangeHeader(
  header: string | null | undefined,
  totalSize: number,
): { offset: number; length: number } | null {
  if (!header || !header.startsWith('bytes=')) return null;
  const parts = header.slice('bytes='.length).trim().split('-');
  if (parts.length !== 2) return null;
  const startStr = parts[0].trim();
  const endStr = parts[1].trim();

  if (startStr === '' && endStr !== '') {
    // Suffix: -N means last N bytes
    const suffix = parseInt(endStr, 10);
    if (isNaN(suffix) || suffix <= 0) return null;
    const len = Math.min(suffix, totalSize);
    return { offset: totalSize - len, length: len };
  }

  const start = parseInt(startStr, 10);
  if (isNaN(start) || start < 0 || start >= totalSize) return null;

  if (endStr === '') {
    return { offset: start, length: totalSize - start };
  }

  const end = parseInt(endStr, 10);
  if (isNaN(end) || end < start) return null;
  const clampedEnd = Math.min(end, totalSize - 1);
  return { offset: start, length: clampedEnd - start + 1 };
}

export function fakeR2(): R2Bucket & { store: Map<string, StoredR2Object> } {
  const store = new Map<string, StoredR2Object>();

  async function toUint8Array(
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
  ): Promise<Uint8Array> {
    if (value === null || value === undefined) return new Uint8Array(0);
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (typeof value === 'string') return new TextEncoder().encode(value);
    if (typeof (value as Blob).arrayBuffer === 'function') {
      return new Uint8Array(await (value as Blob).arrayBuffer());
    }
    if (typeof (value as ReadableStream).getReader === 'function') {
      const reader = (value as ReadableStream).getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        if (chunk) {
          chunks.push(chunk);
          total += chunk.length;
        }
      }
      const out = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        out.set(c, offset);
        offset += c.length;
      }
      return out;
    }
    return new Uint8Array(0);
  }

  const bucket: Partial<R2Bucket> = {
    async put(key: string, value: unknown, options?: R2PutOptions): Promise<R2Object> {
      const data = await toUint8Array(value as any);
      const etag = `"${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}"`;
      const uploaded = new Date();
      const stored: StoredR2Object = {
        data,
        httpMetadata: options?.httpMetadata as R2HTTPMetadata | undefined,
        customMetadata: options?.customMetadata,
        etag,
        uploaded,
      };
      store.set(key, stored);

      return {
        key,
        version: '1',
        size: data.length,
        etag,
        httpEtag: etag,
        checksums: {} as any,
        uploaded,
        httpMetadata: stored.httpMetadata,
        customMetadata: stored.customMetadata,
        storageClass: 'Standard',
        writeHttpMetadata(headers: Headers) {
          if (stored.httpMetadata?.contentType) headers.set('content-type', stored.httpMetadata.contentType);
          if (stored.httpMetadata?.cacheControl) headers.set('cache-control', stored.httpMetadata.cacheControl);
        },
      } as R2Object;
    },

    async get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null> {
      const stored = store.get(key);
      if (!stored) return null;

      let rangeInfo: { offset: number; length: number } | null = null;
      if (options?.range) {
        if (typeof (options.range as Headers).get === 'function') {
          const rHeader = (options.range as Headers).get('range');
          rangeInfo = parseRangeHeader(rHeader, stored.data.length);
        } else if ('offset' in options.range || 'length' in options.range) {
          const off = (options.range as { offset?: number }).offset ?? 0;
          const len = (options.range as { length?: number }).length ?? stored.data.length - off;
          rangeInfo = { offset: off, length: Math.min(len, stored.data.length - off) };
        } else if ('suffix' in options.range) {
          const suffix = (options.range as { suffix: number }).suffix;
          const len = Math.min(suffix, stored.data.length);
          rangeInfo = { offset: stored.data.length - len, length: len };
        }
      }

      const returnData = rangeInfo
        ? stored.data.slice(rangeInfo.offset, rangeInfo.offset + rangeInfo.length)
        : stored.data;

      const bodyStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(returnData);
          controller.close();
        },
      });

      return {
        key,
        version: '1',
        size: stored.data.length,
        etag: stored.etag,
        httpEtag: stored.etag,
        checksums: {} as any,
        uploaded: stored.uploaded,
        httpMetadata: stored.httpMetadata,
        customMetadata: stored.customMetadata,
        range: rangeInfo ? { offset: rangeInfo.offset, length: rangeInfo.length } : undefined,
        storageClass: 'Standard',
        get body() {
          return bodyStream;
        },
        bodyUsed: false,
        async arrayBuffer() {
          return returnData.buffer.slice(returnData.byteOffset, returnData.byteOffset + returnData.byteLength);
        },
        async bytes() {
          return returnData;
        },
        async text() {
          return new TextDecoder().decode(returnData);
        },
        async json<T>() {
          return JSON.parse(new TextDecoder().decode(returnData)) as T;
        },
        async blob() {
          return new Blob([returnData], { type: stored.httpMetadata?.contentType });
        },
        writeHttpMetadata(headers: Headers) {
          if (stored.httpMetadata?.contentType) headers.set('content-type', stored.httpMetadata.contentType);
          if (stored.httpMetadata?.cacheControl) headers.set('cache-control', stored.httpMetadata.cacheControl);
        },
      } as R2ObjectBody;
    },

    async head(key: string): Promise<R2Object | null> {
      const stored = store.get(key);
      if (!stored) return null;
      return {
        key,
        version: '1',
        size: stored.data.length,
        etag: stored.etag,
        httpEtag: stored.etag,
        checksums: {} as any,
        uploaded: stored.uploaded,
        httpMetadata: stored.httpMetadata,
        customMetadata: stored.customMetadata,
        storageClass: 'Standard',
        writeHttpMetadata(headers: Headers) {
          if (stored.httpMetadata?.contentType) headers.set('content-type', stored.httpMetadata.contentType);
          if (stored.httpMetadata?.cacheControl) headers.set('cache-control', stored.httpMetadata.cacheControl);
        },
      } as R2Object;
    },

    async delete(keys: string | string[]): Promise<void> {
      const arr = Array.isArray(keys) ? keys : [keys];
      for (const k of arr) store.delete(k);
    },

    /** Sorted, paginated like R2: `cursor` is the last key of the previous page. */
    async list(options?: R2ListOptions): Promise<R2Objects> {
      const limit = options?.limit ?? 1000;
      const keys = [...store.keys()]
        .filter((k) => k.startsWith(options?.prefix ?? ''))
        .sort()
        .filter((k) => !options?.cursor || k > options.cursor);
      const page = keys.slice(0, limit);
      const truncated = keys.length > page.length;
      const objects = page.map((key) => {
        const s = store.get(key)!;
        return { key, size: s.data.length, etag: s.etag, uploaded: s.uploaded } as R2Object;
      });
      return (truncated
        ? { objects, delimitedPrefixes: [], truncated: true, cursor: page[page.length - 1] }
        : { objects, delimitedPrefixes: [], truncated: false }) as R2Objects;
    },
  };

  return Object.assign(bucket as R2Bucket, { store });
}
