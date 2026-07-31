import { and, asc, eq, max } from "drizzle-orm";
import { ensureSchema, getAuthenticatedEmail, getDb } from "../../../db";
import { weeks, workouts } from "../../../db/schema";

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const ownerEmail = getAuthenticatedEmail(request);
    const rows = await getDb().select().from(workouts)
      .where(eq(workouts.ownerEmail, ownerEmail))
      .orderBy(asc(workouts.weekId), asc(workouts.position), asc(workouts.id));
    return Response.json({ workouts: rows });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Errore imprevisto" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const ownerEmail = getAuthenticatedEmail(request);
    const payload = (await request.json()) as { weekId?: number; name?: string };
    const weekId = Number(payload.weekId);
    const name = payload.name?.trim() ?? "";
    if (!Number.isInteger(weekId) || weekId < 1) return Response.json({ error: "Settimana non valida." }, { status: 400 });
    if (!name) return Response.json({ error: "Inserisci il nome dell’allenamento." }, { status: 400 });
    const db = getDb();
    const [week] = await db.select({ id: weeks.id }).from(weeks)
      .where(and(eq(weeks.id, weekId), eq(weeks.ownerEmail, ownerEmail))).limit(1);
    if (!week) return Response.json({ error: "Settimana non trovata." }, { status: 404 });
    const [last] = await db.select({ value: max(workouts.position) }).from(workouts)
      .where(and(eq(workouts.weekId, weekId), eq(workouts.ownerEmail, ownerEmail)));
    const [workout] = await db.insert(workouts)
      .values({ ownerEmail, weekId, name, position: (last?.value ?? 0) + 1 }).returning();
    return Response.json({ workout }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Errore imprevisto" }, { status: 400 });
  }
}
