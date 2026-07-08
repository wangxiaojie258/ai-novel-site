/**
 * D1 database wrapper — users / bookshelf / reading progress.
 *
 * All functions receive the D1Database binding from Astro.locals.runtime.env.
 * In local dev (no D1 binding), falls back to in-memory store.
 */

export type D1 = D1Database;

export function requireDB(env: Record<string, unknown>): D1 {
  const db = env.DB as D1 | undefined;
  if (!db) throw new Error('D1 binding not found');
  return db;
}

export function getDB(env: Record<string, unknown>): D1 | undefined {
  return (env.DB as D1 | undefined) ?? undefined;
}

export interface DBEnv {
  DB?: D1Database;
}

export interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: 'reader' | 'ai' | 'admin';
  created_at: string;
}

export interface BookshelfRow {
  user_id: string;
  novel_id: string;
  novel_title: string;
  novel_author: string;
  novel_cover: string;
  added_at: string;
}

export interface ProgressRow {
  user_id: string;
  novel_id: string;
  chapter_id: string;
  chapter_number: number;
  chapter_title: string;
  position: number; // scroll position percentage 0-100
  updated_at: string;
}

// ----- Users -----

export async function createUser(
  db: D1Database | undefined,
  id: string,
  username: string,
  email: string,
  passwordHash: string,
): Promise<UserRow> {
  const now = new Date().toISOString();
  if (db) {
    await db.prepare(
      'INSERT INTO users (id, username, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, username, email, passwordHash, 'reader', now).run();
  }
  return { id, username, email, password_hash: passwordHash, role: 'reader', created_at: now };
}

export async function findUserByUsername(
  db: D1Database | undefined,
  username: string,
): Promise<UserRow | null> {
  if (!db) return null;
  const row = await db.prepare(
    'SELECT id, username, email, password_hash, role, created_at FROM users WHERE username = ?'
  ).bind(username).first<UserRow>();
  return row ?? null;
}

export async function findUserById(
  db: D1Database | undefined,
  id: string,
): Promise<UserRow | null> {
  if (!db) return null;
  const row = await db.prepare(
    'SELECT id, username, email, password_hash, role, created_at FROM users WHERE id = ?'
  ).bind(id).first<UserRow>();
  return row ?? null;
}

// ----- Bookshelf -----

export async function getBookshelf(
  db: D1Database | undefined,
  userId: string,
): Promise<BookshelfRow[]> {
  if (!db) return [];
  const result = await db.prepare(
    'SELECT user_id, novel_id, novel_title, novel_author, novel_cover, added_at FROM bookshelf WHERE user_id = ? ORDER BY added_at DESC'
  ).bind(userId).all<BookshelfRow>();
  return result.results;
}

export async function addToBookshelf(
  db: D1Database | undefined,
  userId: string,
  novelId: string,
  novelTitle: string,
  novelAuthor: string,
  novelCover: string,
): Promise<void> {
  if (!db) return;
  await db.prepare(
    'INSERT OR REPLACE INTO bookshelf (user_id, novel_id, novel_title, novel_author, novel_cover, added_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(userId, novelId, novelTitle, novelAuthor, novelCover, new Date().toISOString()).run();
}

export async function removeFromBookshelf(
  db: D1Database | undefined,
  userId: string,
  novelId: string,
): Promise<void> {
  if (!db) return;
  await db.prepare(
    'DELETE FROM bookshelf WHERE user_id = ? AND novel_id = ?'
  ).bind(userId, novelId).run();
}

export async function isInBookshelf(
  db: D1Database | undefined,
  userId: string,
  novelId: string,
): Promise<boolean> {
  if (!db) return false;
  const row = await db.prepare(
    'SELECT 1 FROM bookshelf WHERE user_id = ? AND novel_id = ?'
  ).bind(userId, novelId).first();
  return !!row;
}

// ----- Reading Progress -----

export async function saveProgress(
  db: D1Database | undefined,
  userId: string,
  novelId: string,
  chapterId: string,
  chapterNumber: number,
  chapterTitle: string,
  position: number,
): Promise<void> {
  if (!db) return;
  await db.prepare(
    `INSERT INTO reading_progress (user_id, novel_id, chapter_id, chapter_number, chapter_title, position, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, novel_id) DO UPDATE SET
       chapter_id = excluded.chapter_id,
       chapter_number = excluded.chapter_number,
       chapter_title = excluded.chapter_title,
       position = excluded.position,
       updated_at = excluded.updated_at`
  ).bind(userId, novelId, chapterId, chapterNumber, chapterTitle, position, new Date().toISOString()).run();
}

export async function getProgress(
  db: D1Database | undefined,
  userId: string,
  novelId: string,
): Promise<ProgressRow | null> {
  if (!db) return null;
  const row = await db.prepare(
    'SELECT user_id, novel_id, chapter_id, chapter_number, chapter_title, position, updated_at FROM reading_progress WHERE user_id = ? AND novel_id = ?'
  ).bind(userId, novelId).first<ProgressRow>();
  return row ?? null;
}

export async function getAllProgress(
  db: D1Database | undefined,
  userId: string,
): Promise<ProgressRow[]> {
  if (!db) return [];
  const result = await db.prepare(
    'SELECT user_id, novel_id, chapter_id, chapter_number, chapter_title, position, updated_at FROM reading_progress WHERE user_id = ? ORDER BY updated_at DESC'
  ).bind(userId).all<ProgressRow>();
  return result.results;
}
