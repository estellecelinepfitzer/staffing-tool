// Server-only helper to check admin authentication
import { cookies } from 'next/headers';
import { verifySignedToken, ADMIN_COOKIE_NAME, COOKIE_NAME, DASHBOARD_COOKIE_NAME } from './auth';
import { getTeamMember } from './db';

function hasAdminSession(): boolean {
  const cookieStore = cookies();

  // Role-based auth (new): logged-in user with role = 'admin'
  const session = cookieStore.get(COOKIE_NAME);
  if (session) {
    const memberToken = verifySignedToken(session.value);
    if (memberToken) {
      const member = getTeamMember(memberToken);
      if (member?.role === 'admin') return true;
    }
  }

  // Legacy admin cookie
  const adminSession = cookieStore.get(ADMIN_COOKIE_NAME);
  if (adminSession && verifySignedToken(adminSession.value) === 'admin') return true;

  // Legacy dashboard cookie
  const dashSession = cookieStore.get(DASHBOARD_COOKIE_NAME);
  if (dashSession && verifySignedToken(dashSession.value) === 'dashboard') return true;

  return false;
}

/** Used by the admin page server component. */
export function isAdminAuthenticated(): boolean {
  return hasAdminSession();
}

/** Used by admin API routes. */
export function isAdminRequest(): boolean {
  return hasAdminSession();
}
