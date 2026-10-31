/**
 * Storage helpers for Cloudflare R2 media objects with ownership assertions.
 */

const KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_-]{1,128}\.[a-z0-9]{3,4}$/;

export class MediaSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaSecurityError';
  }
}

/**
 * Asserts that the caller is the owner of the target media path.
 * Refuses cross-uid writes.
 */
export function assertMediaOwner(targetUid: string, callerUid: string): void {
  if (!targetUid || !callerUid || targetUid !== callerUid) {
    throw new MediaSecurityError('Cross-UID media access refused: caller cannot write to another user path.');
  }
}

/**
 * Validates the media object key structure and verifies caller ownership if expectedUid is given.
 */
export function validateMediaKey(key: string, expectedUid?: string): { uid: string; fileWithExt: string; id: string; ext: string } {
  if (!KEY_PATTERN.test(key)) {
    throw new MediaSecurityError('Invalid media key format.');
  }
  const [uid, fileWithExt] = key.split('/');
  if (expectedUid && uid !== expectedUid) {
    throw new MediaSecurityError(`Cross-UID media write refused: key uid "${uid}" does not match authenticated user "${expectedUid}".`);
  }
  const dotIndex = fileWithExt.lastIndexOf('.');
  const id = fileWithExt.slice(0, dotIndex);
  const ext = fileWithExt.slice(dotIndex + 1);
  return { uid, fileWithExt, id, ext };
}

/**
 * Generates a random, unguessable media ID.
 */
export function generateMediaId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

/**
 * Builds the canonical R2 storage key: `<uid>/<id>.<ext>`.
 */
export function buildMediaKey(uid: string, id: string, ext: string): string {
  const cleanExt = ext.toLowerCase().replace(/^\./, '');
  return `${uid}/${id}.${cleanExt}`;
}
