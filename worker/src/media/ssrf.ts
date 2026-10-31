/**
 * Guards for fetching a user/agent-supplied URL from the Worker: https only,
 * public hosts only. `global_fetch_strictly_public` is the runtime backstop;
 * this refuses obviously private targets up front and on every redirect hop.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

const PRIVATE_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.lan', '.home', '.corp', '.intranet'];

function ipv4Blocked(a: number, b: number): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

function hostBlocked(host: string): boolean {
  // IPv6 literals (bracketed): nobody serves a demo clip from a raw IPv6 address.
  if (host.startsWith('[') || host.includes(':')) return true;
  if (host === 'localhost' || PRIVATE_SUFFIXES.some((s) => host.endsWith(s))) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) return ipv4Blocked(Number(v4[1]), Number(v4[2]));
  // Anything else numeric-looking (hex/decimal/octal forms) or a bare single label is refused.
  if (/^[0-9a-fx.]+$/i.test(host) && /\d/.test(host)) return true;
  return !host.includes('.');
}

/** Returns the parsed URL, or throws UnsafeUrlError. */
export function assertPublicHttpsUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('Invalid URL.');
  }
  if (url.protocol !== 'https:') throw new UnsafeUrlError('URL must be https.');
  if (url.username || url.password) throw new UnsafeUrlError('URLs with credentials are not allowed.');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (hostBlocked(host)) throw new UnsafeUrlError('Private network URLs are not allowed.');
  return url;
}
