import { and, eq } from "drizzle-orm";
import { ensureSchema, getAuthenticatedEmail, getDatabase, getDb } from "../../../../db";
import { workoutPlans } from "../../../../db/schema";

type Params = { params: Promise<{ id: string }> };
const parseId = (value: string) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new Error("Scheda non valida.");
  return id;
};

export async function PUT(request: Request, { params }: Params) {
  try {
    await ensureSchema();
    const ownerEmail = getAuthenticatedEmail(request);
    const id = parseId((await params).id);
    const payload = (await request.json()) as { name?: string; archived?: boolean };
    const update: { name?: string; archived?: boolean; archivedAt?: string | null; updatedAt: string } = {
      updatedAt: new Date().toISOString(),
    };
    if (payload.name !== undefined) {
      const name = payload.name.trim();
      if (!name) return Response.json({ error: "Inserisci il nome della scheda." }, { status: 400 });
      update.name = name;
    }
    if (typeof payload.archived === "boolean") {
      update.archived = payload.archived;
      update.archivedAt = payload.archived ? new Date().toISOString() : null;
    }
    if (update.name === undefined && update.archived === undefined) {
      return Response.json({ error: "Nessuna modifica valida ricevuta." }, { status: 400 });
    }
    const [plan] = await getDb().update(workoutPlans).set(update)
      .where(and(eq(workoutPlans.id, id), eq(workoutPlans.ownerEmail, ownerEmail))).returning();
    if (!plan) return Response.json({ error: "Scheda non trovata." }, { status: 404 });
    return Response.json({ plan });
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
    const plan = await database.prepare(
      "SELECT id FROM workout_plans WHERE id = ? AND owner_email = ?",
    ).bind(id, ownerEmail).first();
    if (!plan) return Response.json({ error: "Scheda non trovata." }, { status: 404 });
    await database.batch([
      database.prepare(
        "DELETE FROM exercises WHERE owner_email = ? AND week IN (SELECT id FROM weeks WHERE plan_id = ? AND owner_email = ?)",
      ).bind(ownerEmail, id, ownerEmail),
      database.prepare("DELETE FROM weeks WHERE plan_id = ? AND owner_email = ?").bind(id, ownerEmail),
      database.prepare("DELETE FROM workout_plans WHERE id = ? AND owner_email = ?").bind(id, ownerEmail),
    ]);
    return Response.json({ deleted: true, id });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Errore imprevisto" }, { status: 400 });
  }
}
