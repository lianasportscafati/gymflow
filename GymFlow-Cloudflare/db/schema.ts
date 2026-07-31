import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const workoutPlans = sqliteTable(
  "workout_plans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerEmail: text("owner_email").notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    archivedAt: text("archived_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("workout_plans_owner_position_idx").on(table.ownerEmail, table.position),
  ],
);

export const weeks = sqliteTable(
  "weeks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerEmail: text("owner_email").notNull(),
    planId: integer("plan_id").notNull(),
    name: text("name").notNull(),
    accent: text("accent").notNull().default("#c8ff5a"),
    position: integer("position").notNull().default(0),
    completed: integer("completed", { mode: "boolean" }).notNull().default(false),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    archivedAt: text("archived_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("weeks_owner_position_idx").on(table.ownerEmail, table.position),
  ],
);

export const workouts = sqliteTable("workouts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerEmail: text("owner_email").notNull(),
  weekId: integer("week_id").notNull(),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const exercises = sqliteTable("exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerEmail: text("owner_email").notNull(),
  week: integer("week").notNull(),
  workoutId: integer("workout_id"),
  name: text("name").notNull(),
  muscleGroup: text("muscle_group").notNull().default(""),
  sets: integer("sets").notNull().default(3),
  reps: text("reps").notNull().default("10"),
  weight: text("weight").notNull().default(""),
  baseWeight: text("base_weight").notNull().default(""),
  weightPercentage: integer("weight_percentage"),
  notes: text("notes").notNull().default(""),
  position: integer("position").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
