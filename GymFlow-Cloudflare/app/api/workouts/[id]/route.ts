import { and, eq } from "drizzle-orm";
import { ensureSchema, getAuthenticatedEmail, getDatabase, getDb } from "../../../../db";
import { workouts } from "../../../../db/schema";

type Params = { params: Promise<{ id: string }> };
const parseId = (value: string) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new Error("Allenamento non valido.");
  return id;
};

export async function PUT(request: Request, { params }: Params) {
  try {
    await ensureSchema();
    const ownerEmail = getAuthenticatedEmail(request);
    const id = parseId((await params).id);
    const payload = (await request.json()) as { name?: string; completed?: boolean };
    const update: { name?: string; completed?: boolean; updatedAt: string } = { updatedAt: new Date().toISOString() };
    if (payload.name !== undefined) {
      const name = payload.name.trim();
      if (!name) return Response.json({ error: "Inserisci il nome dell’allenamento." }, { status: 400 });
      update.name = name;
    }
    if (typeof payload.completed === "boolean") update.completed = payload.completed;
    if (update.name === undefined && update.completed === undefined) {
      return Response.json({ error: "Nessuna modifica valida ricevuta." }, { status: 400 });
    }
    const [workout] = await getDb().update(workouts).set(update)
      .where(and(eq(workouts.id, id), eq(workouts.ownerEmail, ownerEmail))).returning();
    if (!workout) return Response.json({ error: "Allenamento non trovato." }, { status: 404 });
    return Response.json({ workout });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Errore imprevisto" }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    await ensureSchema();
    const ownerEmail = getAuthenticatedEmail(request);
    const id = parseId((await params).id);
    const database = getDatabase();
    const workout = await database.prepare("SELECT id FROM workouts WHERE id = ? AND owner_email = ?")
      .bind(id, ownerEmail).first();
    if (!workout) return Response.json({ error: "Allenamento non trovato." }, { status: 404 });
    await database.batch([
      database.prepare("DELETE FROM exercises WHERE workout_id = ? AND owner_email = ?").bind(id, ownerEmail),
      database.prepare("DELETE FROM workouts WHERE id = ? AND owner_email = ?").bind(id, ownerEmail),
    ]);
    return Response.json({ deleted: true, id });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Errore imprevisto" }, { status: 400 });
  }
}
