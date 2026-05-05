// Server-only helper to check admin authentication
import { cookies } from 'next/headers';
import { verifySignedToken, COOKIE_NAME } from './auth';
import { getTeamMember } from './db';

/** Returns true only if the current session belongs to a role=admin member. */
function hasAdminSession(): boolean {
  const session = cookies().get(COOKIE_NAME);
  if (!session) return false;
  const memberToken = verifySignedToken(session.value);
  if (!memberToken) return false;
  const member = getTeamMember(memberToken);
  return member?.role === 'admin';
}

export function isAdminAuthenticated(): boolean {
  return hasAdminSession();
}

export function isAdminRequest(): boolean {
  return hasAdminSession();
}
