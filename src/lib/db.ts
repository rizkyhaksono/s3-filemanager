import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_PATH =
  process.env.DATABASE_PATH || path.join(process.cwd(), "data", "app.db");

function open() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS connections (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      name              TEXT    NOT NULL,
      provider          TEXT    NOT NULL DEFAULT 'custom',
      endpoint          TEXT,
      region            TEXT    NOT NULL DEFAULT 'us-east-1',
      access_key_id     TEXT    NOT NULL,
      secret_access_key TEXT    NOT NULL,
      bucket            TEXT,
      force_path_style  INTEGER NOT NULL DEFAULT 0,
      created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

// Reuse a single handle across hot reloads in dev.
const g = globalThis as unknown as { __db?: Database.Database };
export const db = g.__db ?? (g.__db = open());
