import { and, asc, eq, max } from "drizzle-orm";
import { ensureSchema, ensureUserWeeks, getAuthenticatedEmail, getDb } from "../../../db";
import { weeks, workoutPlans } from "../../../db/schema";

const ACCENTS = ["#c8ff5a", "#8ee7ff", "#c9b6ff", "#ff9e80", "#ffd85a", "#85f2c4"];

export async function GET(request: Request) {
  try {
    const ownerEmail = getAuthenticatedEmail(request);
    await ensureUserWeeks(ownerEmail);
    const rows = await getDb()
      .select()
      .from(weeks)
      .where(eq(weeks.ownerEmail, ownerEmail))
      .orderBy(asc(weeks.position), asc(weeks.id));
    return Response.json({ weeks: rows });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Errore imprevisto" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const ownerEmail = getAuthenticatedEmail(request);
    const payload = (await request.json()) as { name?: string; planId?: number };
    const name = payload.name?.trim() ?? "";
    const planId = Number(payload.planId);
    if (!name) return Response.json({ error: "Inserisci il nome della settimana." }, { status: 400 });
    if (!Number.isInteger(planId) || planId < 1) {
      return Response.json({ error: "Seleziona una scheda valida." }, { status: 400 });
    }
    const db = getDb();
    const [plan] = await db.select({ id: workoutPlans.id }).from(workoutPlans)
      .where(and(eq(workoutPlans.id, planId), eq(workoutPlans.ownerEmail, ownerEmail))).limit(1);
    if (!plan) return Response.json({ error: "Scheda non trovata." }, { status: 404 });
    const [result] = await db
      .select({ value: max(weeks.position) })
      .from(weeks)
      .where(eq(weeks.ownerEmail, ownerEmail));
    const position = (result?.value ?? 0) + 1;
    const accent = ACCENTS[(position - 1) % ACCENTS.length];
    const [week] = await db
      .insert(weeks)
      .values({ ownerEmail, planId, name, accent, position })
      .returning();
    return Response.json({ week }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Errore imprevisto" }, { status: 400 });
  }
}
