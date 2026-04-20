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


