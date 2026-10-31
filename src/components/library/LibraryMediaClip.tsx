import { useState } from 'react';
import { Dumbbell } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { transformVideoUrl } from '../../utils/videoHelpers';
import { detectMediaKind } from '../../ai/mediaUpload';

export interface LibraryMediaClipProps {
  url: string;
  alt?: string;
  className?: string;
  contain?: boolean;
}

/**
 * Media display implementing the Tempo clip pattern:
 * - Shows a dumbbell glyph placeholder behind the media
 * - Fades in once loaded (opacity-0 -> opacity-100)
 * - Renders GIFs as <img>
 * - Renders photos (jpg, png, webp, heic) as <img>
 * - Renders videos (mp4, webm, mov) as muted, looping <video>
 * - Never shows a black box or broken icon on error
 */
export function LibraryMediaClip({
  url,
  alt = 'Exercise demo',
  className,
  contain = false,
}: LibraryMediaClipProps) {
  const reduced = useReducedMotion() ?? false;
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  if (!url) {
    return (
      <div
        className={cn(
          'relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl bg-surface-raised',
          className,
        )}
      >
        <Dumbbell className="h-8 w-8 text-ink-subtle/60" aria-hidden="true" />
      </div>
    );
  }

  const kind = detectMediaKind({ name: url }) || (/\.(mp4|webm|mov)$/i.test(url) ? 'video' : 'photo');
  const src = transformVideoUrl(url);

  const mediaClass = cn(
    'relative h-full w-full transition-opacity duration-300',
    contain ? 'object-contain' : 'object-cover',
    loaded ? 'opacity-100' : 'opacity-0',
  );

  return (
    <div
      className={cn(
        'relative aspect-video w-full overflow-hidden rounded-2xl bg-surface-raised',
        className,
      )}
    >
      {/* Quiet glyph placeholder while loading or if playback fails */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Dumbbell className="h-8 w-8 text-ink-subtle/60" aria-hidden="true" />
      </div>

      {!errored && src && (
        kind === 'video' ? (
          <video
            src={src}
            className={mediaClass}
            muted
            loop
            autoPlay={!reduced}
            playsInline
            preload="auto"
            disablePictureInPicture
            onLoadedData={() => setLoaded(true)}
            onError={() => setErrored(true)}
          />
        ) : (
          <img
            src={src}
            alt={alt}
            className={mediaClass}
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
          />
        )
      )}
    </div>
  );
}
