import { and, eq } from "drizzle-orm";
import { ensureSchema, getAuthenticatedEmail, getDb } from "../../../../db";
import { exercises, weeks } from "../../../../db/schema";

type Params = { params: Promise<{ id: string }> };

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new Error("Settimana non valida.");
  return id;
}

export async function PUT(request: Request, { params }: Params) {
  try {
    await ensureSchema();
    const ownerEmail = getAuthenticatedEmail(request);
    const id = parseId((await params).id);
    const payload = (await request.json()) as { name?: string };
    const name = payload.name?.trim() ?? "";
    if (!name) return Response.json({ error: "Inserisci il nome della settimana." }, { status: 400 });
    const [week] = await getDb()
      .update(weeks)
      .set({ name })
      .where(and(eq(weeks.id, id), eq(weeks.ownerEmail, ownerEmail)))
      .returning();
    if (!week) return Response.json({ error: "Settimana non trovata." }, { status: 404 });
    return Response.json({ week });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Errore imprevisto" }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    await ensureSchema();
    const ownerEmail = getAuthenticatedEmail(request);
    const id = parseId((await params).id);
    const db = getDb();
    const [deletedExercises, deletedWeeks] = await Promise.all([
      db
        .delete(exercises)
        .where(and(eq(exercises.week, id), eq(exercises.ownerEmail, ownerEmail)))
        .returning({ id: exercises.id }),
      db
        .delete(weeks)
        .where(and(eq(weeks.id, id), eq(weeks.ownerEmail, ownerEmail)))
        .returning(),
    ]);
    const [week] = deletedWeeks;
    if (!week) return Response.json({ error: "Settimana non trovata." }, { status: 404 });
    return Response.json({ deleted: true, id, deletedExercises: deletedExercises.length });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Errore imprevisto" }, { status: 400 });
  }
}
