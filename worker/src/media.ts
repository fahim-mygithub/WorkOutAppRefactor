/**
 * Checks a candidate demo clip the way the app will load it: https (also after
 * redirects), reachable with the app as Referer (catches hotlink blocks), a
 * real media type, and a sane size. A missing size counts as unknown (OK).
 * Costs at most 2 fetches per URL (HEAD, then a 1-byte ranged GET fallback).
 */
const TYPES = ['video/mp4', 'video/webm', 'image/gif'];
export const MAX_BYTES = 25_000_000;

export type MediaCheck = { ok: true; type: string } | { ok: false; reason: string };

export async function verifyMedia(url: string, referer: string, fetchImpl: typeof fetch = fetch): Promise<MediaCheck> {
  if (!url.startsWith('https://')) return { ok: false, reason: 'not https' };
  const headers = { Referer: referer, 'User-Agent': 'Mozilla/5.0 (WorkoutApp media check)' };
  let r = await fetchImpl(url, { method: 'HEAD', headers, redirect: 'follow' }).catch(() => null);
  if (!r || r.status === 405 || r.status === 501) {
    r = await fetchImpl(url, { method: 'GET', headers: { ...headers, Range: 'bytes=0-0' }, redirect: 'follow' }).catch(() => null);
  }
  if (!r || !r.ok) return { ok: false, reason: `status ${r?.status ?? 'error'}` };
  if (r.url && !r.url.startsWith('https://')) return { ok: false, reason: 'redirected to non-https' };
  const type = (r.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!TYPES.includes(type)) return { ok: false, reason: `type ${type || 'unknown'}` };
  const size = Number(r.headers.get('content-range')?.split('/')[1] ?? r.headers.get('content-length') ?? NaN);
  if (Number.isFinite(size) && size > MAX_BYTES) return { ok: false, reason: 'too large' };
  return { ok: true, type };
}
