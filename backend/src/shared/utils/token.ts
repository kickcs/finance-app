import { randomBytes } from 'crypto';

/**
 * Generates a URL-safe random token of the given length using crypto.randomBytes,
 * base64url-encoded (alphabet: A-Z a-z 0-9 - _). Avoids adding a nanoid dependency
 * (NestJS compiles to CJS, and modern nanoid versions are ESM-only).
 */
export function generateUrlSafeToken(length = 21): string {
  // base64url encoding produces ~4/3 chars per byte; over-allocate then trim.
  const bytesNeeded = Math.ceil((length * 3) / 4) + 2;
  return randomBytes(bytesNeeded).toString('base64url').slice(0, length);
}
