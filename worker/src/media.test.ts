import { describe, it, expect, vi } from 'vitest';
import { verifyMedia } from './media';

const res = (status: number, headers: Record<string, string>, url?: string, body?: unknown) =>
  ({ status, ok: status >= 200 && status < 300, headers: new Headers(headers), url, body }) as unknown as Response;

describe('verifyMedia', () => {
  const REF = 'https://fahim-mygithub.github.io/';
  it('accepts an mp4 under the size limit', async () => {
    const f = vi.fn().mockResolvedValue(res(200, { 'content-type': 'video/mp4', 'content-length': '400000' }));
    await expect(verifyMedia('https://x/a.mp4', REF, f)).resolves.toEqual({ ok: true, type: 'video/mp4' });
    expect(f).toHaveBeenCalledWith(
      'https://x/a.mp4',
      expect.objectContaining({ method: 'HEAD', redirect: 'follow', headers: expect.objectContaining({ Referer: REF }) }),
    );
  });
  it('rejects hotlink blocks and html posing as gif', async () => {
    await expect(verifyMedia('https://x/a.gif', REF, vi.fn().mockResolvedValue(res(403, {})))).resolves.toMatchObject({ ok: false });
    await expect(verifyMedia('https://x/a.gif', REF, vi.fn().mockResolvedValue(res(200, { 'content-type': 'text/html' })))).resolves.toMatchObject({ ok: false });
  });
  it('rejects files over 25 MB and non-https', async () => {
    await expect(verifyMedia('https://x/a.mp4', REF, vi.fn().mockResolvedValue(res(200, { 'content-type': 'video/mp4', 'content-length': String(30e6) })))).resolves.toMatchObject({ ok: false });
    const f = vi.fn();
    await expect(verifyMedia('http://x/a.mp4', REF, f)).resolves.toMatchObject({ ok: false });
    expect(f).not.toHaveBeenCalled();
  });
  it('falls back to a ranged GET when HEAD is not allowed', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(res(405, {}))
      .mockResolvedValueOnce(res(206, { 'content-type': 'image/gif', 'content-range': 'bytes 0-0/120000' }));
    await expect(verifyMedia('https://x/a.gif', REF, f)).resolves.toEqual({ ok: true, type: 'image/gif' });
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls[1][1]).toMatchObject({ method: 'GET', headers: expect.objectContaining({ Range: 'bytes=0-0' }) });
  });
  it('falls back to a ranged GET when HEAD throws', async () => {
    const f = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(res(206, { 'content-type': 'video/webm', 'content-range': 'bytes 0-0/5000' }));
    await expect(verifyMedia('https://x/a.webm', REF, f)).resolves.toEqual({ ok: true, type: 'video/webm' });
  });
  it('rejects when every request fails', async () => {
    await expect(verifyMedia('https://x/a.gif', REF, vi.fn().mockRejectedValue(new Error('down')))).resolves.toMatchObject({ ok: false });
  });
  it('rejects a redirect that lands on a non-https URL', async () => {
    const f = vi.fn().mockResolvedValue(res(200, { 'content-type': 'video/mp4', 'content-length': '1000' }, 'http://cdn.x/a.mp4'));
    await expect(verifyMedia('https://x/a.mp4', REF, f)).resolves.toMatchObject({ ok: false, reason: 'redirected to non-https' });
  });
  it('accepts a redirect that stays on https', async () => {
    const f = vi.fn().mockResolvedValue(res(200, { 'content-type': 'video/mp4' }, 'https://cdn.x/a.mp4'));
    await expect(verifyMedia('https://x/a.mp4', REF, f)).resolves.toEqual({ ok: true, type: 'video/mp4' });
  });
  it('treats a missing size as unknown, not too large', async () => {
    const f = vi.fn().mockResolvedValue(res(200, { 'content-type': 'image/gif; charset=binary' }));
    await expect(verifyMedia('https://x/a.gif', REF, f)).resolves.toEqual({ ok: true, type: 'image/gif' });
  });
  it('rejects an oversized file reported through content-range', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(res(501, {}))
      .mockResolvedValueOnce(res(206, { 'content-type': 'video/mp4', 'content-range': 'bytes 0-0/90000000' }));
    await expect(verifyMedia('https://x/a.mp4', REF, f)).resolves.toMatchObject({ ok: false, reason: 'too large' });
  });
  it('gives each request its own 5 s timeout signal', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(res(405, {}))
      .mockResolvedValueOnce(res(206, { 'content-type': 'image/gif', 'content-range': 'bytes 0-0/1' }));
    await verifyMedia('https://x/a.gif', REF, f);
    const [head, get] = [f.mock.calls[0][1].signal, f.mock.calls[1][1].signal];
    expect(head).toBeInstanceOf(AbortSignal);
    expect(get).toBeInstanceOf(AbortSignal);
    expect(get).not.toBe(head);
  });
  it('rejects when the requests time out', async () => {
    const timeout = new DOMException('The operation timed out.', 'TimeoutError');
    await expect(verifyMedia('https://x/a.mp4', REF, vi.fn().mockRejectedValue(timeout))).resolves.toMatchObject({ ok: false });
    const abort = new DOMException('Aborted', 'AbortError');
    await expect(verifyMedia('https://x/a.mp4', REF, vi.fn().mockRejectedValue(abort))).resolves.toMatchObject({ ok: false });
  });
  it('cancels the ranged GET body once headers are read', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const f = vi.fn()
      .mockResolvedValueOnce(res(405, {}))
      .mockResolvedValueOnce(res(206, { 'content-type': 'image/gif', 'content-range': 'bytes 0-0/1' }, undefined, { cancel }));
    await expect(verifyMedia('https://x/a.gif', REF, f)).resolves.toEqual({ ok: true, type: 'image/gif' });
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it('cancels the ranged GET body on a failed status too', async () => {
    const cancel = vi.fn().mockRejectedValue(new Error('already closed'));
    const f = vi.fn()
      .mockResolvedValueOnce(res(501, {}))
      .mockResolvedValueOnce(res(403, {}, undefined, { cancel }));
    await expect(verifyMedia('https://x/a.gif', REF, f)).resolves.toMatchObject({ ok: false });
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
