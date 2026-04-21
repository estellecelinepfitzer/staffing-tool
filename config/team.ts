// ─── Team configuration ────────────────────────────────────────────────────
// Team members are now stored in the SQLite database (team_members table).
// This file holds only constants and server-side lookup helpers.
// ───────────────────────────────────────────────────────────────────────────

import { getTeamMember, getActiveTeamMembers, type TeamMemberRow } from '@/lib/db';

export type TeamMember = TeamMemberRow;

// Re-export for convenience
export { getActiveTeamMembers as getTeamMembers };

/**
 * Look up a team member by their URL token.
 * Returns undefined if not found or inactive.
 */
export function getMemberByToken(token: string): TeamMember | undefined {
  const member = getTeamMember(token);
  if (!member || member.active === 0) return undefined;
  return member;
}

// Password to view the dashboard / admin — change in .env or Railway env vars
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'monday2026';

// TEAM_MEMBERS kept for the checkin dashboard (reads active members from DB)
export const TEAM_MEMBERS: TeamMember[] = [];
// Note: use getActiveTeamMembers() from lib/db for a fresh list at request time.
