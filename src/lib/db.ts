/**
 * D1 database wrapper.
 *
 * Cloudflare D1 is accessed via the `DB` binding injected by the
 * @astrojs/cloudflare adapter. Pages functions / Astro endpoints can pull
 * it from `Astro.locals.runtime.env.DB`; Workers scripts can pull it from
 * the `env.DB` parameter.
 *
 * This module is the single place we wrap that binding so that:
 *   1. types are consistent (D1Database from @cloudflare/workers-types)
 *   2. we can stub the DB during local dev / skeleton phase
 *   3. prepared statements get reused for hot queries
 */

import type { D1Database } from '@cloudflare/workers-types';

export type D1 = D1Database;

export interface DBEnv {
  DB?: D1Database;
}

/** Pulls the DB binding from an Astro context or Worker env. */
export function getDB(env: DBEnv | undefined | null): D1Database | null {
  if (!env) return null;
  return env.DB ?? null;
}

/** Asserts that a DB binding is present, throwing a typed error otherwise. */
export function requireDB(env: DBEnv | undefined | null): D1Database {
  const db = getDB(env);
  if (!db) {
    throw new Error('D1 binding `DB` is not configured. Run `wrangler d1 create` and update wrangler.toml.');
  }
  return db;
}

/** Runs a single-row SELECT and returns the row or null. */
export async function first<T = unknown>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T | null> {
  const stmt = db.prepare(sql).bind(...params);
  const res = await stmt.first<T>();
  return res ?? null;
}

/** Runs a SELECT and returns all rows. */
export async function all<T = unknown>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  const stmt = db.prepare(sql).bind(...params);
  const res = await stmt.all<T>();
  return res.results ?? [];
}

/** Runs an INSERT/UPDATE/DELETE statement and returns the raw D1 result. */
export async function run(
  db: D1Database,
  sql: string,
  ...params: unknown[]
) {
  const stmt = db.prepare(sql).bind(...params);
  return await stmt.run();
}

export type D1Result = unknown;

// ---------- Schema migrations (skeleton) ----------
// In production, prefer `wrangler d1 migrations`. The constants below
// document the target schema and can be re-used by both a migration
// runner and the type-safe query helpers.
export const SCHEMA_SQL = /* sql */ `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'reader', -- 'reader' | 'ai' | 'admin'
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS books (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL,          -- 'novel' | 'classic'
  title         TEXT NOT NULL,
  author        TEXT NOT NULL,
  ai_model      TEXT,
  category      TEXT,
  subcategory   TEXT,
  status        TEXT,                   -- 'ongoing' | 'completed' | NULL
  tags          TEXT,                   -- JSON array
  cover         TEXT,
  excerpt       TEXT,
  word_count    INTEGER DEFAULT 0,
  chapter_count INTEGER DEFAULT 0,
  prompt_preview TEXT,
  publish_date  INTEGER,
  update_date   INTEGER,
  featured      INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chapters (
  id            TEXT PRIMARY KEY,
  book_id       TEXT NOT NULL,
  volume        TEXT DEFAULT '正文',
  chapter_number INTEGER NOT NULL,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  word_count    INTEGER DEFAULT 0,
  publish_date  INTEGER,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
  id            TEXT PRIMARY KEY,
  target_type   TEXT NOT NULL,          -- 'book' | 'chapter' | 'segment'
  target_id     TEXT NOT NULL,
  segment_id    TEXT,                   -- for paragraph-level comments
  user_id       TEXT NOT NULL,
  content       TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rewards (
  id            TEXT PRIMARY KEY,
  book_id       TEXT NOT NULL,
  user_id       TEXT,
  amount_cents  INTEGER NOT NULL,
  message       TEXT,
  provider      TEXT NOT NULL,
  provider_ref  TEXT,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bookshelf (
  user_id       TEXT NOT NULL,
  book_id       TEXT NOT NULL,
  progress      REAL DEFAULT 0,         -- 0..1
  last_chapter  TEXT,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (user_id, book_id)
);
`;
