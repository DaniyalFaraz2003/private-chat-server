import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

let db: Database;

export type User = {
  id: number;
  username: string;
  password_hash: string;
  created_at: number;
};

export type UserListItem = {
  id: number;
  username: string;
  created_at: number;
};

export type RecentMessage = {
  id: number;
  username: string;
  content: string;
  created_at: number;
};

export function initDb() {
  const dbPath = process.env.DB_PATH || './data/chat.db';
  mkdirSync(dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      created_at    INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS messages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      username    TEXT    NOT NULL,
      content     TEXT    NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  `);
}

export function getUserByUsername(username: string): User | null {
  return db.query('SELECT * FROM users WHERE username = ?').get(username) as User | null;
}

export function createUser(username: string, passwordHash: string): void {
  db.query('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(
    username,
    passwordHash,
  );
}

export function deleteUser(username: string): void {
  db.query('DELETE FROM users WHERE username = ?').run(username);
}

export function listUsers(): UserListItem[] {
  return db
    .query('SELECT id, username, created_at FROM users ORDER BY created_at')
    .all() as UserListItem[];
}

export function insertMessage(
  userId: number,
  username: string,
  content: string,
): number {
  const result = db
    .query('INSERT INTO messages (user_id, username, content) VALUES (?, ?, ?)')
    .run(userId, username, content);
  return Number(result.lastInsertRowid);
}

export function getRecentMessages(limit = 100): RecentMessage[] {
  return db
    .query(
      'SELECT id, username, content, created_at FROM messages ORDER BY created_at DESC LIMIT ?',
    )
    .all(limit)
    .reverse() as RecentMessage[];
}
