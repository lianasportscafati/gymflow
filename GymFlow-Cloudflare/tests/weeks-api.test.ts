import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Miniflare } from "miniflare";
import { GET as getPlans, POST as createPlan } from "../app/api/plans/route";
import { DELETE as deletePlan, PUT as updatePlan } from "../app/api/plans/[id]/route";
import { GET as getWeeks, POST as createWeek } from "../app/api/weeks/route";
import { PUT as updateWeek } from "../app/api/weeks/[id]/route";
import { GET as getExercises, POST as createExercise } from "../app/api/exercises/route";
import { PUT as updateExercise } from "../app/api/exercises/[id]/route";
import { GET as getWorkouts, POST as createWorkout } from "../app/api/workouts/route";
import { DELETE as deleteWorkout, PUT as updateWorkout } from "../app/api/workouts/[id]/route";
import { GET as bootstrap } from "../app/api/bootstrap/route";

const userA = "utente-a@example.com";
const userB = "utente-b@example.com";
const userC = "utente-c@example.com";
let miniflare: Miniflare;

const request = (path: string, email?: string, method = "GET", body?: Record<string, unknown>) => {
  const headers = new Headers();
  if (email) headers.set("cf-access-authenticated-user-email", email);
  if (body) headers.set("content-type", "application/json");
  return new Request(`https://gymflow.test${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
};
const json = async <T>(response: Response) => await response.json() as T;
const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });

before(async () => {
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok') } }",
    d1Databases: ["DB"],
  });
  const DB = await miniflare.getD1Database("DB");
  (globalThis as typeof globalThis & { __GYMFLOW_ENV__?: { DB: unknown } }).__GYMFLOW_ENV__ = { DB };
});
after(() => {
  delete (globalThis as typeof globalThis & { __GYMFLOW_ENV__?: unknown }).__GYMFLOW_ENV__;
  void miniflare.dispose();
});

test("scheda completa: creazione, contenuto, archivio modificabile, ripristino ed eliminazione", async () => {
  assert.notEqual((await getPlans(request("/api/plans"))).status, 200);

  const initial = await json<{ plans: Array<{ id: number; name: string }> }>(
    await getPlans(request("/api/plans", userA)),
  );
  assert.equal(initial.plans.length, 1);
  assert.equal(initial.plans[0].name, "La mia scheda");

  const createdPlanResponse = await createPlan(
    request("/api/plans", userA, "POST", { name: "Forza e massa" }),
  );
  assert.equal(createdPlanResponse.status, 201);
  const plan = (await json<{ plan: { id: number; archived: boolean } }>(createdPlanResponse)).plan;

  const weekResponse = await createWeek(
    request("/api/weeks", userA, "POST", { planId: plan.id, name: "Settimana forza" }),
  );
  assert.equal(weekResponse.status, 201);
  const week = (await json<{ week: { id: number; planId: number } }>(weekResponse)).week;
  assert.equal(week.planId, plan.id);

  const workoutAResponse = await createWorkout(
    request("/api/workouts", userA, "POST", { weekId: week.id, name: "Allenamento A" }),
  );
  const workoutA = (await json<{ workout: { id: number; name: string } }>(workoutAResponse)).workout;
  assert.equal(workoutAResponse.status, 201);
  const workoutBResponse = await createWorkout(
    request("/api/workouts", userA, "POST", { weekId: week.id, name: "Allenamento B" }),
  );
  const workoutB = (await json<{ workout: { id: number } }>(workoutBResponse)).workout;
  assert.equal(workoutBResponse.status, 201);

  const exerciseResponse = await createExercise(
    request("/api/exercises", userA, "POST", {
      week: week.id, workoutId: workoutA.id, name: "Squat", muscleGroup: "Gambe", sets: 4, reps: "8",
      baseWeight: "60", weightPercentage: 57.5, notes: "Mantieni il controllo in discesa",
    }),
  );
  assert.equal(exerciseResponse.status, 201);
  const exercise = (await json<{
    exercise: { id: number; weight: string; baseWeight: string; weightPercentage: number };
  }>(exerciseResponse)).exercise;
  assert.equal(exercise.weight, "34,5 kg");
  assert.equal(exercise.baseWeight, "60");
  assert.equal(exercise.weightPercentage, 57.5);

  const archivedResponse = await updatePlan(
    request(`/api/plans/${plan.id}`, userA, "PUT", { archived: true }), params(plan.id),
  );
  assert.equal(archivedResponse.status, 200);
  const archived = (await json<{ plan: { archived: boolean; archivedAt: string } }>(archivedResponse)).plan;
  assert.equal(archived.archived, true);
  assert.ok(archived.archivedAt);

  const persistedWeeks = await json<{ weeks: Array<{ id: number; planId: number }> }>(
    await getWeeks(request("/api/weeks", userA)),
  );
  assert.ok(persistedWeeks.weeks.some((item) => item.id === week.id && item.planId === plan.id));
  const persistedExercises = await json<{ exercises: Array<{ id: number }> }>(
    await getExercises(request("/api/exercises", userA)),
  );
  assert.ok(persistedExercises.exercises.some((item) => item.id === exercise.id));

  const renameArchived = await updatePlan(
    request(`/api/plans/${plan.id}`, userA, "PUT", { name: "Forza aggiornata" }), params(plan.id),
  );
  assert.equal(renameArchived.status, 200, "una scheda archiviata deve poter essere rinominata");
  const editArchivedWeek = await updateWeek(
    request(`/api/weeks/${week.id}`, userA, "PUT", { name: "Settimana modificata" }), params(week.id),
  );
  assert.equal(editArchivedWeek.status, 200, "le settimane archiviate devono restare modificabili");
  const editArchivedExercise = await updateExercise(
    request(`/api/exercises/${exercise.id}`, userA, "PUT", {
      week: week.id, workoutId: workoutA.id, name: "Back squat", muscleGroup: "Gambe", sets: 5, reps: "5", weight: "70 kg",
    }), params(exercise.id),
  );
  assert.equal(editArchivedExercise.status, 200, "gli esercizi archiviati devono restare modificabili");

  const renamedWorkout = await updateWorkout(
    request(`/api/workouts/${workoutB.id}`, userA, "PUT", { name: "Allenamento B forza" }), params(workoutB.id),
  );
  assert.equal(renamedWorkout.status, 200);
  assert.equal((await json<{ workout: { name: string } }>(renamedWorkout)).workout.name, "Allenamento B forza");
  const completedWorkout = await updateWorkout(
    request(`/api/workouts/${workoutA.id}`, userA, "PUT", { completed: true }), params(workoutA.id),
  );
  assert.equal(completedWorkout.status, 200);
  assert.equal((await json<{ workout: { completed: boolean } }>(completedWorkout)).workout.completed, true);
  const listedWorkouts = await json<{ workouts: Array<{ id: number }> }>(
    await getWorkouts(request("/api/workouts", userA)),
  );
  assert.ok(listedWorkouts.workouts.some((item) => item.id === workoutA.id));
  const bootstrapResponse = await bootstrap(request("/api/bootstrap", userA));
  assert.equal(bootstrapResponse.status, 200);
  const bootstrapped = await json<{
    plans: unknown[]; weeks: unknown[]; workouts: Array<{ id: number; completed: boolean }>; exercises: Array<{ id: number }>;
  }>(bootstrapResponse);
  assert.ok(bootstrapped.plans.length > 0);
  assert.ok(bootstrapped.weeks.length > 0);
  assert.ok(bootstrapped.workouts.some((item) => item.id === workoutA.id));
  assert.equal(bootstrapped.workouts.find((item) => item.id === workoutA.id)?.completed, true);
  assert.ok(bootstrapped.exercises.some((item) => item.id === exercise.id));
  const deletedWorkout = await deleteWorkout(
    request(`/api/workouts/${workoutB.id}`, userA, "DELETE"), params(workoutB.id),
  );
  assert.equal(deletedWorkout.status, 200);

  const otherUserEdit = await updatePlan(
    request(`/api/plans/${plan.id}`, userB, "PUT", { name: "Intrusione" }), params(plan.id),
  );
  assert.equal(otherUserEdit.status, 404);

  const restored = await updatePlan(
    request(`/api/plans/${plan.id}`, userA, "PUT", { archived: false }), params(plan.id),
  );
  assert.equal((await json<{ plan: { archived: boolean; archivedAt: null } }>(restored)).plan.archived, false);

  const deleted = await deletePlan(
    request(`/api/plans/${plan.id}`, userA, "DELETE"), params(plan.id),
  );
  assert.equal(deleted.status, 200);
  const afterDeleteWeeks = await json<{ weeks: Array<{ id: number }> }>(
    await getWeeks(request("/api/weeks", userA)),
  );
  const afterDeleteExercises = await json<{ exercises: Array<{ id: number }> }>(
    await getExercises(request("/api/exercises", userA)),
  );
  assert.ok(!afterDeleteWeeks.weeks.some((item) => item.id === week.id));
  assert.ok(!afterDeleteExercises.exercises.some((item) => item.id === exercise.id));
});

test("una settimana può essere creata solo dentro una scheda dello stesso utente", async () => {
  const otherPlans = await json<{ plans: Array<{ id: number }> }>(
    await getPlans(request("/api/plans", userB)),
  );
  const response = await createWeek(
    request("/api/weeks", userA, "POST", { planId: otherPlans.plans[0].id, name: "Non consentita" }),
  );
  assert.equal(response.status, 404);
});

test("dopo aver eliminato l'unica scheda l'account resta vuoto e può crearne una nuova", async () => {
  const initial = await json<{ plans: Array<{ id: number }> }>(
    await getPlans(request("/api/plans", userC)),
  );
  assert.equal(initial.plans.length, 1);

  const deleted = await deletePlan(
    request(`/api/plans/${initial.plans[0].id}`, userC, "DELETE"),
    params(initial.plans[0].id),
  );
  assert.equal(deleted.status, 200);

  const afterRefresh = await getPlans(request("/api/plans", userC));
  assert.equal(afterRefresh.status, 200);
  assert.deepEqual(
    (await json<{ plans: unknown[] }>(afterRefresh)).plans,
    [],
    "il refresh non deve ricreare automaticamente la scheda eliminata",
  );

  const created = await createPlan(
    request("/api/plans", userC, "POST", { name: "Nuova scheda" }),
  );
  assert.equal(created.status, 201);
  assert.equal(
    (await json<{ plan: { name: string } }>(created)).plan.name,
    "Nuova scheda",
  );
});
