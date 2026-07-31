import { and, asc, eq } from "drizzle-orm";
import { ensureSchema, getAuthenticatedEmail, getDb } from "../../../db";
import { exercises, weeks, workouts } from "../../../db/schema";
import { calculateWeight } from "../../../lib/weight";

type ExerciseInput = {
  week?: number;
  workoutId?: number;
  name?: string;
  muscleGroup?: string;
  sets?: number;
  reps?: string;
  weight?: string;
  baseWeight?: string;
  weightPercentage?: number | null;
  recoverySeconds?: number;
  notes?: string;
};

function cleanInput(payload: ExerciseInput) {
  const week = Number(payload.week);
  const workoutId = Number(payload.workoutId);
  const name = payload.name?.trim() ?? "";
  const sets = Number(payload.sets);
  if (!name) throw new Error("Inserisci il nome dell’esercizio.");
  if (!Number.isInteger(week) || week < 1) throw new Error("Seleziona una settimana valida.");
  if (!Number.isInteger(workoutId) || workoutId < 1) throw new Error("Seleziona un allenamento valido.");
  if (!Number.isInteger(sets) || sets < 1 || sets > 99) throw new Error("Il numero di serie non è valido.");
  const baseWeight = payload.baseWeight?.trim() ?? "";
  const rawPercentage = Number(payload.weightPercentage);
  const weightPercentage =
    payload.weightPercentage === null || payload.weightPercentage === undefined || !Number.isFinite(rawPercentage)
      ? null
      : Math.max(0.1, Math.min(100, Math.round(rawPercentage * 100) / 100));
  const recoverySeconds = Number(payload.recoverySeconds ?? 0);
  if (!Number.isInteger(recoverySeconds) || recoverySeconds < 0 || recoverySeconds > 3600) {
    throw new Error("Il tempo di recupero deve essere espresso in secondi, da 0 a 3600.");
  }
  return {
    week,
    workoutId,
    name,
    muscleGroup: payload.muscleGroup?.trim() ?? "",
    sets,
    reps: payload.reps?.trim() || "—",
    weight: calculateWeight(baseWeight, weightPercentage) || payload.weight?.trim() || "",
    baseWeight,
    weightPercentage,
    recoverySeconds,
    notes: payload.notes?.trim() ?? "",
  };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Errore imprevisto";
  return Response.json({ error: message }, { status: message.includes("D1") ? 500 : 400 });
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const ownerEmail = getAuthenticatedEmail(request);
    const rows = await getDb()
      .select()
      .from(exercises)
      .where(eq(exercises.ownerEmail, ownerEmail))
      .orderBy(asc(exercises.week), asc(exercises.position), asc(exercises.id));
    return Response.json({ exercises: rows });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const ownerEmail = getAuthenticatedEmail(request);
    const values = cleanInput((await request.json()) as ExerciseInput);
    const db = getDb();
    const [targetWeek] = await db
      .select({ id: weeks.id })
      .from(weeks)
      .where(and(eq(weeks.id, values.week), eq(weeks.ownerEmail, ownerEmail)))
      .limit(1);
    if (!targetWeek) return Response.json({ error: "La settimana selezionata non esiste più." }, { status: 400 });
    const [targetWorkout] = await db.select({ id: workouts.id }).from(workouts)
      .where(and(eq(workouts.id, values.workoutId), eq(workouts.weekId, values.week), eq(workouts.ownerEmail, ownerEmail))).limit(1);
    if (!targetWorkout) return Response.json({ error: "L’allenamento selezionato non esiste più." }, { status: 400 });
    const [exercise] = await db
      .insert(exercises)
      .values({ ...values, ownerEmail })
      .returning();
    return Response.json({ exercise }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
