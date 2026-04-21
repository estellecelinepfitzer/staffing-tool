// Server-only helper to check admin session cookie
import { cookies } from 'next/headers';
import { verifySignedToken, DASHBOARD_COOKIE_NAME } from './auth';

export function isAdminAuthenticated(): boolean {
  const cookieStore = cookies();
  const session = cookieStore.get(DASHBOARD_COOKIE_NAME);
  if (!session) return false;
  return verifySignedToken(session.value) === 'dashboard';
}
