/**
 * Share ID Generator Utility
 * Generates short, URL-friendly unique identifiers for shared workouts
 */

// Custom alphabet that avoids confusing characters (0, O, 1, l, I)
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const ID_LENGTH = 8; // Generates ~2.8 trillion possible combinations

/**
 * Generate a cryptographically secure random share ID
 */
export const generateShareId = (): string => {
  // Use crypto.getRandomValues for better randomness
  const array = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(array);

  return Array.from(array)
    .map(byte => ALPHABET[byte % ALPHABET.length])
    .join('');
};

/**
 * Validate share ID format
 */
export const isValidShareId = (shareId: string): boolean => {
  if (!shareId || shareId.length !== ID_LENGTH) {
    return false;
  }

  // Check if all characters are from our alphabet
  return shareId.split('').every(char => ALPHABET.includes(char));
};

/**
 * Generate a share URL for a given share ID
 */
export const generateShareUrl = (shareId: string, baseUrl?: string): string => {
  const base = baseUrl || window.location.origin;
  return `${base}/build/shared/${shareId}`;
};

/**
 * Extract share ID from a share URL
 */
export const extractShareIdFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    // Support both /build/shared/ and /workout/shared/ for backward compatibility
    const pathMatch = urlObj.pathname.match(/\/(build|workout)\/shared\/([^\/\?]+)/);

    if (pathMatch && pathMatch[2]) {
      const shareId = pathMatch[2];
      return isValidShareId(shareId) ? shareId : null;
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Generate multiple unique share IDs (useful for bulk operations or testing)
 */
export const generateMultipleShareIds = (count: number): string[] => {
  const ids = new Set<string>();

  while (ids.size < count) {
    ids.add(generateShareId());
  }

  return Array.from(ids);
};