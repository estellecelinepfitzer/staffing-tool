// ─── Team configuration ────────────────────────────────────────────────────
// Edit this file to add or remove team members.
// Each member needs a unique `token` — this becomes their private check-in URL:
//   /checkin?token=<token>
//
// Passwords are stored securely in Railway environment variables, NOT here.
// Set one env var per person in Railway → Variables:
//   PASSWORD_ESTELLE_PFZ=somepassword
//   PASSWORD_KATRIN_VAT=somepassword
//   ... (token uppercased, hyphens → underscores, prefixed with PASSWORD_)
// Dashboard password: DASHBOARD_PASSWORD=somepassword
// ───────────────────────────────────────────────────────────────────────────

export interface TeamMember {
  name: string;
  token: string;
}

export const TEAM_MEMBERS: TeamMember[] = [
  { name: 'Estelle Pfitzer',    token: 'estelle-pfz'   },
  { name: 'Katrin Vatiska',     token: 'katrin-vat'    },
  { name: 'Magdalena Plotczyk', token: 'magdalena-plt' },
  { name: 'Marton Kenessey',    token: 'marton-ken'    },
  { name: 'Teresa Pla Prats',   token: 'teresa-plp'    },
  { name: 'Tim Schneider',      token: 'tim-sch'       },
  { name: 'Jean Wallerand',     token: 'jean-wal'      },
];

export function getMemberByToken(token: string): TeamMember | undefined {
  return TEAM_MEMBERS.find((m) => m.token === token);
}

// Password to view the dashboard — change this to whatever you like
export const ADMIN_PASSWORD = 'monday2026';
