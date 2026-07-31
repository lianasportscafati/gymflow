CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  owner_email TEXT NOT NULL,
  week_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS workouts_owner_week_idx
  ON workouts (owner_email, week_id, position);
ALTER TABLE exercises ADD COLUMN workout_id INTEGER;
INSERT INTO workouts (owner_email, week_id, name, position)
SELECT owner_email, id, 'Allenamento A', 1
FROM weeks
WHERE EXISTS (SELECT 1 FROM exercises WHERE exercises.week = weeks.id)
  AND NOT EXISTS (SELECT 1 FROM workouts WHERE workouts.week_id = weeks.id);
UPDATE exercises
SET workout_id = (
  SELECT id FROM workouts
  WHERE workouts.week_id = exercises.week
    AND workouts.owner_email = exercises.owner_email
  ORDER BY position, id LIMIT 1
)
WHERE workout_id IS NULL;
CREATE INDEX IF NOT EXISTS exercises_owner_workout_idx
  ON exercises (owner_email, workout_id, position);
