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
        CREATE TABLE IF NOT EXISTS workout_plans (
          id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
          owner_email TEXT NOT NULL,
          name TEXT NOT NULL,
          position INTEGER NOT NULL DEFAULT 0,
          archived INTEGER NOT NULL DEFAULT 0,
          archived_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `),
      database.prepare(`
        CREATE TABLE IF NOT EXISTS weeks (
          id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
          owner_email TEXT NOT NULL,
          plan_id INTEGER,
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
        "CREATE UNIQUE INDEX IF NOT EXISTS workout_plans_owner_position_idx ON workout_plans (owner_email, position)",
      ),
      database.prepare(
        "CREATE INDEX IF NOT EXISTS workout_plans_owner_archive_idx ON workout_plans (owner_email, archived, archived_at)",
      ),
      database.prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS weeks_owner_position_idx ON weeks (owner_email, position)",
      ),
      database.prepare(
        "CREATE INDEX IF NOT EXISTS exercises_owner_week_idx ON exercises (owner_email, week)",
      ),
    ]);

    const tableInfo = await database.prepare("PRAGMA table_info(weeks)").all<{ name: string }>();
    if (!tableInfo.results.some((column) => column.name === "plan_id")) {
      await database.prepare("ALTER TABLE weeks ADD COLUMN plan_id INTEGER").run();
    }
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

    await database.prepare(`
      INSERT INTO workout_plans (owner_email, name, position)
      SELECT owner_email, 'La mia scheda', 1
      FROM weeks
      WHERE NOT EXISTS (
        SELECT 1 FROM workout_plans plan WHERE plan.owner_email = weeks.owner_email
      )
      GROUP BY owner_email
    `).run();
    await database.prepare(`
      UPDATE weeks
      SET plan_id = (
        SELECT id FROM workout_plans
        WHERE workout_plans.owner_email = weeks.owner_email
        ORDER BY position, id
        LIMIT 1
      )
      WHERE plan_id IS NULL
    `).run();
    await database
      .prepare("CREATE INDEX IF NOT EXISTS weeks_owner_plan_idx ON weeks (owner_email, plan_id, position)")
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
  const planInitializedKey = `plans_initialized:${ownerEmail}`;

  await database.batch([
    database
      .prepare(`
        INSERT OR IGNORE INTO workout_plans (owner_email, name, position)
        SELECT ?, 'La mia scheda', 1
        WHERE NOT EXISTS (SELECT 1 FROM app_meta WHERE key = ?)
          AND NOT EXISTS (SELECT 1 FROM workout_plans WHERE owner_email = ?)
      `)
      .bind(ownerEmail, planInitializedKey, ownerEmail),
    database
      .prepare("INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, '1')")
      .bind(planInitializedKey),
  ]);

  const defaultPlan = await database
    .prepare("SELECT id FROM workout_plans WHERE owner_email = ? ORDER BY position, id LIMIT 1")
    .bind(ownerEmail)
    .first<{ id: number }>();
  if (!defaultPlan) throw new Error("Impossibile inizializzare la scheda.");

  await database.batch([
    database
      .prepare(`
        INSERT INTO weeks (owner_email, plan_id, name, accent, position)
        SELECT ?, ?, 'Settimana 1', '#c8ff5a', 1
        WHERE NOT EXISTS (SELECT 1 FROM app_meta WHERE key = ?)
      `)
      .bind(ownerEmail, defaultPlan.id, initializedKey),
    database
      .prepare(`
        INSERT INTO weeks (owner_email, plan_id, name, accent, position)
        SELECT ?, ?, 'Settimana 2', '#8ee7ff', 2
        WHERE NOT EXISTS (SELECT 1 FROM app_meta WHERE key = ?)
      `)
      .bind(ownerEmail, defaultPlan.id, initializedKey),
    database
      .prepare(`
        INSERT INTO weeks (owner_email, plan_id, name, accent, position)
        SELECT ?, ?, 'Settimana 3', '#c9b6ff', 3
        WHERE NOT EXISTS (SELECT 1 FROM app_meta WHERE key = ?)
      `)
      .bind(ownerEmail, defaultPlan.id, initializedKey),
    database
      .prepare(`
        INSERT INTO weeks (owner_email, plan_id, name, accent, position)
        SELECT ?, ?, 'Settimana 4', '#ff9e80', 4
        WHERE NOT EXISTS (SELECT 1 FROM app_meta WHERE key = ?)
      `)
      .bind(ownerEmail, defaultPlan.id, initializedKey),
    database
      .prepare("INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, '1')")
      .bind(initializedKey),
  ]);
}
