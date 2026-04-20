// Server-only — cookie signing utilities.
import { createHmac, timingSafeEqual } from 'crypto';

const SECRET =
  process.env.COOKIE_SECRET ?? 'staffing-tool-internal-secret-change-in-prod';

export const COOKIE_NAME = 'checkin_session';
export const DASHBOARD_COOKIE_NAME = 'dashboard_session';

/** Hash a password for storage. Uses HMAC-SHA256 keyed with the app secret. */
export function hashPassword(password: string): string {
  return createHmac('sha256', SECRET).update(password).digest('hex');
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
