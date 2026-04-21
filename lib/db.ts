// Server-only module — never import this from a Client Component.
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

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
  { token: 'christoph-vdm', name: 'Christoph Vonder Mühll',  email: 'christoph.vondermuhll@mtip.ch',  password: 'christoph2026' },
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS passwords (
      member_token  TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS team_members (
      token      TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      active     INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `);

  // Always upsert seed members so they appear even on pre-existing DBs
  const now = new Date().toISOString();
  const insertSeed = db.prepare(
    'INSERT OR IGNORE INTO team_members (token, name, email, active, created_at) VALUES (?, ?, ?, 1, ?)',
  );
  for (const m of SEED_MEMBERS) {
    try {
      insertSeed.run(m.token, m.name, m.email, now);
    } catch (err) {
      console.error(`[db] Failed to seed member ${m.token}:`, err);
    }
  }
  const seededCount = (db.prepare('SELECT COUNT(*) as n FROM team_members').get() as { n: number }).n;
  console.log(`[db] team_members count after seed: ${seededCount}`);
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
}

// ─── Checkin queries ──────────────────────────────────────────────────────────

export function getCheckin(memberToken: string, isoWeek: number, isoYear: number): Checkin | undefined {
  return getDb()
    .prepare('SELECT * FROM checkins WHERE member_token = ? AND iso_week = ? AND iso_year = ?')
    .get(memberToken, isoWeek, isoYear) as Checkin | undefined;
}

export function upsertCheckin(data: Omit<Checkin, 'id'>): void {
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

export function getCheckinMembers(): TeamMemberRow[] {
  return getDb()
    .prepare('SELECT * FROM team_members WHERE active = 1 AND checkin = 1 ORDER BY name ASC')
    .all() as TeamMemberRow[];
}

export function deleteTeamMember(token: string): void {
  const db = getDb();
  // Remove all review data for this member first (no FK constraints on token cols)
  db.prepare('DELETE FROM review_responses  WHERE reviewer_token = ? OR assignment_id IN (SELECT id FROM review_assignments WHERE subject_token = ? OR reviewer_token = ?)').run(token, token, token);
  db.prepare('DELETE FROM review_assignments WHERE subject_token = ? OR reviewer_token = ?').run(token, token);
  db.prepare('DELETE FROM review_signoffs   WHERE subject_token = ?').run(token);
  db.prepare('DELETE FROM checkins          WHERE member_token = ?').run(token);
  db.prepare('DELETE FROM team_members      WHERE token = ?').run(token);
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

export function getCycleSignoffs(cycleId: number): ReviewSignoff[] {
  return getDb()
    .prepare('SELECT * FROM review_signoffs WHERE cycle_id = ?')
    .all(cycleId) as ReviewSignoff[];
}
