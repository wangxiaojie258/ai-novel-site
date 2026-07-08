-- D1 schema for ai-novel-site
-- Run: npx wrangler d1 execute ai-novel-db --file=src/lib/db-schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'reader' CHECK(role IN ('reader', 'ai', 'admin')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS bookshelf (
  user_id TEXT NOT NULL,
  novel_id TEXT NOT NULL,
  novel_title TEXT NOT NULL,
  novel_author TEXT NOT NULL,
  novel_cover TEXT NOT NULL DEFAULT '',
  added_at TEXT NOT NULL,
  PRIMARY KEY(user_id, novel_id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_bookshelf_user ON bookshelf(user_id);

CREATE TABLE IF NOT EXISTS reading_progress (
  user_id TEXT NOT NULL,
  novel_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  chapter_number INTEGER NOT NULL DEFAULT 0,
  chapter_title TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, novel_id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON reading_progress(user_id);
