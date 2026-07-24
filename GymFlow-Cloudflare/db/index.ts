import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

function getEnv() {
  return (globalThis as typeof globalThis & {
    __GYMFLOW_ENV__?: { DB?: D1Database };
  }).__GYMFLOW_ENV__;
}

export function getDb() {
  const database = getEnv()?.DB;
  if (!database) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(database, { schema });
}

export function getAuthenticatedEmail(request: Request) {
  const email = request.headers
    .get("cf-access-authenticated-user-email")
    ?.trim()
    .toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Accesso non autorizzato.");
  }
  return email;
}

let schemaReady: Promise<unknown> | null = null;

export function ensureSchema() {
  const database = getEnv()?.DB;
  if (!database) {
    throw new Error("Archivio dati non disponibile.");
  }
  schemaReady ??= database.batch([
    database.prepare(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      )
    `),
    database.prepare(`
      CREATE TABLE IF NOT EXISTS weeks (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        owner_email TEXT NOT NULL,
        name TEXT NOT NULL,
        accent TEXT NOT NULL DEFAULT '#c8ff5a',
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    database.prepare(`
      CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        owner_email TEXT NOT NULL,
        week INTEGER NOT NULL,
        name TEXT NOT NULL,
        muscle_group TEXT NOT NULL DEFAULT '',
        sets INTEGER NOT NULL DEFAULT 3,
        reps TEXT NOT NULL DEFAULT '10',
        weight TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    database.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS weeks_owner_position_idx ON weeks (owner_email, position)",
    ),
    database.prepare(
      "CREATE INDEX IF NOT EXISTS exercises_owner_week_idx ON exercises (owner_email, week)",
    ),
  ]);
  return schemaReady;
}

export async function ensureUserWeeks(ownerEmail: string) {
  await ensureSchema();
  const database = getEnv()?.DB;
  if (!database) throw new Error("Archivio dati non disponibile.");
  await database.batch([
    database
      .prepare("INSERT OR IGNORE INTO weeks (owner_email, name, accent, position) VALUES (?, 'Settimana 1', '#c8ff5a', 1)")
      .bind(ownerEmail),
    database
      .prepare("INSERT OR IGNORE INTO weeks (owner_email, name, accent, position) VALUES (?, 'Settimana 2', '#8ee7ff', 2)")
      .bind(ownerEmail),
    database
      .prepare("INSERT OR IGNORE INTO weeks (owner_email, name, accent, position) VALUES (?, 'Settimana 3', '#c9b6ff', 3)")
      .bind(ownerEmail),
    database
      .prepare("INSERT OR IGNORE INTO weeks (owner_email, name, accent, position) VALUES (?, 'Settimana 4', '#ff9e80', 4)")
      .bind(ownerEmail),
  ]);
}
