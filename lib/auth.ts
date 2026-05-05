// Server-only — cookie signing utilities.
import { createHmac, timingSafeEqual, scryptSync, randomBytes } from 'crypto';

const SECRET =
  process.env.COOKIE_SECRET ?? 'staffing-tool-internal-secret-change-in-prod';

export const COOKIE_NAME = 'checkin_session';
export const DASHBOARD_COOKIE_NAME = 'dashboard_session';
export const ADMIN_COOKIE_NAME = 'admin_session';

/** Hash a password for storage. Uses HMAC-SHA256 keyed with the app secret. */
export function hashPassword(password: string): string {
  return createHmac('sha256', SECRET).update(password).digest('hex');
}

/**
 * Hash a user password using scrypt for storage in the passwords table.
 * Returns "scrypt$<salt>$<hash>".
 */
export function hashUserPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

/**
 * Verify a password against a stored scrypt hash.
 */
export function verifyUserPassword(password: string, stored: string): boolean {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const parts = stored.split('$');
  if (parts.length !== 3) return false;
  const [, salt, hash] = parts;
  try {
    const derived = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** Returns a signed value: "<token>.<hmac>" */
export function signToken(token: string): string {
  const sig = createHmac('sha256', SECRET).update(token).digest('hex');
  return `${token}.${sig}`;
}

/**
 * Verifies a signed cookie value.
 * Returns the token string if valid, null if tampered or malformed.
 */
export function verifySignedToken(signed: string): string | null {
  const lastDot = signed.lastIndexOf('.');
  if (lastDot === -1) return null;

  const token = signed.slice(0, lastDot);
  const sig = signed.slice(lastDot + 1);
  const expected = createHmac('sha256', SECRET).update(token).digest('hex');

  // Constant-time comparison to prevent timing attacks
  try {
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return null;
    return timingSafeEqual(a, b) ? token : null;
  } catch {
    return null;
  }
}
