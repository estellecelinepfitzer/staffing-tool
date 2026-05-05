// Server-only helper to check admin authentication
import { cookies } from 'next/headers';
import { verifySignedToken, ADMIN_COOKIE_NAME, COOKIE_NAME, DASHBOARD_COOKIE_NAME } from './auth';
import { getTeamMember } from './db';

/** Check if the current request is from an admin user (admin page). */
export function isAdminAuthenticated(): boolean {
  const cookieStore = cookies();

  // New: role-based auth — logged-in user with role = 'admin'
  const session = cookieStore.get(COOKIE_NAME);
  if (session) {
    const memberToken = verifySignedToken(session.value);
    if (memberToken) {
      const member = getTeamMember(memberToken);
      if (member?.role === 'admin') return true;
    }
  }

  // Legacy: hardcoded admin cookie (kept for backward compat during transition)
  const adminSession = cookieStore.get(ADMIN_COOKIE_NAME);
  if (adminSession && verifySignedToken(adminSession.value) === 'admin') return true;

  return false;
}

/**
 * Check if the current request has admin API access.
 * Accepts both the new role-based session and the legacy dashboard cookie.
 */
export function isAdminRequest(): boolean {
  const cookieStore = cookies();

  // New: role-based auth
  const session = cookieStore.get(COOKIE_NAME);
  if (session) {
    const memberToken = verifySignedToken(session.value);
    if (memberToken) {
      const member = getTeamMember(memberToken);
      if (member?.role === 'admin') return true;
    }
  }

  // Legacy: dashboard cookie
  const dashSession = cookieStore.get(DASHBOARD_COOKIE_NAME);
  if (dashSession && verifySignedToken(dashSession.value) === 'dashboard') return true;

  return false;
}
