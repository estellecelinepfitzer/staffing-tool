// ─── Team configuration ────────────────────────────────────────────────────
// Edit this file to add or remove team members.
// Each member needs a unique `token` — this becomes their private check-in URL:
//   /checkin?token=<token>
// Change each person's `password` to whatever you like — they enter it once
// and get a 7-day session cookie. Passwords are stored in plain text here
// since this is a private repo for a trusted internal team.
// ───────────────────────────────────────────────────────────────────────────

export interface TeamMember {
  name: string;
  token: string;
  password: string;
}

export const TEAM_MEMBERS: TeamMember[] = [
  { name: 'Estelle Pfitzer',    token: 'estelle-pfz',   password: 'estelle2026'   },
  { name: 'Katrin Vatiska',     token: 'katrin-vat',    password: 'katrin2026'    },
  { name: 'Magdalena Plotczyk', token: 'magdalena-plt', password: 'magdalena2026' },
  { name: 'Marton Kenessey',    token: 'marton-ken',    password: 'marton2026'    },
  { name: 'Teresa Pla Prats',   token: 'teresa-plp',    password: 'teresa2026'    },
  { name: 'Tim Schneider',      token: 'tim-sch',       password: 'tim2026'       },
  { name: 'Jean Wallerand',     token: 'jean-wal',      password: 'jean2026'      },
];

export function getMemberByToken(token: string): TeamMember | undefined {
  return TEAM_MEMBERS.find((m) => m.token === token);
}
