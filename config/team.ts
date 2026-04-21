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
// ─── Team seed data ────────────────────────────────────────────────────────
// This file seeds the database on first run.
// After that, manage users from the Admin page (/admin).
//
// Passwords: set as Railway env vars — PASSWORD_<TOKEN_UPPER_SNAKE>=value
// Dashboard password: DASHBOARD_PASSWORD
// Admin password:     ADMIN_PASSWORD
// ───────────────────────────────────────────────────────────────────────────

export interface TeamMemberSeed {
  name: string;
  token: string;
  email: string;
}

export const TEAM_MEMBERS_SEED: TeamMemberSeed[] = [
  { name: 'Estelle Pfitzer',    token: 'estelle-pfz',   email: 'estellepfitzer@mtip.ch'   },
  { name: 'Katrin Vatiska',     token: 'katrin-vat',    email: 'katrin.vatiska@mtip.ch'   },
  { name: 'Magdalena Plotczyk', token: 'magdalena-plt', email: 'magdalena.plotczyk@mtip.ch' },
  { name: 'Marton Kenessey',    token: 'marton-ken',    email: 'marton.kenessey@mtip.ch'  },
  { name: 'Teresa Pla Prats',   token: 'teresa-plp',    email: 'teresa.plaprats@mtip.ch'  },
  { name: 'Tim Schneider',      token: 'tim-sch',       email: 'tim.schneider@mtip.ch'    },
  { name: 'Jean Wallerand',     token: 'jean-wal',      email: 'jean.wallerand@mtip.ch'   },
];


