import { asc, eq } from "drizzle-orm";
import { ensureUserWeeks, getAuthenticatedEmail, getDb } from "../../../db";
import { exercises, weeks, workouts, workoutPlans } from "../../../db/schema";

export async function GET(request: Request) {
  try {
    const ownerEmail = getAuthenticatedEmail(request);
    await ensureUserWeeks(ownerEmail);
    const db = getDb();
    const [plans, userWeeks, userWorkouts, userExercises] = await Promise.all([
      db.select().from(workoutPlans).where(eq(workoutPlans.ownerEmail, ownerEmail))
        .orderBy(asc(workoutPlans.position), asc(workoutPlans.id)),
      db.select().from(weeks).where(eq(weeks.ownerEmail, ownerEmail))
        .orderBy(asc(weeks.position), asc(weeks.id)),
      db.select().from(workouts).where(eq(workouts.ownerEmail, ownerEmail))
        .orderBy(asc(workouts.weekId), asc(workouts.position), asc(workouts.id)),
      db.select().from(exercises).where(eq(exercises.ownerEmail, ownerEmail))
        .orderBy(asc(exercises.week), asc(exercises.position), asc(exercises.id)),
    ]);
    return Response.json({ plans, weeks: userWeeks, workouts: userWorkouts, exercises: userExercises });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Errore nel caricamento dei dati" },
      { status: 500 },
    );
  }
}
