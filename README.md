# Monday Staffing Tool

A lightweight internal check-in app for the Monday morning team meeting. Replaces PerformYard weekly stand-ups.

---

## How it works

- Each team member has a **private URL** — `http://localhost:3000/checkin?token=<token>`
- The **dashboard** at `/dashboard` shows all submissions for the current week, auto-refreshing every 60 seconds
- One submission per person per ISO week (Mon–Sun); submitting again updates the existing entry

---

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to `/dashboard`.

The SQLite database is created automatically at `./data/standup.db` on first request.

---

## Adding or removing team members

Edit **`config/team.ts`** — it's the single source of truth for the team list.

```ts
export const TEAM_MEMBERS: TeamMember[] = [
  { name: 'New Person',  token: 'newperson-xyz' },
  // ...
];
```

- **Add** a new `{ name, token }` entry. The token becomes their check-in URL parameter — keep it short and unguessable.
- **Remove** an entry to hide them from future dashboards (past data in the DB is unaffected).
- No restart required after editing when using `npm run dev`.

### Personal check-in URLs

| Name               | URL                                          |
|--------------------|----------------------------------------------|
| Estelle Pfitzer    | `/checkin?token=estelle-pfz`    |
| Katrin Vatiska     | `/checkin?token=katrin-vat`     |
| Magdalena Plotczyk | `/checkin?token=magdalena-plt`  |
| Marton Kenessey    | `/checkin?token=marton-ken`     |
| Teresa Pla Prats   | `/checkin?token=teresa-plp`     |
| Tim Schneider      | `/checkin?token=tim-sch`        |
| Jean Wallerand     | `/checkin?token=jean-wal`       |

---

## Deploying to Vercel

```bash
npx vercel --prod
```

> **Note on persistence:** Vercel's serverless functions have ephemeral file systems, so the SQLite database will not persist between cold starts. For a long-running production deployment, swap `lib/db.ts` to use [Turso](https://turso.tech) (libSQL / SQLite-compatible) or another persistent store. For a single-team use case behind a long-lived server (Railway, Fly, a VPS), the SQLite setup works fine as-is.

---

## Project structure

```
config/team.ts          — Team member list (edit this to manage the team)
lib/db.ts               — SQLite access (server-only)
lib/weeks.ts            — ISO week utilities (shared)
app/checkin/            — Personal check-in form
app/dashboard/          — Read-only team dashboard
app/api/checkin/        — API: submit / fetch a check-in
app/api/dashboard/      — API: fetch week data for the dashboard
data/standup.db         — Auto-created SQLite database (git-ignored)
```
