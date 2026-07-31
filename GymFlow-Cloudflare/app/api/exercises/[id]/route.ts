import { and, eq } from "drizzle-orm";
import { ensureSchema, getAuthenticatedEmail, getDb } from "../../../../db";
import { exercises, weeks } from "../../../../db/schema";
import { calculateWeight } from "../../../../lib/weight";

type Params = { params: Promise<{ id: string }> };

type ExerciseInput = {
  week?: number;
  name?: string;
  muscleGroup?: string;
  sets?: number;
  reps?: string;
  weight?: string;
  baseWeight?: string;
  weightPercentage?: number | null;
  notes?: string;
};

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new Error("Esercizio non valido.");
  return id;
}

function cleanInput(payload: ExerciseInput) {
  const week = Number(payload.week);
  const name = payload.name?.trim() ?? "";
  const sets = Number(payload.sets);
  if (!name) throw new Error("Inserisci il nome dell’esercizio.");
  if (!Number.isInteger(week) || week < 1) throw new Error("Seleziona una settimana valida.");
  if (!Number.isInteger(sets) || sets < 1 || sets > 99) throw new Error("Il numero di serie non è valido.");
  const baseWeight = payload.baseWeight?.trim() ?? "";
  const rawPercentage = Number(payload.weightPercentage);
  const weightPercentage =
    payload.weightPercentage === null || payload.weightPercentage === undefined || !Number.isFinite(rawPercentage)
      ? null
      : Math.max(1, Math.min(100, Math.round(rawPercentage)));
  return {
    week,
    name,
    muscleGroup: payload.muscleGroup?.trim() ?? "",
    sets,
    reps: payload.reps?.trim() || "—",
    weight: calculateWeight(baseWeight, weightPercentage) || payload.weight?.trim() || "",
    baseWeight,
    weightPercentage,
    notes: payload.notes?.trim() ?? "",
    updatedAt: new Date().toISOString(),
  };
}

function errorResponse(error: unknown) {
  return Response.json(
    { error: error instanceof Error ? error.message : "Errore imprevisto" },
    { status: 400 },
  );
}

export async function PUT(request: Request, { params }: Params) {
  try {
    await ensureSchema();
    const ownerEmail = getAuthenticatedEmail(request);
    const id = parseId((await params).id);
    const values = cleanInput((await request.json()) as ExerciseInput);
    const db = getDb();
    const [currentExercise] = await db
      .select({ week: exercises.week })
      .from(exercises)
      .where(and(eq(exercises.id, id), eq(exercises.ownerEmail, ownerEmail)))
      .limit(1);
    if (!currentExercise) {
      return Response.json({ error: "Esercizio non trovato." }, { status: 404 });
    }
    const [targetWeek] = await db
      .select({ id: weeks.id })
      .from(weeks)
      .where(and(eq(weeks.id, values.week), eq(weeks.ownerEmail, ownerEmail)))
      .limit(1);
    if (!targetWeek) return Response.json({ error: "La settimana selezionata non esiste più." }, { status: 400 });
    const [exercise] = await db
      .update(exercises)
      .set(values)
      .where(and(eq(exercises.id, id), eq(exercises.ownerEmail, ownerEmail)))
      .returning();
    if (!exercise) return Response.json({ error: "Esercizio non trovato." }, { status: 404 });
    return Response.json({ exercise });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    await ensureSchema();
    const ownerEmail = getAuthenticatedEmail(request);
    const id = parseId((await params).id);
    const db = getDb();
    const [currentExercise] = await db
      .select({ week: exercises.week })
      .from(exercises)
      .where(and(eq(exercises.id, id), eq(exercises.ownerEmail, ownerEmail)))
      .limit(1);
    if (!currentExercise) {
      return Response.json({ error: "Esercizio non trovato." }, { status: 404 });
    }
    const [exercise] = await db
      .delete(exercises)
      .where(and(eq(exercises.id, id), eq(exercises.ownerEmail, ownerEmail)))
      .returning();
    if (!exercise) return Response.json({ error: "Esercizio non trovato." }, { status: 404 });
    return Response.json({ deleted: true, id });
  } catch (error) {
    return errorResponse(error);
  }
}
