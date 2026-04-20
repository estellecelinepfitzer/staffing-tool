// Server-only module — never import this from a Client Component.
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { TEAM_MEMBERS_SEED } from '@/config/team';

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

function addColumnIfMissing(db: Database.Database, table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.find((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function initSchema(db: Database.Database) {
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

  // Migrations — add new columns to existing tables without breaking existing data
  addColumnIfMissing(db, 'checkins', 'working_days',        'REAL NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'checkins', 'sourcing_days',       'REAL NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'checkins', 'converting_days',     'REAL NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'checkins', 'execution_days',      'REAL NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'checkins', 'portfolio_exits_days','REAL NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'checkins', 'portfolio_other_days','REAL NOT NULL DEFAULT 0');

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

  // Seed team members from config if table is empty
  const count = (db.prepare('SELECT COUNT(*) as n FROM team_members').get() as { n: number }).n;
  if (count === 0) {
    const insert = db.prepare(
      'INSERT OR IGNORE INTO team_members (token, name, email, active, created_at) VALUES (?, ?, ?, 1, ?)',
    );
    const now = new Date().toISOString();
    for (const m of TEAM_MEMBERS_SEED) {
      insert.run(m.token, m.name, m.email, now);
    }
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

// ─── Queries ─────────────────────────────────────────────────────────────────

export function getCheckin(
  memberToken: string,
  isoWeek: number,
  isoYear: number,
): Checkin | undefined {
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
      data.member_token,
      data.member_name,
      data.iso_week,
      data.iso_year,
      data.submitted_at,
      data.mood,
      data.capacity,
      data.sourcing,
      data.converting,
      data.execution,
      data.portfolio_exits,
      data.portfolio_other,
      data.working_days,
      data.sourcing_days,
      data.converting_days,
      data.execution_days,
      data.portfolio_exits_days,
      data.portfolio_other_days,
    );
}

export function getWeekCheckins(isoWeek: number, isoYear: number): Checkin[] {
  return getDb()
    .prepare('SELECT * FROM checkins WHERE iso_week = ? AND iso_year = ? ORDER BY submitted_at ASC')
    .all(isoWeek, isoYear) as Checkin[];
}

// ─── Password storage ─────────────────────────────────────────────────────────

/** Returns the stored password hash for a member, or null if not set. */
export function getPasswordHash(memberToken: string): string | null {
  const row = getDb()
    .prepare('SELECT password_hash FROM passwords WHERE member_token = ?')
    .get(memberToken) as { password_hash: string } | undefined;
  return row?.password_hash ?? null;
}

/** Saves (or updates) the hashed password for a member. */
export function setPasswordHash(memberToken: string, hash: string): void {
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

// ─── Reset codes ──────────────────────────────────────────────────────────────

interface ResetCode {
  member_token: string;
  code: string;
  expires_at: string;
}

export function initResetCodesTable(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS reset_codes (
      member_token TEXT NOT NULL,
      code         TEXT NOT NULL,
      expires_at   TEXT NOT NULL
    )
  `);
}

export function saveResetCode(memberToken: string, code: string, expiresAt: Date): void {
  initResetCodesTable();
  // Delete any existing codes for this person first
  getDb().prepare('DELETE FROM reset_codes WHERE member_token = ?').run(memberToken);
  getDb()
    .prepare('INSERT INTO reset_codes (member_token, code, expires_at) VALUES (?, ?, ?)')
    .run(memberToken, code, expiresAt.toISOString());
}

export function consumeResetCode(memberToken: string, code: string): boolean {
  initResetCodesTable();
  const row = getDb()
    .prepare('SELECT * FROM reset_codes WHERE member_token = ? AND code = ?')
    .get(memberToken, code) as ResetCode | undefined;
  if (!row) return false;
  if (new Date(row.expires_at) < new Date()) return false;
  getDb().prepare('DELETE FROM reset_codes WHERE member_token = ?').run(memberToken);
  return true;
}

// ─── Team members ─────────────────────────────────────────────────────────────

export interface TeamMember {
  token: string;
  name: string;
  email: string;
  active: number;
  created_at: string;
}

export function getMemberByToken(token: string): TeamMember | undefined {
  return getDb()
    .prepare('SELECT * FROM team_members WHERE token = ? AND active = 1')
    .get(token) as TeamMember | undefined;
}

export function getMemberByEmail(email: string): TeamMember | undefined {
  return getDb()
    .prepare('SELECT * FROM team_members WHERE email = ? AND active = 1')
    .get(email) as TeamMember | undefined;
}

export function getAllMembers(): TeamMember[] {
  return getDb()
    .prepare('SELECT * FROM team_members ORDER BY active DESC, name ASC')
    .all() as TeamMember[];
}

export function addMember(token: string, name: string, email: string): void {
  getDb()
    .prepare('INSERT INTO team_members (token, name, email, active, created_at) VALUES (?, ?, ?, 1, ?)')
    .run(token, name, email, new Date().toISOString());
}

export function setMemberActive(token: string, active: boolean): void {
  getDb()
    .prepare('UPDATE team_members SET active = ? WHERE token = ?')
    .run(active ? 1 : 0, token);
}

export function updateMember(token: string, name: string, email: string): void {
  getDb()
    .prepare('UPDATE team_members SET name = ?, email = ? WHERE token = ?')
    .run(name, email, token);
}
