import { and, asc, eq } from "drizzle-orm";
import { ensureSchema, getAuthenticatedEmail, getDb } from "../../../db";
import { exercises, weeks } from "../../../db/schema";

type ExerciseInput = {
  week?: number;
  name?: string;
  muscleGroup?: string;
  sets?: number;
  reps?: string;
  weight?: string;
  notes?: string;
};

function cleanInput(payload: ExerciseInput) {
  const week = Number(payload.week);
  const name = payload.name?.trim() ?? "";
  const sets = Number(payload.sets);
  if (!name) throw new Error("Inserisci il nome dell’esercizio.");
  if (!Number.isInteger(week) || week < 1) throw new Error("Seleziona una settimana valida.");
  if (!Number.isInteger(sets) || sets < 1 || sets > 99) throw new Error("Il numero di serie non è valido.");
  return {
    week,
    name,
    muscleGroup: payload.muscleGroup?.trim() ?? "",
    sets,
    reps: payload.reps?.trim() || "—",
    weight: payload.weight?.trim() ?? "",
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
    const [exercise] = await db
      .insert(exercises)
      .values({ ...values, ownerEmail })
      .returning();
    return Response.json({ exercise }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
