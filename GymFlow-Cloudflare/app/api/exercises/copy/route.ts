import { and, asc, eq, inArray } from "drizzle-orm";
import { ensureSchema, getAuthenticatedEmail, getDb } from "../../../../db";
import { exercises, weeks } from "../../../../db/schema";

type CopyInput = {
  exerciseIds?: number[];
  targetWeek?: number;
};

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const ownerEmail = getAuthenticatedEmail(request);
    const payload = (await request.json()) as CopyInput;
    const exerciseIds = [...new Set(payload.exerciseIds ?? [])]
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0);
    const targetWeek = Number(payload.targetWeek);
    if (!exerciseIds.length) {
      return Response.json({ error: "Seleziona almeno un esercizio." }, { status: 400 });
    }
    if (!Number.isInteger(targetWeek) || targetWeek < 1) {
      return Response.json({ error: "Seleziona una settimana di destinazione." }, { status: 400 });
    }

    const db = getDb();
    const [week] = await db
      .select({ id: weeks.id })
      .from(weeks)
      .where(and(eq(weeks.id, targetWeek), eq(weeks.ownerEmail, ownerEmail)))
      .limit(1);
    if (!week) {
      return Response.json({ error: "La settimana di destinazione non esiste." }, { status: 404 });
    }

    const source = await db
      .select()
      .from(exercises)
      .where(and(eq(exercises.ownerEmail, ownerEmail), inArray(exercises.id, exerciseIds)))
      .orderBy(asc(exercises.position), asc(exercises.id));
    if (!source.length) {
      return Response.json({ error: "Gli esercizi selezionati non esistono più." }, { status: 404 });
    }

    const current = await db
      .select({ position: exercises.position })
      .from(exercises)
      .where(and(eq(exercises.ownerEmail, ownerEmail), eq(exercises.week, targetWeek)))
      .orderBy(asc(exercises.position));
    const startPosition = current.reduce((max, item) => Math.max(max, item.position), 0);
    const copied = await db
      .insert(exercises)
      .values(
        source.map((item, index) => ({
          ownerEmail,
          week: targetWeek,
          name: item.name,
          muscleGroup: item.muscleGroup,
          sets: item.sets,
          reps: item.reps,
          weight: item.weight,
          baseWeight: item.baseWeight,
          weightPercentage: item.weightPercentage,
          recoverySeconds: item.recoverySeconds,
          notes: item.notes,
          position: startPosition + index + 1,
        })),
      )
      .returning();
    return Response.json({ exercises: copied }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Errore imprevisto" },
      { status: 400 },
    );
  }
}
