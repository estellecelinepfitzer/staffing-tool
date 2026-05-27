// Server-only module — never import this from a Client Component.
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import {
  SELF_REVIEW_QUESTIONS,
  PEER_REVIEW_QUESTIONS,
  MANAGER_REVIEW_QUESTIONS,
} from './reviewQuestions';
import { hashUserPassword, verifyUserPassword } from './auth';

export { verifyUserPassword };

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'standup.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

// ─── Migration helper ─────────────────────────────────────────────────────────

function addColumnIfMissing(db: Database.Database, table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.find((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_MEMBERS = [
  { token: 'christoph-kau', name: 'Christoph Kausch',         email: 'christoph.kausch@mtip.ch',       password: 'christoph2026' },
  { token: 'anja-pet',      name: 'Anja Peter',               email: 'anja.peter@mtip.ch',             password: 'anja2026'      },
  { token: 'carmen-bru',    name: 'Carmen Bruneau',           email: 'carmen.bruneau@mtip.ch',         password: 'carmen2026'    },
  { token: 'christoph-vdm', name: 'Christoph Vonder Mühll',  email: 'christoph.vondermuehll@mtip.ch', password: 'christoph2026' },
  { token: 'estelle-pfz',   name: 'Estelle Pfitzer',          email: 'estellepfitzer@mtip.ch',         password: 'estelle2026'   },
  { token: 'jean-wal',      name: 'Jean Wallerand',           email: 'jean.wallerand@mtip.ch',         password: 'jean2026'      },
  { token: 'katrin-vat',    name: 'Katrin Vatiska',           email: 'katrin.vatiska@mtip.ch',         password: 'katrin2026'    },
  { token: 'magdalena-plt', name: 'Magdalena Plotczyk',       email: 'magdalena.plotczyk@mtip.ch',     password: 'magdalena2026' },
  { token: 'marton-ken',    name: 'Marton Kenessey',          email: 'marton.kenessey@mtip.ch',        password: 'marton2026'    },
  { token: 'natalia-sur',   name: 'Natalia Surkova',          email: 'natalia.surkova@mtip.ch',        password: 'natalia2026'   },
  { token: 'rahel-haf',     name: 'Rahel Hafner',             email: 'rahel.hafner@mtip.ch',           password: 'rahel2026'     },
  { token: 'teresa-plp',    name: 'Teresa Pla Prats',         email: 'teresa.plaprats@mtip.ch',        password: 'teresa2026'    },
  { token: 'tim-sch',       name: 'Tim Schneider',            email: 'tim.schneider@mtip.ch',          password: 'tim2026'       },
];

// ─── Schema init ──────────────────────────────────────────────────────────────

function initSchema(db: Database.Database) {
  // ── Checkins (existing) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS checkins (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      member_token   TEXT    NOT NULL,
      member_name    TEXT    NOT NULL,
      iso_week       INTEGER NOT NULL,
      iso_year       INTEGER NOT NULL,
      submitted_at   TEXT    NOT NULL,
      mood           INTEGER NOT NULL,
      capacity       INTEGER NOT NULL,
      sourcing       TEXT    NOT NULL DEFAULT '',
      converting     TEXT    NOT NULL DEFAULT '',
      execution      TEXT    NOT NULL DEFAULT '',
      portfolio_exits TEXT   NOT NULL DEFAULT '',
      portfolio_other TEXT   NOT NULL DEFAULT '',
      UNIQUE(member_token, iso_week, iso_year)
    )
  `);
  addColumnIfMissing(db, 'checkins', 'working_days',         'REAL NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'checkins', 'sourcing_days',        'REAL NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'checkins', 'converting_days',      'REAL NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'checkins', 'execution_days',       'REAL NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'checkins', 'portfolio_exits_days', 'REAL NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'checkins', 'portfolio_other_days', 'REAL NOT NULL DEFAULT 0');

  // ── Team members ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS team_members (
      token         TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL DEFAULT '',
      password      TEXT NOT NULL DEFAULT '',
      manager_token TEXT NOT NULL DEFAULT '',
      active        INTEGER NOT NULL DEFAULT 1
    )
  `);
  addColumnIfMissing(db, 'team_members', 'email',         'TEXT NOT NULL DEFAULT \'\'');
  addColumnIfMissing(db, 'team_members', 'password',      'TEXT NOT NULL DEFAULT \'\'');
  addColumnIfMissing(db, 'team_members', 'manager_token', 'TEXT NOT NULL DEFAULT \'\'');
  addColumnIfMissing(db, 'team_members', 'active',        'INTEGER NOT NULL DEFAULT 1');
  addColumnIfMissing(db, 'team_members', 'role',          "TEXT NOT NULL DEFAULT 'member'");

  // Seed team_members on first run (or upsert if already exists to keep in sync)
  const upsertMember = db.prepare(`
    INSERT INTO team_members (token, name, email, password, manager_token, active)
    VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT(token) DO UPDATE SET
      name  = excluded.name,
      email = excluded.email,
      active = 1
  `);
  // Note: password and manager_token are NOT overwritten on conflict — admin manages those
  const seedAll = db.transaction(() => {
    for (const m of SEED_MEMBERS) {
      const existing = db.prepare('SELECT token FROM team_members WHERE token = ?').get(m.token);
      if (!existing) {
        upsertMember.run(m.token, m.name, m.email, m.password, m.token);
      } else {
        // Only update name/email, not password or manager_token
        db.prepare('UPDATE team_members SET name = ?, email = ? WHERE token = ?')
          .run(m.name, m.email, m.token);
      }
    }
  });
  seedAll();

  // Always ensure the two seed admins have admin role (other admins managed via admin page)
  db.prepare("UPDATE team_members SET role = 'admin' WHERE token IN ('christoph-kau', 'estelle-pfz')").run();

  // passwords table must exist before the seed code below queries it
  db.exec(`
    CREATE TABLE IF NOT EXISTS passwords (
      member_token  TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    )
  `);

  // Seed password hashes on first run (only if passwords table is empty)
  const passwordCount = (db.prepare('SELECT COUNT(*) as n FROM passwords').get() as { n: number }).n;
  if (passwordCount === 0) {
    const insertHash = db.prepare(
      'INSERT OR IGNORE INTO passwords (member_token, password_hash, updated_at) VALUES (?, ?, ?)',
    );
    const now = new Date().toISOString();
    const seedTx = db.transaction(() => {
      for (const m of SEED_MEMBERS) {
        insertHash.run(m.token, hashUserPassword(m.password), now);
      }
    });
    seedTx();
    console.log('[init] Password hashes seeded. Default credentials:');
    for (const m of SEED_MEMBERS) {
      console.log(`  ${m.email}  /  ${m.password}`);
    }
  }

  // ── Review cycles ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS review_cycles (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      status      TEXT    NOT NULL DEFAULT 'draft',
      self_due    TEXT,
      peer_due    TEXT,
      manager_due TEXT,
      created_at  TEXT    NOT NULL
    )
  `);

  // ── Review assignments ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS review_assignments (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id       INTEGER NOT NULL REFERENCES review_cycles(id),
      reviewer_token TEXT    NOT NULL,
      subject_token  TEXT    NOT NULL,
      type           TEXT    NOT NULL,
      status         TEXT    NOT NULL DEFAULT 'pending',
      submitted_at   TEXT,
      removed        INTEGER NOT NULL DEFAULT 0,
      UNIQUE(cycle_id, reviewer_token, subject_token, type)
    )
  `);
  addColumnIfMissing(db, 'review_assignments', 'removed', 'INTEGER NOT NULL DEFAULT 0');

  // ── Review responses ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS review_responses (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL REFERENCES review_assignments(id),
      question_key  TEXT    NOT NULL,
      answer_text   TEXT,
      answer_number INTEGER,
      UNIQUE(assignment_id, question_key)
    )
  `);

  // ── Review signoffs ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS review_signoffs (
      id                       INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id                 INTEGER NOT NULL REFERENCES review_cycles(id),
      subject_token            TEXT    NOT NULL,
      manager_signed_at        TEXT,
      employee_acknowledged_at TEXT,
      UNIQUE(cycle_id, subject_token)
    )
  `);

  // ── Cycle goals ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS cycle_goals (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id      INTEGER NOT NULL REFERENCES review_cycles(id),
      subject_token TEXT    NOT NULL,
      body          TEXT    NOT NULL,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT    NOT NULL
    )
  `);

  // ── Member goals (per-person, not per-cycle) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS member_goals (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      member_token  TEXT NOT NULL,
      body          TEXT NOT NULL,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL
    )
  `);
  addColumnIfMissing(db, 'member_goals', 'company_goal_id', 'INTEGER');
  addColumnIfMissing(db, 'member_goals', 'description',     'TEXT NOT NULL DEFAULT \'\'');
  addColumnIfMissing(db, 'member_goals', 'progress',        'REAL NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'member_goals', 'scale',            "TEXT NOT NULL DEFAULT 'percent_100'");
  addColumnIfMissing(db, 'member_goals', 'progress_comment',  "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, 'member_goals', 'manager_progress',  'REAL');
  addColumnIfMissing(db, 'member_goals', 'manager_comment',   "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, 'member_goals', 'timeline',          "TEXT NOT NULL DEFAULT 'full_year'");

  // ── Company-level goals ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS company_goals (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL
    )
  `);
  addColumnIfMissing(db, 'company_goals', 'scale',    "TEXT NOT NULL DEFAULT 'percent_100'");
  addColumnIfMissing(db, 'company_goals', 'timeline', "TEXT NOT NULL DEFAULT 'full_year'");

  // ── Cycle questions ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS cycle_questions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id      INTEGER NOT NULL REFERENCES review_cycles(id),
      review_type   TEXT    NOT NULL,
      question_key  TEXT    NOT NULL,
      question_text TEXT    NOT NULL,
      question_type TEXT    NOT NULL DEFAULT 'text',
      placeholder   TEXT,
      required      INTEGER NOT NULL DEFAULT 1,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      UNIQUE(cycle_id, review_type, question_key)
    )
  `);

  // ── Manager review shares ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS manager_review_shares (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id    INTEGER NOT NULL REFERENCES review_assignments(id),
      recipient_token  TEXT    NOT NULL,
      shared_at        TEXT    NOT NULL,
      UNIQUE(assignment_id, recipient_token)
    )
  `);
  // Migrations — add new columns to existing tables without breaking existing data
  addColumnIfMissing(db, 'checkins', 'working_days',        'REAL NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'checkins', 'sourcing_days',       'REAL NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'checkins', 'converting_days',     'REAL NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'checkins', 'execution_days',      'REAL NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'checkins', 'portfolio_exits_days','REAL NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'checkins', 'portfolio_other_days','REAL NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'team_members', 'checkin', 'INTEGER NOT NULL DEFAULT 1');
  addColumnIfMissing(db, 'team_members', 'password', 'TEXT NOT NULL DEFAULT ""');
  addColumnIfMissing(db, 'team_members', 'manager_token', 'TEXT NOT NULL DEFAULT ""');
  addColumnIfMissing(db, 'review_signoffs', 'released_at', 'TEXT');

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // ── Staffing categories ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      label       TEXT    NOT NULL,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      active      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL
    )
  `);

  // ── Per-checkin category responses (replaces hard-coded columns for new data) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS checkin_responses (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      checkin_id      INTEGER NOT NULL REFERENCES checkins(id),
      category_id     INTEGER NOT NULL REFERENCES categories(id),
      category_label  TEXT    NOT NULL,
      days            REAL    NOT NULL DEFAULT 0,
      notes           TEXT    NOT NULL DEFAULT '',
      UNIQUE(checkin_id, category_id)
    )
  `);

  // Seed the 5 original categories with explicit IDs so the legacy migration can rely on them.
  const now = new Date().toISOString();
  db.prepare(`INSERT OR IGNORE INTO categories (id, label, sort_order, active, created_at) VALUES (1, 'Sourcing',        0, 1, ?)`).run(now);
  db.prepare(`INSERT OR IGNORE INTO categories (id, label, sort_order, active, created_at) VALUES (2, 'Converting',      1, 1, ?)`).run(now);
  db.prepare(`INSERT OR IGNORE INTO categories (id, label, sort_order, active, created_at) VALUES (3, 'Execution',       2, 1, ?)`).run(now);
  db.prepare(`INSERT OR IGNORE INTO categories (id, label, sort_order, active, created_at) VALUES (4, 'Portfolio Exits', 3, 1, ?)`).run(now);
  db.prepare(`INSERT OR IGNORE INTO categories (id, label, sort_order, active, created_at) VALUES (5, 'Portfolio Other', 4, 1, ?)`).run(now);

  // Migrate existing checkin data into checkin_responses (idempotent — skips rows that already exist).
  const legacyMap = [
    { id: 1, notesCol: 'sourcing',        daysCol: 'sourcing_days'        },
    { id: 2, notesCol: 'converting',      daysCol: 'converting_days'      },
    { id: 3, notesCol: 'execution',       daysCol: 'execution_days'       },
    { id: 4, notesCol: 'portfolio_exits', daysCol: 'portfolio_exits_days' },
    { id: 5, notesCol: 'portfolio_other', daysCol: 'portfolio_other_days' },
  ] as const;
  const catLabel = db.prepare('SELECT label FROM categories WHERE id = ?');
  const insertResp = db.prepare(`
    INSERT OR IGNORE INTO checkin_responses (checkin_id, category_id, category_label, days, notes)
    VALUES (?, ?, ?, ?, ?)
  `);
  const allCheckins = db.prepare('SELECT * FROM checkins').all() as Record<string, unknown>[];
  db.transaction(() => {
    for (const ci of allCheckins) {
      for (const { id, notesCol, daysCol } of legacyMap) {
        const row = catLabel.get(id) as { label: string } | undefined;
        if (!row) continue;
        insertResp.run(
          ci.id,
          id,
          row.label,
          (ci[daysCol] as number) ?? 0,
          (ci[notesCol] as string) ?? '',
        );
      }
    }
  })();

  // Backfill questions for existing cycles that have none
  const cycles = db.prepare('SELECT id FROM review_cycles').all() as { id: number }[];
  for (const { id } of cycles) {
    const count = db.prepare('SELECT COUNT(*) as n FROM cycle_questions WHERE cycle_id=?').get(id) as { n: number };
    if (count.n === 0) seedQuestionsForCycleWithDb(db, id, null);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Checkin {
  id: number;
  member_token: string;
  member_name: string;
  iso_week: number;
  iso_year: number;
  submitted_at: string;
  mood: number;
  capacity: number;
  sourcing: string;
  converting: string;
  execution: string;
  portfolio_exits: string;
  portfolio_other: string;
  working_days: number;
  sourcing_days: number;
  converting_days: number;
  execution_days: number;
  portfolio_exits_days: number;
  portfolio_other_days: number;
}

export interface TeamMemberRow {
  token: string;
  name: string;
  email: string;
  password: string;
  manager_token: string;
  active: number;
  checkin: number;
  role: string;
}

export type CycleStatus =
  | 'draft'
  | 'self_review_open'
  | 'peer_review_open'
  | 'manager_review_open'
  | 'closed';

export interface ReviewCycle {
  id: number;
  name: string;
  status: CycleStatus;
  self_due: string | null;
  peer_due: string | null;
  manager_due: string | null;
  created_at: string;
}

export type AssignmentType = 'self' | 'peer' | 'manager';
export type AssignmentStatus = 'pending' | 'submitted';

export interface ReviewAssignment {
  id: number;
  cycle_id: number;
  reviewer_token: string;
  subject_token: string;
  type: AssignmentType;
  status: AssignmentStatus;
  submitted_at: string | null;
  removed: number;
}

export interface ReviewResponse {
  id: number;
  assignment_id: number;
  question_key: string;
  answer_text: string | null;
  answer_number: number | null;
}

export interface ReviewSignoff {
  id: number;
  cycle_id: number;
  subject_token: string;
  manager_signed_at: string | null;
  employee_acknowledged_at: string | null;
  released_at: string | null;
}

// ─── Checkin queries ──────────────────────────────────────────────────────────

export function getCheckin(memberToken: string, isoWeek: number, isoYear: number): Checkin | undefined {
  return getDb()
    .prepare('SELECT * FROM checkins WHERE member_token = ? AND iso_week = ? AND iso_year = ?')
    .get(memberToken, isoWeek, isoYear) as Checkin | undefined;
}

export function upsertCheckin(data: Omit<Checkin, 'id'>): number {
  getDb()
    .prepare(`
      INSERT INTO checkins
        (member_token, member_name, iso_week, iso_year, submitted_at,
         mood, capacity, sourcing, converting, execution, portfolio_exits, portfolio_other,
         working_days, sourcing_days, converting_days, execution_days, portfolio_exits_days, portfolio_other_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(member_token, iso_week, iso_year) DO UPDATE SET
        member_name           = excluded.member_name,
        submitted_at          = excluded.submitted_at,
        mood                  = excluded.mood,
        capacity              = excluded.capacity,
        sourcing              = excluded.sourcing,
        converting            = excluded.converting,
        execution             = excluded.execution,
        portfolio_exits       = excluded.portfolio_exits,
        portfolio_other       = excluded.portfolio_other,
        working_days          = excluded.working_days,
        sourcing_days         = excluded.sourcing_days,
        converting_days       = excluded.converting_days,
        execution_days        = excluded.execution_days,
        portfolio_exits_days  = excluded.portfolio_exits_days,
        portfolio_other_days  = excluded.portfolio_other_days
    `)
    .run(
      data.member_token, data.member_name, data.iso_week, data.iso_year, data.submitted_at,
      data.mood, data.capacity,
      data.sourcing, data.converting, data.execution, data.portfolio_exits, data.portfolio_other,
      data.working_days, data.sourcing_days, data.converting_days,
      data.execution_days, data.portfolio_exits_days, data.portfolio_other_days,
    );
  // Always SELECT the ID after upsert — lastInsertRowid is 0 for ON CONFLICT DO UPDATE
  // (no new row inserted), so we cannot rely on it for the update path.
  const row = getDb()
    .prepare('SELECT id FROM checkins WHERE member_token = ? AND iso_week = ? AND iso_year = ?')
    .get(data.member_token, data.iso_week, data.iso_year) as { id: number } | undefined;
  if (!row) throw new Error(`upsertCheckin: row not found after upsert (token=${data.member_token} week=${data.iso_week}/${data.iso_year})`);
  return row.id;
}

export function getWeekCheckins(isoWeek: number, isoYear: number): Checkin[] {
  return getDb()
    .prepare('SELECT * FROM checkins WHERE iso_week = ? AND iso_year = ? ORDER BY submitted_at ASC')
    .all(isoWeek, isoYear) as Checkin[];
}

// ─── Team member queries ──────────────────────────────────────────────────────

export function getTeamMember(token: string): TeamMemberRow | undefined {
  return getDb()
    .prepare('SELECT * FROM team_members WHERE token = ?')
    .get(token) as TeamMemberRow | undefined;
}

/** Alias for getTeamMember — used by checkin routes */
export const getMemberByToken = getTeamMember;

export function getActiveTeamMembers(): TeamMemberRow[] {
  return getDb()
    .prepare('SELECT * FROM team_members WHERE active = 1 ORDER BY name ASC')
    .all() as TeamMemberRow[];
}

export function getAllTeamMembers(): TeamMemberRow[] {
  return getDb()
    .prepare('SELECT * FROM team_members ORDER BY name ASC')
    .all() as TeamMemberRow[];
}

export function updateManagerToken(token: string, managerToken: string): void {
  getDb()
    .prepare('UPDATE team_members SET manager_token = ? WHERE token = ?')
    .run(managerToken, token);
}

export function updateMemberPassword(token: string, password: string): void {
  getDb()
    .prepare('UPDATE team_members SET password = ? WHERE token = ?')
    .run(password, token);
}

export function setMemberActive(token: string, active: boolean): void {
  getDb()
    .prepare('UPDATE team_members SET active = ? WHERE token = ?')
    .run(active ? 1 : 0, token);
}

export function setMemberCheckin(token: string, checkin: boolean): void {
  getDb()
    .prepare('UPDATE team_members SET checkin = ? WHERE token = ?')
    .run(checkin ? 1 : 0, token);
}

export function setMemberRole(token: string, role: 'admin' | 'member'): void {
  getDb()
    .prepare("UPDATE team_members SET role = ? WHERE token = ?")
    .run(role, token);
}

export function getCheckinMembers(): TeamMemberRow[] {
  return getDb()
    .prepare('SELECT * FROM team_members WHERE active = 1 AND checkin = 1 ORDER BY name ASC')
    .all() as TeamMemberRow[];
}

export function deleteTeamMember(token: string): void {
  const db = getDb();
  // Children of checkins (FK: checkin_responses.checkin_id → checkins.id)
  db.prepare(`
    DELETE FROM checkin_responses
    WHERE checkin_id IN (SELECT id FROM checkins WHERE member_token = ?)
  `).run(token);
  // Children of review_assignments (FK: manager_review_shares.assignment_id → review_assignments.id)
  db.prepare(`
    DELETE FROM manager_review_shares
    WHERE assignment_id IN (
      SELECT id FROM review_assignments WHERE subject_token = ? OR reviewer_token = ?
    )
  `).run(token, token);
  // Children of review_assignments (FK: review_responses.assignment_id → review_assignments.id)
  db.prepare(`
    DELETE FROM review_responses
    WHERE assignment_id IN (
      SELECT id FROM review_assignments WHERE subject_token = ? OR reviewer_token = ?
    )
  `).run(token, token);
  db.prepare('DELETE FROM review_assignments WHERE subject_token = ? OR reviewer_token = ?').run(token, token);
  db.prepare('DELETE FROM review_signoffs   WHERE subject_token = ?').run(token);
  db.prepare('DELETE FROM checkins          WHERE member_token = ?').run(token);
  db.prepare('DELETE FROM member_goals      WHERE member_token = ?').run(token);
  db.prepare('DELETE FROM passwords         WHERE member_token = ?').run(token);
  db.prepare('DELETE FROM team_members      WHERE token = ?').run(token);
}

export function getTeamMemberByEmail(email: string): TeamMemberRow | undefined {
  return getDb()
    .prepare('SELECT * FROM team_members WHERE LOWER(email) = LOWER(?) AND active = 1')
    .get(email) as TeamMemberRow | undefined;
}

export function getUserPasswordHash(memberToken: string): string | null {
  const row = getDb()
    .prepare('SELECT password_hash FROM passwords WHERE member_token = ?')
    .get(memberToken) as { password_hash: string } | undefined;
  return row?.password_hash ?? null;
}

export function setUserPasswordHash(memberToken: string, hash: string): void {
  getDb()
    .prepare(`
      INSERT INTO passwords (member_token, password_hash, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(member_token) DO UPDATE SET
        password_hash = excluded.password_hash,
        updated_at    = excluded.updated_at
    `)
    .run(memberToken, hash, new Date().toISOString());
}

export function upsertTeamMember(data: Omit<TeamMemberRow, 'active'>): void {
  getDb()
    .prepare(`
      INSERT INTO team_members (token, name, email, password, manager_token, active)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(token) DO UPDATE SET
        name          = excluded.name,
        email         = excluded.email,
        password      = excluded.password,
        manager_token = excluded.manager_token,
        active        = 1
    `)
    .run(data.token, data.name, data.email, data.password, data.manager_token);
}

// ─── Review cycle queries ─────────────────────────────────────────────────────

export function createCycle(data: Omit<ReviewCycle, 'id'>): number {
  const result = getDb()
    .prepare(`
      INSERT INTO review_cycles (name, status, self_due, peer_due, manager_due, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(data.name, data.status, data.self_due, data.peer_due, data.manager_due, data.created_at);
  return result.lastInsertRowid as number;
}

export function getCycle(id: number): ReviewCycle | undefined {
  return getDb()
    .prepare('SELECT * FROM review_cycles WHERE id = ?')
    .get(id) as ReviewCycle | undefined;
}

export function getAllCycles(): ReviewCycle[] {
  return getDb()
    .prepare('SELECT * FROM review_cycles ORDER BY created_at DESC')
    .all() as ReviewCycle[];
}

export function deleteCycle(id: number): void {
  const db = getDb();
  const deleteShares = db.prepare(`
    DELETE FROM manager_review_shares WHERE assignment_id IN (
      SELECT id FROM review_assignments WHERE cycle_id = ?
    )
  `);
  const deleteResponses = db.prepare(`
    DELETE FROM review_responses WHERE assignment_id IN (
      SELECT id FROM review_assignments WHERE cycle_id = ?
    )
  `);
  const deleteAssignments = db.prepare('DELETE FROM review_assignments WHERE cycle_id = ?');
  const deleteSignoffs = db.prepare('DELETE FROM review_signoffs WHERE cycle_id = ?');
  const deleteGoals = db.prepare('DELETE FROM cycle_goals WHERE cycle_id = ?');
  const deleteQuestions = db.prepare('DELETE FROM cycle_questions WHERE cycle_id = ?');
  const deleteCycleStmt = db.prepare('DELETE FROM review_cycles WHERE id = ?');
  db.transaction(() => {
    deleteShares.run(id);
    deleteResponses.run(id);
    deleteAssignments.run(id);
    deleteSignoffs.run(id);
    deleteGoals.run(id);
    deleteQuestions.run(id);
    deleteCycleStmt.run(id);
  })();
}

export function updateCycle(id: number, data: Partial<Pick<ReviewCycle, 'name' | 'self_due' | 'peer_due' | 'manager_due'>>): void {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined)        { fields.push('name = ?');        values.push(data.name); }
  if (data.self_due !== undefined)    { fields.push('self_due = ?');    values.push(data.self_due); }
  if (data.peer_due !== undefined)    { fields.push('peer_due = ?');    values.push(data.peer_due); }
  if (data.manager_due !== undefined) { fields.push('manager_due = ?'); values.push(data.manager_due); }
  if (fields.length === 0) return;
  values.push(id);
  getDb().prepare(`UPDATE review_cycles SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function updateCycleStatus(id: number, status: CycleStatus): void {
  getDb()
    .prepare('UPDATE review_cycles SET status = ? WHERE id = ?')
    .run(status, id);
}

// ─── Review assignment queries ────────────────────────────────────────────────

export function createAssignment(data: Omit<ReviewAssignment, 'id' | 'status' | 'submitted_at' | 'removed'>): number {
  const result = getDb()
    .prepare(`
      INSERT INTO review_assignments (cycle_id, reviewer_token, subject_token, type, status, removed)
      VALUES (?, ?, ?, ?, 'pending', 0)
      ON CONFLICT(cycle_id, reviewer_token, subject_token, type) DO UPDATE SET
        removed = 0
    `)
    .run(data.cycle_id, data.reviewer_token, data.subject_token, data.type);
  return result.lastInsertRowid as number;
}

export function getAssignment(id: number): ReviewAssignment | undefined {
  return getDb()
    .prepare('SELECT * FROM review_assignments WHERE id = ?')
    .get(id) as ReviewAssignment | undefined;
}

export function getAssignmentByKey(
  cycleId: number,
  reviewerToken: string,
  subjectToken: string,
  type: AssignmentType,
): ReviewAssignment | undefined {
  return getDb()
    .prepare('SELECT * FROM review_assignments WHERE cycle_id = ? AND reviewer_token = ? AND subject_token = ? AND type = ?')
    .get(cycleId, reviewerToken, subjectToken, type) as ReviewAssignment | undefined;
}

export function getAssignmentsForReviewer(cycleId: number, reviewerToken: string): ReviewAssignment[] {
  return getDb()
    .prepare('SELECT * FROM review_assignments WHERE cycle_id = ? AND reviewer_token = ? AND removed = 0')
    .all(cycleId, reviewerToken) as ReviewAssignment[];
}

export function getPeerAssignmentsForSubject(cycleId: number, subjectToken: string): ReviewAssignment[] {
  return getDb()
    .prepare("SELECT * FROM review_assignments WHERE cycle_id = ? AND subject_token = ? AND type = 'peer' AND removed = 0")
    .all(cycleId, subjectToken) as ReviewAssignment[];
}

export function getSubmittedPeerAssignmentsForSubject(cycleId: number, subjectToken: string): ReviewAssignment[] {
  return getDb()
    .prepare("SELECT * FROM review_assignments WHERE cycle_id = ? AND subject_token = ? AND type = 'peer' AND status = 'submitted' AND removed = 0")
    .all(cycleId, subjectToken) as ReviewAssignment[];
}

export function getCycleAssignments(cycleId: number): ReviewAssignment[] {
  return getDb()
    .prepare('SELECT * FROM review_assignments WHERE cycle_id = ?')
    .all(cycleId) as ReviewAssignment[];
}

export function submitAssignment(id: number): void {
  getDb()
    .prepare("UPDATE review_assignments SET status = 'submitted', submitted_at = ? WHERE id = ?")
    .run(new Date().toISOString(), id);
}

export function removeAssignment(id: number): void {
  getDb()
    .prepare('UPDATE review_assignments SET removed = 1 WHERE id = ?')
    .run(id);
}

// ─── Review response queries ──────────────────────────────────────────────────

export function upsertResponse(assignmentId: number, questionKey: string, answerText: string | null, answerNumber: number | null): void {
  getDb()
    .prepare(`
      INSERT INTO review_responses (assignment_id, question_key, answer_text, answer_number)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(assignment_id, question_key) DO UPDATE SET
        answer_text   = excluded.answer_text,
        answer_number = excluded.answer_number
    `)
    .run(assignmentId, questionKey, answerText, answerNumber);
}

export function getResponses(assignmentId: number): ReviewResponse[] {
  return getDb()
    .prepare('SELECT * FROM review_responses WHERE assignment_id = ?')
    .all(assignmentId) as ReviewResponse[];
}

export function getResponsesForAssignments(assignmentIds: number[]): ReviewResponse[] {
  if (assignmentIds.length === 0) return [];
  const placeholders = assignmentIds.map(() => '?').join(',');
  return getDb()
    .prepare(`SELECT * FROM review_responses WHERE assignment_id IN (${placeholders})`)
    .all(...assignmentIds) as ReviewResponse[];
}

// ─── Review signoff queries ───────────────────────────────────────────────────

export function getSignoff(cycleId: number, subjectToken: string): ReviewSignoff | undefined {
  return getDb()
    .prepare('SELECT * FROM review_signoffs WHERE cycle_id = ? AND subject_token = ?')
    .get(cycleId, subjectToken) as ReviewSignoff | undefined;
}

export function ensureSignoff(cycleId: number, subjectToken: string): void {
  getDb()
    .prepare(`
      INSERT INTO review_signoffs (cycle_id, subject_token)
      VALUES (?, ?)
      ON CONFLICT(cycle_id, subject_token) DO NOTHING
    `)
    .run(cycleId, subjectToken);
}

export function managerSignOff(cycleId: number, subjectToken: string): void {
  ensureSignoff(cycleId, subjectToken);
  getDb()
    .prepare('UPDATE review_signoffs SET manager_signed_at = ? WHERE cycle_id = ? AND subject_token = ?')
    .run(new Date().toISOString(), cycleId, subjectToken);
}

export function employeeAcknowledge(cycleId: number, subjectToken: string): void {
  getDb()
    .prepare('UPDATE review_signoffs SET employee_acknowledged_at = ? WHERE cycle_id = ? AND subject_token = ?')
    .run(new Date().toISOString(), cycleId, subjectToken);
}

export function releaseManagerReview(cycleId: number, subjectToken: string): void {
  ensureSignoff(cycleId, subjectToken);
  getDb()
    .prepare('UPDATE review_signoffs SET released_at = ? WHERE cycle_id = ? AND subject_token = ?')
    .run(new Date().toISOString(), cycleId, subjectToken);
}

export function getCycleSignoffs(cycleId: number): ReviewSignoff[] {
  return getDb()
    .prepare('SELECT * FROM review_signoffs WHERE cycle_id = ?')
    .all(cycleId) as ReviewSignoff[];
}

// ─── New types ────────────────────────────────────────────────────────────────

export interface MemberGoal {
  id: number;
  member_token: string;
  body: string;
  sort_order: number;
  created_at: string;
}

export interface CycleGoal {
  id: number;
  cycle_id: number;
  subject_token: string;
  body: string;
  sort_order: number;
  created_at: string;
}

export interface CycleQuestion {
  id: number;
  cycle_id: number;
  review_type: string;
  question_key: string;
  question_text: string;
  question_type: string;
  placeholder: string | null;
  required: number;
  sort_order: number;
}

export interface ManagerReviewShare {
  id: number;
  assignment_id: number;
  recipient_token: string;
  shared_at: string;
}

// ─── Goal queries ─────────────────────────────────────────────────────────────

export function getCycleGoals(cycleId: number, subjectToken: string): CycleGoal[] {
  return getDb()
    .prepare('SELECT * FROM cycle_goals WHERE cycle_id = ? AND subject_token = ? ORDER BY sort_order ASC, id ASC')
    .all(cycleId, subjectToken) as CycleGoal[];
}

export function getAllGoalsForCycle(cycleId: number): CycleGoal[] {
  return getDb()
    .prepare('SELECT * FROM cycle_goals WHERE cycle_id = ? ORDER BY subject_token ASC, sort_order ASC, id ASC')
    .all(cycleId) as CycleGoal[];
}

export function createGoal(cycleId: number, subjectToken: string, body: string): number {
  const result = getDb()
    .prepare('INSERT INTO cycle_goals (cycle_id, subject_token, body, sort_order, created_at) VALUES (?, ?, ?, 0, ?)')
    .run(cycleId, subjectToken, body, new Date().toISOString());
  return result.lastInsertRowid as number;
}

export function updateGoal(id: number, body: string): void {
  getDb()
    .prepare('UPDATE cycle_goals SET body = ? WHERE id = ?')
    .run(body, id);
}

export function deleteGoal(id: number): void {
  getDb()
    .prepare('DELETE FROM cycle_goals WHERE id = ?')
    .run(id);
}

// ─── Member goal queries (per-person goals, not per-cycle) ─────────────────────

export function getMemberGoals(memberToken: string): MemberGoal[] {
  return getDb()
    .prepare('SELECT * FROM member_goals WHERE member_token = ? ORDER BY sort_order ASC, id ASC')
    .all(memberToken) as MemberGoal[];
}

export function addMemberGoal(memberToken: string, body: string): number {
  const result = getDb()
    .prepare('INSERT INTO member_goals (member_token, body, sort_order, created_at) VALUES (?, ?, 0, ?)')
    .run(memberToken, body, new Date().toISOString());
  return result.lastInsertRowid as number;
}

export function updateMemberGoal(id: number, body: string): void {
  getDb()
    .prepare('UPDATE member_goals SET body = ? WHERE id = ?')
    .run(body, id);
}

export function deleteMemberGoal(id: number): void {
  getDb()
    .prepare('DELETE FROM member_goals WHERE id = ?')
    .run(id);
}

// ─── Question queries ─────────────────────────────────────────────────────────

export function getCycleQuestions(cycleId: number, reviewType: string): CycleQuestion[] {
  return getDb()
    .prepare('SELECT * FROM cycle_questions WHERE cycle_id = ? AND review_type = ? ORDER BY sort_order ASC, id ASC')
    .all(cycleId, reviewType) as CycleQuestion[];
}

export function createQuestion(data: Omit<CycleQuestion, 'id'>): number {
  const result = getDb()
    .prepare(`
      INSERT INTO cycle_questions (cycle_id, review_type, question_key, question_text, question_type, placeholder, required, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(data.cycle_id, data.review_type, data.question_key, data.question_text, data.question_type, data.placeholder, data.required, data.sort_order);
  return result.lastInsertRowid as number;
}

export function reorderQuestions(updates: { id: number; sort_order: number }[]): void {
  const stmt = getDb().prepare('UPDATE cycle_questions SET sort_order = ? WHERE id = ?');
  const tx = getDb().transaction(() => { for (const u of updates) stmt.run(u.sort_order, u.id); });
  tx();
}

export function updateQuestion(id: number, data: { question_text?: string; placeholder?: string | null; required?: number }): void {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.question_text !== undefined) { fields.push('question_text = ?'); values.push(data.question_text); }
  if (data.placeholder !== undefined)   { fields.push('placeholder = ?');   values.push(data.placeholder); }
  if (data.required !== undefined)      { fields.push('required = ?');      values.push(data.required); }
  if (fields.length === 0) return;
  values.push(id);
  getDb().prepare(`UPDATE cycle_questions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteQuestion(id: number): void {
  getDb()
    .prepare('DELETE FROM cycle_questions WHERE id = ?')
    .run(id);
}

/** Internal helper — seeds questions for a cycle using a raw db handle (used during initSchema). */
function seedQuestionsForCycleWithDb(db: Database.Database, cycleId: number, sourceCycleId: number | null): void {
  if (sourceCycleId !== null) {
    // Copy from source cycle
    const sourceQuestions = db.prepare('SELECT * FROM cycle_questions WHERE cycle_id = ?').all(sourceCycleId) as CycleQuestion[];
    const insert = db.prepare(`
      INSERT OR IGNORE INTO cycle_questions (cycle_id, review_type, question_key, question_text, question_type, placeholder, required, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    db.transaction(() => {
      for (const q of sourceQuestions) {
        insert.run(cycleId, q.review_type, q.question_key, q.question_text, q.question_type, q.placeholder, q.required, q.sort_order);
      }
    })();
    return;
  }

  // Seed from hardcoded defaults
  const insert = db.prepare(`
    INSERT OR IGNORE INTO cycle_questions (cycle_id, review_type, question_key, question_text, question_type, placeholder, required, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    // Self-review
    SELF_REVIEW_QUESTIONS.forEach((q, i) => {
      insert.run(cycleId, 'self', q.key, q.text, q.type as string, q.placeholder ?? null, q.required ? 1 : 0, i);
    });
    // Peer review
    PEER_REVIEW_QUESTIONS.forEach((q, i) => {
      insert.run(cycleId, 'peer', q.key, q.text, q.type as string, q.placeholder ?? null, q.required ? 1 : 0, i);
    });
    // Manager review
    MANAGER_REVIEW_QUESTIONS.forEach((q, i) => {
      insert.run(cycleId, 'manager', q.key, q.text, q.type as string, q.placeholder ?? null, q.required ? 1 : 0, i);
    });
  })();
}

/** Public wrapper — seeds questions for a cycle (called when creating a new cycle). */
export function seedQuestionsForCycle(cycleId: number, sourceCycleId: number | null): void {
  seedQuestionsForCycleWithDb(getDb(), cycleId, sourceCycleId);
}

// ─── Share queries ────────────────────────────────────────────────────────────

export function getSharesForAssignment(assignmentId: number): ManagerReviewShare[] {
  return getDb()
    .prepare('SELECT * FROM manager_review_shares WHERE assignment_id = ?')
    .all(assignmentId) as ManagerReviewShare[];
}

export function getSharedWithMember(recipientToken: string): Array<{
  share: ManagerReviewShare;
  assignment: ReviewAssignment;
  cycleName: string;
  subjectName: string;
}> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      s.id as share_id, s.assignment_id, s.recipient_token, s.shared_at,
      a.id as a_id, a.cycle_id, a.reviewer_token, a.subject_token, a.type, a.status, a.submitted_at, a.removed,
      rc.name as cycle_name,
      tm.name as subject_name
    FROM manager_review_shares s
    JOIN review_assignments a ON a.id = s.assignment_id
    JOIN review_cycles rc ON rc.id = a.cycle_id
    JOIN team_members tm ON tm.token = a.subject_token
    WHERE s.recipient_token = ?
    ORDER BY s.shared_at DESC
  `).all(recipientToken) as Array<{
    share_id: number; assignment_id: number; recipient_token: string; shared_at: string;
    a_id: number; cycle_id: number; reviewer_token: string; subject_token: string; type: string; status: string; submitted_at: string | null; removed: number;
    cycle_name: string; subject_name: string;
  }>;

  return rows.map((r) => ({
    share: { id: r.share_id, assignment_id: r.assignment_id, recipient_token: r.recipient_token, shared_at: r.shared_at },
    assignment: { id: r.a_id, cycle_id: r.cycle_id, reviewer_token: r.reviewer_token, subject_token: r.subject_token, type: r.type as AssignmentType, status: r.status as AssignmentStatus, submitted_at: r.submitted_at, removed: r.removed },
    cycleName: r.cycle_name,
    subjectName: r.subject_name,
  }));
}

export function shareManagerReview(assignmentId: number, recipientToken: string): void {
  getDb()
    .prepare(`
      INSERT OR IGNORE INTO manager_review_shares (assignment_id, recipient_token, shared_at)
      VALUES (?, ?, ?)
    `)
    .run(assignmentId, recipientToken, new Date().toISOString());
}

export function unshareManagerReview(assignmentId: number, recipientToken: string): void {
  getDb()
    .prepare('DELETE FROM manager_review_shares WHERE assignment_id = ? AND recipient_token = ?')
    .run(assignmentId, recipientToken);
}

export function getAdminPasswordOverride(): string | null {
  const row = getDb()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('admin_password') as { value: string } | undefined;
  return row?.value ?? null;
}

export function setAdminPasswordOverride(password: string): void {
  getDb()
    .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run('admin_password', password);
}

// ─── Category types + queries ─────────────────────────────────────────────────

export interface Category {
  id: number;
  label: string;
  sort_order: number;
  active: number;
  created_at: string;
}

export interface CheckinResponse {
  id: number;
  checkin_id: number;
  category_id: number;
  category_label: string;
  days: number;
  notes: string;
}

export function getActiveCategories(): Category[] {
  return getDb()
    .prepare('SELECT * FROM categories WHERE active = 1 ORDER BY sort_order ASC, id ASC')
    .all() as Category[];
}

export function getAllCategories(): Category[] {
  return getDb()
    .prepare('SELECT * FROM categories ORDER BY sort_order ASC, id ASC')
    .all() as Category[];
}

export function createCategory(label: string, sortOrder: number): number {
  const result = getDb()
    .prepare('INSERT INTO categories (label, sort_order, active, created_at) VALUES (?, ?, 1, ?)')
    .run(label, sortOrder, new Date().toISOString());
  return result.lastInsertRowid as number;
}

export function updateCategoryLabel(id: number, label: string): void {
  getDb().prepare('UPDATE categories SET label = ? WHERE id = ?').run(label, id);
}

export function updateCategorySortOrder(id: number, sortOrder: number): void {
  getDb().prepare('UPDATE categories SET sort_order = ? WHERE id = ?').run(sortOrder, id);
}

export function softDeleteCategory(id: number): void {
  getDb().prepare('UPDATE categories SET active = 0 WHERE id = ?').run(id);
}

export function reactivateCategory(id: number): void {
  getDb().prepare('UPDATE categories SET active = 1 WHERE id = ?').run(id);
}

export function getCheckinResponses(checkinId: number): CheckinResponse[] {
  return getDb()
    .prepare('SELECT * FROM checkin_responses WHERE checkin_id = ? ORDER BY category_id ASC')
    .all(checkinId) as CheckinResponse[];
}

export function getCheckinResponsesForWeek(isoWeek: number, isoYear: number): CheckinResponse[] {
  return getDb()
    .prepare(`
      SELECT cr.* FROM checkin_responses cr
      JOIN checkins c ON c.id = cr.checkin_id
      WHERE c.iso_week = ? AND c.iso_year = ?
    `)
    .all(isoWeek, isoYear) as CheckinResponse[];
}

// ─── YTD trend aggregations ───────────────────────────────────────────────────

export interface TrendRow {
  member_token: string;
  member_name: string;
  category_label: string;
  total_days: number;
}

export function getYTDTrendByMember(
  fromKey?: number, // iso_year * 100 + iso_week, e.g. 202601
  toKey?: number,
): TrendRow[] {
  const from = fromKey ?? 0;
  const to = toKey ?? 999999;
  return getDb().prepare(`
    SELECT member_token, member_name, category_label, SUM(total_days) AS total_days
    FROM (
      -- New structured data: resolve current label via categories table so renames are reflected
      SELECT c.member_token, c.member_name, cat.label AS category_label, cr.days AS total_days
      FROM checkin_responses cr
      JOIN checkins c ON c.id = cr.checkin_id
      JOIN categories cat ON cat.id = cr.category_id
      JOIN team_members tm ON tm.token = c.member_token
      WHERE cr.days > 0
        AND tm.checkin = 1
        AND (c.iso_year * 100 + c.iso_week) BETWEEN @from AND @to

      UNION ALL

      -- Legacy flat columns (checkins with no checkin_responses rows):
      -- look up current label by the seeded category id so renames carry over
      SELECT c.member_token, c.member_name,
        (SELECT label FROM categories WHERE id = 1) AS category_label, c.sourcing_days
      FROM checkins c
      JOIN team_members tm ON tm.token = c.member_token
      WHERE c.sourcing_days > 0
        AND tm.checkin = 1
        AND (c.iso_year * 100 + c.iso_week) BETWEEN @from AND @to
        AND NOT EXISTS (SELECT 1 FROM checkin_responses cr WHERE cr.checkin_id = c.id)

      UNION ALL

      SELECT c.member_token, c.member_name,
        (SELECT label FROM categories WHERE id = 2), c.converting_days
      FROM checkins c
      JOIN team_members tm ON tm.token = c.member_token
      WHERE c.converting_days > 0
        AND tm.checkin = 1
        AND (c.iso_year * 100 + c.iso_week) BETWEEN @from AND @to
        AND NOT EXISTS (SELECT 1 FROM checkin_responses cr WHERE cr.checkin_id = c.id)

      UNION ALL

      SELECT c.member_token, c.member_name,
        (SELECT label FROM categories WHERE id = 3), c.execution_days
      FROM checkins c
      JOIN team_members tm ON tm.token = c.member_token
      WHERE c.execution_days > 0
        AND tm.checkin = 1
        AND (c.iso_year * 100 + c.iso_week) BETWEEN @from AND @to
        AND NOT EXISTS (SELECT 1 FROM checkin_responses cr WHERE cr.checkin_id = c.id)

      UNION ALL

      SELECT c.member_token, c.member_name,
        (SELECT label FROM categories WHERE id = 4), c.portfolio_exits_days
      FROM checkins c
      JOIN team_members tm ON tm.token = c.member_token
      WHERE c.portfolio_exits_days > 0
        AND tm.checkin = 1
        AND (c.iso_year * 100 + c.iso_week) BETWEEN @from AND @to
        AND NOT EXISTS (SELECT 1 FROM checkin_responses cr WHERE cr.checkin_id = c.id)

      UNION ALL

      SELECT c.member_token, c.member_name,
        (SELECT label FROM categories WHERE id = 5), c.portfolio_other_days
      FROM checkins c
      JOIN team_members tm ON tm.token = c.member_token
      WHERE c.portfolio_other_days > 0
        AND tm.checkin = 1
        AND (c.iso_year * 100 + c.iso_week) BETWEEN @from AND @to
        AND NOT EXISTS (SELECT 1 FROM checkin_responses cr WHERE cr.checkin_id = c.id)
    )
    GROUP BY member_token, category_label
    ORDER BY member_name, category_label
  `).all({ from, to }) as TrendRow[];
}

// ─── Goal scale setting ───────────────────────────────────────────────────────

export type GoalScale = 'rating_5' | 'percent_100';

export function getGoalScale(): GoalScale {
  const row = getDb()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('goal_scale') as { value: string } | undefined;
  return (row?.value as GoalScale) ?? 'percent_100';
}

export function setGoalScale(scale: GoalScale): void {
  getDb()
    .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run('goal_scale', scale);
}

// ─── Company goal types + queries ─────────────────────────────────────────────

export interface CompanyGoal {
  id: number;
  title: string;
  description: string;
  sort_order: number;
  created_at: string;
  scale: 'rating_5' | 'percent_100';
  timeline: string;
}

export function getAllCompanyGoals(): CompanyGoal[] {
  return getDb()
    .prepare('SELECT * FROM company_goals ORDER BY sort_order ASC, id ASC')
    .all() as CompanyGoal[];
}

export function createCompanyGoal(title: string, description: string, sortOrder: number, scale: string = 'percent_100', timeline: string = 'full_year'): number {
  const result = getDb()
    .prepare('INSERT INTO company_goals (title, description, sort_order, scale, timeline, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(title, description, sortOrder, scale, timeline, new Date().toISOString());
  return result.lastInsertRowid as number;
}

export function updateCompanyGoal(id: number, data: { title?: string; description?: string; sort_order?: number; scale?: string; timeline?: string }): void {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.title !== undefined)      { fields.push('title = ?');      values.push(data.title); }
  if (data.description !== undefined){ fields.push('description = ?'); values.push(data.description); }
  if (data.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(data.sort_order); }
  if (data.scale !== undefined)      { fields.push('scale = ?');      values.push(data.scale); }
  if (data.timeline !== undefined)   { fields.push('timeline = ?');   values.push(data.timeline); }
  if (!fields.length) return;
  values.push(id);
  getDb().prepare(`UPDATE company_goals SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteCompanyGoal(id: number): void {
  // Unlink any personal goals linked to this company goal
  getDb().prepare('UPDATE member_goals SET company_goal_id = NULL WHERE company_goal_id = ?').run(id);
  getDb().prepare('DELETE FROM company_goals WHERE id = ?').run(id);
}

// ─── Extended member goal queries (with company_goal_id, description, progress) ──

export interface MemberGoalExtended extends MemberGoal {
  company_goal_id: number | null;
  description: string;
  progress: number;
  scale: 'rating_5' | 'percent_100';
  timeline: string;
  progress_comment: string;
  manager_progress: number | null;
  manager_comment: string;
}

export function getMemberGoalsExtended(memberToken: string): MemberGoalExtended[] {
  return getDb()
    .prepare('SELECT * FROM member_goals WHERE member_token = ? ORDER BY sort_order ASC, id ASC')
    .all(memberToken) as MemberGoalExtended[];
}

export function getAllPersonalGoals(): MemberGoalExtended[] {
  return getDb()
    .prepare('SELECT * FROM member_goals ORDER BY member_token ASC, sort_order ASC, id ASC')
    .all() as MemberGoalExtended[];
}

export function updateMemberGoalProgress(id: number, progress: number): void {
  getDb().prepare('UPDATE member_goals SET progress = ? WHERE id = ?').run(progress, id);
}

export function updateMemberGoalCompanyLink(id: number, companyGoalId: number | null): void {
  getDb().prepare('UPDATE member_goals SET company_goal_id = ? WHERE id = ?').run(companyGoalId, id);
}

export function updateMemberGoalDescription(id: number, description: string): void {
  getDb().prepare('UPDATE member_goals SET description = ? WHERE id = ?').run(description, id);
}

export function updateMemberGoalScale(id: number, scale: 'rating_5' | 'percent_100'): void {
  getDb().prepare('UPDATE member_goals SET scale = ? WHERE id = ?').run(scale, id);
}

export function updateMemberGoalTimeline(id: number, timeline: string): void {
  getDb().prepare('UPDATE member_goals SET timeline = ? WHERE id = ?').run(timeline, id);
}

export function updateMemberGoalProgressAndComment(id: number, progress: number, comment: string): void {
  getDb().prepare('UPDATE member_goals SET progress = ?, progress_comment = ? WHERE id = ?').run(progress, comment, id);
}

export function getMemberGoalById(id: number): MemberGoalExtended | null {
  return (getDb().prepare('SELECT * FROM member_goals WHERE id = ?').get(id) as MemberGoalExtended) ?? null;
}

export function updateManagerGoalProgressAndComment(id: number, managerProgress: number | null, managerComment: string): void {
  getDb().prepare('UPDATE member_goals SET manager_progress = ?, manager_comment = ? WHERE id = ?').run(managerProgress, managerComment, id);
}

export function upsertCheckinResponse(
  checkinId: number,
  categoryId: number,
  categoryLabel: string,
  days: number,
  notes: string,
): void {
  getDb()
    .prepare(`
      INSERT INTO checkin_responses (checkin_id, category_id, category_label, days, notes)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(checkin_id, category_id) DO UPDATE SET
        category_label = excluded.category_label,
        days           = excluded.days,
        notes          = excluded.notes
    `)
    .run(checkinId, categoryId, categoryLabel, days, notes);
}
