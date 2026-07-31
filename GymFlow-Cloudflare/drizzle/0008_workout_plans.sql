CREATE TABLE IF NOT EXISTS workout_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  owner_email TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS workout_plans_owner_position_idx
  ON workout_plans (owner_email, position);
CREATE INDEX IF NOT EXISTS workout_plans_owner_archive_idx
  ON workout_plans (owner_email, archived, archived_at);
ALTER TABLE weeks ADD COLUMN plan_id INTEGER;
INSERT INTO workout_plans (owner_email, name, position)
SELECT owner_email, 'La mia scheda', 1
FROM weeks
WHERE NOT EXISTS (
  SELECT 1 FROM workout_plans plan WHERE plan.owner_email = weeks.owner_email
)
GROUP BY owner_email;
UPDATE weeks
SET plan_id = (
  SELECT id FROM workout_plans
  WHERE workout_plans.owner_email = weeks.owner_email
  ORDER BY position, id
  LIMIT 1
)
WHERE plan_id IS NULL;
CREATE INDEX IF NOT EXISTS weeks_owner_plan_idx
  ON weeks (owner_email, plan_id, position);
