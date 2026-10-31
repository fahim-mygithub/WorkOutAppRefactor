import { describe, expect, it } from 'vitest';
import { MediaLimitError, parseCappedFormData, readCappedMedia } from './limits';
import { assertPublicHttpsUrl } from './ssrf';

const MB = 1024 * 1024;
const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];

/** A body of `chunks` chunks of `chunkBytes` each that counts how many were pulled. */
function countingStream(head: number[], chunkBytes: number, chunks: number) {
  const state = { pulled: 0 };
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (state.pulled >= chunks) return controller.close();
      const chunk = new Uint8Array(chunkBytes);
      if (state.pulled === 0) chunk.set(head);
      state.pulled++;
      controller.enqueue(chunk);
    },
  });
  return { stream, state };
}

async function limitError(p: Promise<unknown>): Promise<MediaLimitError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(MediaLimitError);
    return e as MediaLimitError;
  }
  throw new Error('expected a MediaLimitError');
}

describe('readCappedMedia (caps enforced while streaming)', () => {
  it('stops reading a photo stream once it passes the 8 MB photo cap', async () => {
    const { stream, state } = countingStream(JPEG_HEAD, 1 * MB, 100);
    const err = await limitError(readCappedMedia(stream));
    expect(err.code).toBe('too-large');
    expect(state.pulled).toBeLessThanOrEqual(10); // 8 MB cap + read-ahead, nowhere near 100
  });

  it('rejects an unsupported type after the first chunk without reading the rest', async () => {
    const { stream, state } = countingStream([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e, 0x3c, 0x62], 1 * MB, 100);
    const err = await limitError(readCappedMedia(stream));
    expect(err.code).toBe('unsupported');
    expect(state.pulled).toBeLessThanOrEqual(2);
  });

  it('rejects an empty body and returns small valid media', async () => {
    expect((await limitError(readCappedMedia(null))).code).toBe('empty');
    const ok = await readCappedMedia(new Response(new Uint8Array([...JPEG_HEAD, 1, 2, 3])).body);
    expect(ok.sniffed.kind).toBe('photo');
    expect(ok.bytes.length).toBe(JPEG_HEAD.length + 3);
  });
});

describe('parseCappedFormData', () => {
  const form = (bytes: number) => {
    const fd = new FormData();
    const data = new Uint8Array(bytes);
    data.set(JPEG_HEAD);
    fd.set('file', new Blob([data], { type: 'image/jpeg' }), 'a.jpg');
    return fd;
  };

  it('refuses a declared content-length over the cap before reading any body', async () => {
    const { stream, state } = countingStream(JPEG_HEAD, 1 * MB, 10);
    const req = new Request('https://w.test/media', {
      method: 'POST',
      body: stream,
      headers: { 'content-type': 'multipart/form-data; boundary=x', 'content-length': String(200 * MB) },
      // @ts-expect-error node needs duplex for stream bodies
      duplex: 'half',
    });
    expect((await limitError(parseCappedFormData(req, 61 * MB))).code).toBe('too-large');
    expect(state.pulled).toBe(0);
  });

  it('cuts off a chunked body (no content-length) that runs past the cap', async () => {
    const { stream, state } = countingStream([], 1 * MB, 500);
    const req = new Request('https://w.test/media', {
      method: 'POST',
      body: stream,
      headers: { 'content-type': 'multipart/form-data; boundary=x' },
      // @ts-expect-error node needs duplex for stream bodies
      duplex: 'half',
    });
    expect((await limitError(parseCappedFormData(req, 5 * MB))).code).toBe('too-large');
    expect(state.pulled).toBeLessThan(20);
  });

  it('parses a normal upload', async () => {
    const res = new Response(form(1000));
    const req = new Request('https://w.test/media', {
      method: 'POST',
      body: res.body,
      headers: { 'content-type': res.headers.get('content-type')! },
      // @ts-expect-error node needs duplex for stream bodies
      duplex: 'half',
    });
    const fd = await parseCappedFormData(req, 61 * MB);
    expect((fd.get('file') as Blob).size).toBe(1000);
  });
});

describe('assertPublicHttpsUrl', () => {
  it('accepts ordinary public https URLs', () => {
    expect(assertPublicHttpsUrl('https://example.com/a.mp4').hostname).toBe('example.com');
    expect(assertPublicHttpsUrl('https://8.8.8.8/a.gif').hostname).toBe('8.8.8.8');
  });

  it.each([
    'http://example.com/a.mp4',
    'ftp://example.com/a.mp4',
    'https://localhost/a.mp4',
    'https://foo.localhost/a.mp4',
    'https://127.0.0.1/a.mp4',
    'https://127.1.2.3/a.mp4',
    'https://0.0.0.0/a.mp4',
    'https://10.0.0.5/a.mp4',
    'https://172.16.0.1/a.mp4',
    'https://172.31.255.1/a.mp4',
    'https://192.168.1.1/a.mp4',
    'https://169.254.169.254/latest/meta-data',
    'https://100.64.0.1/a.mp4',
    'https://198.18.0.1/a.mp4',
    'https://224.0.0.1/a.mp4',
    'https://[::1]/a.mp4',
    'https://[fd00::1]/a.mp4',
    'https://[::ffff:127.0.0.1]/a.mp4',
    'https://2130706433/a.mp4', // decimal form of 127.0.0.1
    'https://0x7f.1/a.mp4',
    'https://printer.local/a.mp4',
    'https://db.internal/a.mp4',
    'https://intranet/a.mp4',
    'https://user:pw@example.com/a.mp4',
    'not a url',
  ])('refuses %s', (u) => {
    expect(() => assertPublicHttpsUrl(u)).toThrow();
  });
});
