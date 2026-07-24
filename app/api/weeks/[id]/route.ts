import { and, eq } from "drizzle-orm";
import { ensureSchema, getAuthenticatedEmail, getDatabase, getDb } from "../../../../db";
import { weeks } from "../../../../db/schema";

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
    const payload = (await request.json()) as { name?: string; completed?: boolean };
    const update: { name?: string; completed?: boolean } = {};
    if (payload.name !== undefined) {
      const name = payload.name.trim();
      if (!name) {
        return Response.json(
          { error: "Inserisci il nome della settimana." },
          { status: 400 },
        );
      }
      update.name = name;
    }
    if (typeof payload.completed === "boolean") {
      update.completed = payload.completed;
    }
    if (Object.keys(update).length === 0) {
      return Response.json(
        { error: "Nessuna modifica valida ricevuta." },
        { status: 400 },
      );
    }
    const [week] = await getDb()
      .update(weeks)
      .set(update)
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
    const database = getDatabase();
    const [, deletedWeek] = await database.batch([
      database
        .prepare("DELETE FROM exercises WHERE week = ? AND owner_email = ?")
        .bind(id, ownerEmail),
      database
        .prepare("DELETE FROM weeks WHERE id = ? AND owner_email = ?")
        .bind(id, ownerEmail),
    ]);
    if ((deletedWeek.meta.changes ?? 0) < 1) {
      return Response.json({ error: "Settimana non trovata." }, { status: 404 });
    }
    return Response.json({ deleted: true, id });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Errore imprevisto" }, { status: 400 });
  }
}
