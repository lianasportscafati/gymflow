import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Miniflare } from "miniflare";
import {
  GET as getWeeks,
  POST as createWeek,
} from "../app/api/weeks/route";
import {
  DELETE as deleteWeek,
  PUT as updateWeek,
} from "../app/api/weeks/[id]/route";
import {
  GET as getExercises,
  POST as createExercise,
} from "../app/api/exercises/route";
import {
  DELETE as deleteExercise,
  PUT as updateExercise,
} from "../app/api/exercises/[id]/route";
import { POST as copyExercises } from "../app/api/exercises/copy/route";

const userA = "utente-a@example.com";
const userB = "utente-b@example.com";
let miniflare: Miniflare;

type WeekRecord = {
  id: number;
  name: string;
  completed: boolean;
  archived: boolean;
  archivedAt: string | null;
};

type ExerciseRecord = {
  id: number;
  name: string;
};

function request(
  path: string,
  email?: string,
  method = "GET",
  body?: Record<string, unknown>,
) {
  const headers = new Headers();
  if (email) headers.set("cf-access-authenticated-user-email", email);
  if (body) headers.set("content-type", "application/json");
  return new Request(`https://gymflow.test${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function json<T>(response: Response) {
  const value = await response.json();
  return value as T;
}

before(async () => {
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok') } }",
    d1Databases: ["DB"],
  });
  const DB = await miniflare.getD1Database("DB");
  (globalThis as typeof globalThis & { __GYMFLOW_ENV__?: { DB: unknown } })
    .__GYMFLOW_ENV__ = { DB };
});

after(() => {
  delete (globalThis as typeof globalThis & { __GYMFLOW_ENV__?: unknown })
    .__GYMFLOW_ENV__;
  // In alcuni runtime Workerd la Promise di dispose resta pendente anche dopo
  // aver rilasciato tutte le risorse. Avviamo comunque la pulizia senza
  // trattenere il test runner su una Promise ormai priva di handle attivi.
  void miniflare.dispose();
});

test("completamento, archivio, ripristino, CRUD e isolamento persistono dall'inizio alla fine", async () => {
  const unauthorized = await getWeeks(request("/api/weeks"));
  assert.notEqual(unauthorized.status, 200);

  const initialResponse = await getWeeks(request("/api/weeks", userA));
  assert.equal(initialResponse.status, 200);
  const initial = await json<{ weeks: WeekRecord[] }>(initialResponse);
  assert.equal(initial.weeks.length, 4);
  const firstWeek = initial.weeks[0];
  assert.equal(firstWeek.completed, false);
  assert.equal(firstWeek.archived, false);

  const archiveBeforeCompletion = await updateWeek(
    request(`/api/weeks/${firstWeek.id}`, userA, "PUT", { archived: true }),
    { params: Promise.resolve({ id: String(firstWeek.id) }) },
  );
  assert.equal(archiveBeforeCompletion.status, 409);

  const createdExerciseResponse = await createExercise(
    request("/api/exercises", userA, "POST", {
      week: firstWeek.id,
      name: "Squat",
      muscleGroup: "Gambe",
      sets: 4,
      reps: "8",
      weight: "60 kg",
      notes: "Tecnica controllata",
    }),
  );
  assert.equal(createdExerciseResponse.status, 201);
  const createdExercise = (
    await json<{ exercise: ExerciseRecord }>(createdExerciseResponse)
  ).exercise;

  const completedResponse = await updateWeek(
    request(`/api/weeks/${firstWeek.id}`, userA, "PUT", { completed: true }),
    { params: Promise.resolve({ id: String(firstWeek.id) }) },
  );
  assert.equal(completedResponse.status, 200);
  assert.equal(
    (await json<{ week: WeekRecord }>(completedResponse)).week.completed,
    true,
  );

  const afterCompletion = await json<{ weeks: WeekRecord[] }>(
    await getWeeks(request("/api/weeks", userA)),
  );
  assert.equal(
    afterCompletion.weeks.find((week) => week.id === firstWeek.id)?.completed,
    true,
  );

  const archivedResponse = await updateWeek(
    request(`/api/weeks/${firstWeek.id}`, userA, "PUT", { archived: true }),
    { params: Promise.resolve({ id: String(firstWeek.id) }) },
  );
  assert.equal(archivedResponse.status, 200);
  const archivedWeek = (await json<{ week: WeekRecord }>(archivedResponse)).week;
  assert.equal(archivedWeek.archived, true);
  assert.ok(archivedWeek.archivedAt);

  const afterArchive = await json<{ weeks: WeekRecord[] }>(
    await getWeeks(request("/api/weeks", userA)),
  );
  assert.equal(
    afterArchive.weeks.find((week) => week.id === firstWeek.id)?.archived,
    true,
    "la settimana deve restare nell’archivio dopo il ricaricamento",
  );
  assert.equal(
    (
      await json<{ exercises: ExerciseRecord[] }>(
        await getExercises(request("/api/exercises", userA)),
      )
    ).exercises.some((exercise) => exercise.id === createdExercise.id),
    true,
    "gli esercizi devono essere conservati nell’archivio",
  );

  const editArchivedExercise = await updateExercise(
    request(`/api/exercises/${createdExercise.id}`, userA, "PUT", {
      week: firstWeek.id,
      name: "Modifica non consentita",
      sets: 3,
    }),
    { params: Promise.resolve({ id: String(createdExercise.id) }) },
  );
  assert.equal(editArchivedExercise.status, 409);

  const addToArchivedWeek = await createExercise(
    request("/api/exercises", userA, "POST", {
      week: firstWeek.id,
      name: "Nuovo esercizio",
      sets: 3,
    }),
  );
  assert.equal(addToArchivedWeek.status, 409);

  const deleteArchivedExercise = await deleteExercise(
    request(`/api/exercises/${createdExercise.id}`, userA, "DELETE"),
    { params: Promise.resolve({ id: String(createdExercise.id) }) },
  );
  assert.equal(deleteArchivedExercise.status, 409);

  const copyToArchivedWeek = await copyExercises(
    request("/api/exercises/copy", userA, "POST", {
      exerciseIds: [createdExercise.id],
      targetWeek: firstWeek.id,
    }),
  );
  assert.equal(copyToArchivedWeek.status, 409);

  const deleteArchivedWeek = await deleteWeek(
    request(`/api/weeks/${firstWeek.id}`, userA, "DELETE"),
    { params: Promise.resolve({ id: String(firstWeek.id) }) },
  );
  assert.equal(deleteArchivedWeek.status, 409);

  const otherUserCannotRestore = await updateWeek(
    request(`/api/weeks/${firstWeek.id}`, userB, "PUT", { archived: false }),
    { params: Promise.resolve({ id: String(firstWeek.id) }) },
  );
  assert.equal(otherUserCannotRestore.status, 404);

  const restoredResponse = await updateWeek(
    request(`/api/weeks/${firstWeek.id}`, userA, "PUT", { archived: false }),
    { params: Promise.resolve({ id: String(firstWeek.id) }) },
  );
  assert.equal(restoredResponse.status, 200);
  const restoredWeek = (await json<{ week: WeekRecord }>(restoredResponse)).week;
  assert.equal(restoredWeek.archived, false);
  assert.equal(restoredWeek.archivedAt, null);
  assert.equal(restoredWeek.completed, true);

  const updatedExerciseResponse = await updateExercise(
    request(`/api/exercises/${createdExercise.id}`, userA, "PUT", {
      week: firstWeek.id,
      name: "Back squat",
      muscleGroup: "Gambe",
      sets: 5,
      reps: "5",
      weight: "70 kg",
      notes: "Aggiornato",
    }),
    { params: Promise.resolve({ id: String(createdExercise.id) }) },
  );
  assert.equal(updatedExerciseResponse.status, 200);
  assert.equal(
    (await json<{ exercise: ExerciseRecord }>(updatedExerciseResponse)).exercise
      .name,
    "Back squat",
  );

  const createdWeekResponse = await createWeek(
    request("/api/weeks", userA, "POST", { name: "Settimana extra" }),
  );
  assert.equal(createdWeekResponse.status, 201);
  const createdWeek = (
    await json<{ week: WeekRecord }>(createdWeekResponse)
  ).week;

  const renamedWeekResponse = await updateWeek(
    request(`/api/weeks/${createdWeek.id}`, userA, "PUT", {
      name: "Settimana forza",
    }),
    { params: Promise.resolve({ id: String(createdWeek.id) }) },
  );
  assert.equal(renamedWeekResponse.status, 200);
  assert.equal(
    (await json<{ week: WeekRecord }>(renamedWeekResponse)).week.name,
    "Settimana forza",
  );

  const deleteExerciseResponse = await deleteExercise(
    request(`/api/exercises/${createdExercise.id}`, userA, "DELETE"),
    { params: Promise.resolve({ id: String(createdExercise.id) }) },
  );
  assert.equal(deleteExerciseResponse.status, 200);
  assert.equal(
    (
      await json<{ exercises: ExerciseRecord[] }>(
        await getExercises(request("/api/exercises", userA)),
      )
    ).exercises.length,
    0,
  );

  const deleteWeekResponse = await deleteWeek(
    request(`/api/weeks/${firstWeek.id}`, userA, "DELETE"),
    { params: Promise.resolve({ id: String(firstWeek.id) }) },
  );
  assert.equal(deleteWeekResponse.status, 200);

  const afterDeletion = await json<{ weeks: WeekRecord[] }>(
    await getWeeks(request("/api/weeks", userA)),
  );
  assert.equal(afterDeletion.weeks.length, 4);
  assert.equal(
    afterDeletion.weeks.some((week) => week.id === firstWeek.id),
    false,
    "la settimana eliminata non deve ricomparire dopo il ricaricamento",
  );

  const otherUser = await json<{ weeks: WeekRecord[] }>(
    await getWeeks(request("/api/weeks", userB)),
  );
  assert.equal(otherUser.weeks.length, 4);
  assert.equal(otherUser.weeks.every((week) => week.completed === false), true);
});
