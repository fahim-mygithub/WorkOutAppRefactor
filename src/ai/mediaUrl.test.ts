import { describe, it, expect } from 'vitest';
import { isDemoMediaUrl } from './mediaUrl';

describe('isDemoMediaUrl', () => {
  it.each(['https://x/a.mp4', 'https://x/a.webm', 'https://x/a.GIF?y=1', 'https://x/p/a.Mp4#t=1'])(
    'accepts %s',
    (url) => expect(isDemoMediaUrl(url)).toBe(true),
  );

  it.each(['javascript:alert(1)', 'http://x/a.mp4', 'https://x/page', 'https://x/a.mp4.html', 'a.mp4', '', 'https://x/?f=a.mp4'])(
    'rejects %s',
    (url) => expect(isDemoMediaUrl(url)).toBe(false),
  );
});
