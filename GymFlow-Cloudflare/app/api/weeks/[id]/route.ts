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
    const payload = (await request.json()) as {
      name?: string;
      completed?: boolean;
      archived?: boolean;
    };
    const db = getDb();
    const [currentWeek] = await db
      .select()
      .from(weeks)
      .where(and(eq(weeks.id, id), eq(weeks.ownerEmail, ownerEmail)))
      .limit(1);
    if (!currentWeek) {
      return Response.json({ error: "Settimana non trovata." }, { status: 404 });
    }
    if (
      currentWeek.archived &&
      payload.archived !== false &&
      (payload.name !== undefined || payload.completed !== undefined)
    ) {
      return Response.json(
        { error: "La settimana archiviata è in sola lettura. Ripristinala prima di modificarla." },
        { status: 409 },
      );
    }

    const update: {
      name?: string;
      completed?: boolean;
      archived?: boolean;
      archivedAt?: string | null;
    } = {};
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
    if (typeof payload.archived === "boolean") {
      if (payload.archived) {
        const willBeCompleted = update.completed ?? currentWeek.completed;
        if (!willBeCompleted) {
          return Response.json(
            { error: "Completa la settimana prima di archiviarla." },
            { status: 409 },
          );
        }
        update.archived = true;
        update.archivedAt = currentWeek.archivedAt ?? new Date().toISOString();
      } else {
        update.archived = false;
        update.archivedAt = null;
      }
    }
    if (Object.keys(update).length === 0) {
      return Response.json(
        { error: "Nessuna modifica valida ricevuta." },
        { status: 400 },
      );
    }
    const [week] = await db
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
    const [currentWeek] = await getDb()
      .select({ archived: weeks.archived })
      .from(weeks)
      .where(and(eq(weeks.id, id), eq(weeks.ownerEmail, ownerEmail)))
      .limit(1);
    if (!currentWeek) {
      return Response.json({ error: "Settimana non trovata." }, { status: 404 });
    }
    if (currentWeek.archived) {
      return Response.json(
        { error: "Ripristina la settimana dall’archivio prima di eliminarla." },
        { status: 409 },
      );
    }
    const database = getDatabase();
    const [, deletedWeek] = await database.batch([
      database
        .prepare("DELETE FROM exercises WHERE week = ? AND owner_email = ?")
        .bind(id, ownerEmail),
      database
        .prepare("DELETE FROM weeks WHERE id = ? AND owner_email = ?")
        .bind(id, ownerEmail),
    ]);
    if ((deletedWeek.meta.changes ?? 0) < 1)
      return Response.json({ error: "Settimana non trovata." }, { status: 404 });
    return Response.json({ deleted: true, id });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Errore imprevisto" }, { status: 400 });
  }
}
