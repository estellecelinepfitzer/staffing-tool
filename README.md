# People Platform

Internal platform for team management, goal tracking, and 360° performance reviews.

---

## Features

- **Weekly check-ins** — each team member submits capacity and comments every Monday; the dashboard auto-refreshes live
- **Goals dashboard** — company goals and personal goals with progress tracking, H1/H2/full-year timeline filters, and linked sub-goals
- **360° review cycles** — self-review, peer review, and manager review forms with auto-save, rating scales, and PDF export
- **Admin panel** — manage team members, review cycles, custom questions, and goal assignments
- **Password-protected access** — each person authenticates via their private link; admin has a separate password

---

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The SQLite database is created automatically at `./data/staffing.db` on first run.

---

## Team members

Team members are managed in the **Admin panel** (`/admin`). Each person gets a private token-based URL. To add or remove members, use the admin UI — no code changes needed.

---

## Environment variables

| Variable | Purpose |
|---|---|
| `ADMIN_PASSWORD` | Password for the `/admin` page |
| `DASHBOARD_PASSWORD` | Password for the check-in dashboard |
| `PASSWORD_<TOKEN>` | Per-member password (uppercase token, hyphens → underscores) |

Set these in a `.env.local` file locally or in Railway's environment settings.

---

## Deploying

The app is deployed on **Railway** with a persistent volume for the SQLite database.

```bash
# Push to main — Railway deploys automatically
git push origin main
```

> The SQLite database lives on a Railway volume mounted at `/data`. Do not deploy to Vercel or any platform with ephemeral storage.

---

## Project structure

```
config/team.ts              — Team seed data and auth helpers
lib/db.ts                   — SQLite schema, migrations, and all DB queries
lib/auth.ts                 — Signed-token cookie authentication
lib/reviewQuestions.ts      — Question definitions and rating scale labels

app/checkin/                — Weekly check-in form (per member)
app/dashboard/              — Live check-in dashboard (read-only)
app/my-reviews/             — Member's review overview page
app/goals/                  — Goals dashboard (company + personal goals)
app/admin/                  — Admin panel (members, cycles, questions, goals)

app/review/self/            — Self-review form
app/review/peer/            — Peer review form
app/review/manager/         — Manager review form (includes self + peer responses)
app/review/final/           — Final review view (released to employee)
app/review/shared/          — Shared read-only review view

app/api/checkin/            — API: submit / fetch check-ins
app/api/review/             — API: responses, goals, submit, release, signoff
app/api/admin/              — API: team, cycles, questions, goals management

data/staffing.db            — Auto-created SQLite database (git-ignored)
```
