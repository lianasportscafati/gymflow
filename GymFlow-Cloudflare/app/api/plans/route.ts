import { asc, eq, max } from "drizzle-orm";
import { ensureSchema, ensureUserWeeks, getAuthenticatedEmail, getDb } from "../../../db";
import { workoutPlans } from "../../../db/schema";

export async function GET(request: Request) {
  try {
    const ownerEmail = getAuthenticatedEmail(request);
    await ensureUserWeeks(ownerEmail);
    const plans = await getDb().select().from(workoutPlans)
      .where(eq(workoutPlans.ownerEmail, ownerEmail))
      .orderBy(asc(workoutPlans.position), asc(workoutPlans.id));
    return Response.json({ plans });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Errore imprevisto" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ownerEmail = getAuthenticatedEmail(request);
    await ensureSchema();
    const payload = (await request.json()) as { name?: string };
    const name = payload.name?.trim() ?? "";
    if (!name) return Response.json({ error: "Inserisci il nome della scheda." }, { status: 400 });
    const db = getDb();
    const [result] = await db.select({ value: max(workoutPlans.position) }).from(workoutPlans)
      .where(eq(workoutPlans.ownerEmail, ownerEmail));
    const [plan] = await db.insert(workoutPlans)
      .values({ ownerEmail, name, position: (result?.value ?? 0) + 1 }).returning();
    return Response.json({ plan }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Errore imprevisto" }, { status: 400 });
  }
}
