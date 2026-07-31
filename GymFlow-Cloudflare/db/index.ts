import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

function getEnv() {
  return (globalThis as typeof globalThis & {
    __GYMFLOW_ENV__?: { DB?: D1Database };
  }).__GYMFLOW_ENV__;
}

export function getDb() {
  const database = getDatabase();
  return drizzle(database, { schema });
}

export function getDatabase() {
  const database = getEnv()?.DB;
  if (!database) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }
  return database;
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

let schemaReady: Promise<void> | null = null;

export function ensureSchema() {
  const database = getEnv()?.DB;
  if (!database) {
    throw new Error("Archivio dati non disponibile.");
  }
  schemaReady ??= (async () => {
    await database.batch([
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
          completed INTEGER NOT NULL DEFAULT 0,
          archived INTEGER NOT NULL DEFAULT 0,
          archived_at TEXT,
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
          base_weight TEXT NOT NULL DEFAULT '',
          weight_percentage INTEGER,
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

    const tableInfo = await database.prepare("PRAGMA table_info(weeks)").all<{ name: string }>();
    if (!tableInfo.results.some((column) => column.name === "completed")) {
      try {
        await database
          .prepare("ALTER TABLE weeks ADD COLUMN completed INTEGER NOT NULL DEFAULT 0")
          .run();
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (!message.includes("duplicate column")) throw error;
      }
    }
    if (!tableInfo.results.some((column) => column.name === "archived")) {
      try {
        await database
          .prepare("ALTER TABLE weeks ADD COLUMN archived INTEGER NOT NULL DEFAULT 0")
          .run();
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (!message.includes("duplicate column")) throw error;
      }
    }
    if (!tableInfo.results.some((column) => column.name === "archived_at")) {
      try {
        await database.prepare("ALTER TABLE weeks ADD COLUMN archived_at TEXT").run();
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (!message.includes("duplicate column")) throw error;
      }
    }
    await database
      .prepare(
        "CREATE INDEX IF NOT EXISTS weeks_owner_archive_idx ON weeks (owner_email, archived, archived_at)",
      )
      .run();

    const exerciseTableInfo = await database
      .prepare("PRAGMA table_info(exercises)")
      .all<{ name: string }>();
    if (!exerciseTableInfo.results.some((column) => column.name === "base_weight")) {
      await database
        .prepare("ALTER TABLE exercises ADD COLUMN base_weight TEXT NOT NULL DEFAULT ''")
        .run();
    }
    if (!exerciseTableInfo.results.some((column) => column.name === "weight_percentage")) {
      await database
        .prepare("ALTER TABLE exercises ADD COLUMN weight_percentage INTEGER")
        .run();
    }

    // Mark existing accounts as initialized before the new seeding strategy is
    // used. This prevents deleted default weeks from being recreated.
    await database.prepare(`
      INSERT OR IGNORE INTO app_meta (key, value)
      SELECT 'weeks_initialized:' || owner_email, '1'
      FROM weeks
      GROUP BY owner_email
    `).run();
  })();
  return schemaReady;
}

export async function ensureUserWeeks(ownerEmail: string) {
  await ensureSchema();
  const database = getEnv()?.DB;
  if (!database) throw new Error("Archivio dati non disponibile.");
  const initializedKey = `weeks_initialized:${ownerEmail}`;

  // D1 batches are transactional. The four defaults are created only before
  // the initialization marker exists; later deletions therefore stay deleted.
  await database.batch([
    database
      .prepare(`
        INSERT INTO weeks (owner_email, name, accent, position)
        SELECT ?, 'Settimana 1', '#c8ff5a', 1
        WHERE NOT EXISTS (SELECT 1 FROM app_meta WHERE key = ?)
      `)
      .bind(ownerEmail, initializedKey),
    database
      .prepare(`
        INSERT INTO weeks (owner_email, name, accent, position)
        SELECT ?, 'Settimana 2', '#8ee7ff', 2
        WHERE NOT EXISTS (SELECT 1 FROM app_meta WHERE key = ?)
      `)
      .bind(ownerEmail, initializedKey),
    database
      .prepare(`
        INSERT INTO weeks (owner_email, name, accent, position)
        SELECT ?, 'Settimana 3', '#c9b6ff', 3
        WHERE NOT EXISTS (SELECT 1 FROM app_meta WHERE key = ?)
      `)
      .bind(ownerEmail, initializedKey),
    database
      .prepare(`
        INSERT INTO weeks (owner_email, name, accent, position)
        SELECT ?, 'Settimana 4', '#ff9e80', 4
        WHERE NOT EXISTS (SELECT 1 FROM app_meta WHERE key = ?)
      `)
      .bind(ownerEmail, initializedKey),
    database
      .prepare("INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, '1')")
      .bind(initializedKey),
  ]);
}
