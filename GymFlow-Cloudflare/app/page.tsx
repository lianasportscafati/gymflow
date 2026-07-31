"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { calculateWeight } from "../lib/weight";

type Exercise = {
  id: number;
  week: number;
  name: string;
  muscleGroup: string;
  sets: number;
  reps: string;
  weight: string;
  baseWeight: string;
  weightPercentage: number | null;
  notes: string;
  position: number;
};

type ExerciseDraft = Omit<Exercise, "id" | "position">;

type Week = {
  id: number;
  name: string;
  accent: string;
  position: number;
  completed: boolean;
  archived: boolean;
  archivedAt: string | null;
};

type ViewMode = "program" | "archive";

function formatArchiveDate(value: string | null) {
  if (!value) return "Data non disponibile";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data non disponibile";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

const emptyDraft = (week: number): ExerciseDraft => ({
  week,
  name: "",
  muscleGroup: "",
  sets: 3,
  reps: "10",
  weight: "",
  baseWeight: "",
  weightPercentage: null,
  notes: "",
});

export default function Home() {
  const [view, setView] = useState<ViewMode>("program");
  const [activeWeek, setActiveWeek] = useState<number | null>(null);
  const [reviewedArchiveWeekId, setReviewedArchiveWeekId] = useState<number | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingWeekId, setUpdatingWeekId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [exerciseToDelete, setExerciseToDelete] = useState<Exercise | null>(null);
  const [weekModalOpen, setWeekModalOpen] = useState(false);
  const [editingWeek, setEditingWeek] = useState<Week | null>(null);
  const [weekToDelete, setWeekToDelete] = useState<Week | null>(null);
  const [weekToArchive, setWeekToArchive] = useState<Week | null>(null);
  const [weekName, setWeekName] = useState("");
  const [draft, setDraft] = useState<ExerciseDraft>(emptyDraft(1));
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyTargetWeek, setCopyTargetWeek] = useState<number | null>(null);
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/weeks", { cache: "no-store" }),
      fetch("/api/exercises", { cache: "no-store" }),
    ])
      .then(async ([weeksResponse, exercisesResponse]) => {
        const [weeksData, exercisesData] = await Promise.all([
          weeksResponse.json(),
          exercisesResponse.json(),
        ]);
        if (!weeksResponse.ok) throw new Error(weeksData.error || "Errore nel caricamento");
        if (!exercisesResponse.ok) throw new Error(exercisesData.error || "Errore nel caricamento");
        setWeeks(weeksData.weeks);
        setExercises(exercisesData.exercises);
        setActiveWeek(
          weeksData.weeks.find((week: Week) => !week.archived)?.id ?? null,
        );
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Errore imprevisto");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const activeWeeks = useMemo(
    () => weeks.filter((week) => !week.archived),
    [weeks],
  );

  const archivedWeeks = useMemo(
    () =>
      weeks
        .filter((week) => week.archived)
        .sort((a, b) => {
          const aTime = a.archivedAt ? new Date(a.archivedAt).getTime() : 0;
          const bTime = b.archivedAt ? new Date(b.archivedAt).getTime() : 0;
          return bTime - aTime || b.id - a.id;
        }),
    [weeks],
  );

  const currentExercises = useMemo(
    () =>
      exercises
        .filter((exercise) => exercise.week === activeWeek)
        .sort((a, b) => a.position - b.position || a.id - b.id),
    [exercises, activeWeek],
  );

  const openCreate = () => {
    if (activeWeek === null) {
      setError("Crea prima una settimana.");
      return;
    }
    setEditingId(null);
    setDraft(emptyDraft(activeWeek));
    setError("");
    setModalOpen(true);
  };

  const openEdit = (exercise: Exercise) => {
    setEditingId(exercise.id);
    setDraft({
      week: exercise.week,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      sets: exercise.sets,
      reps: exercise.reps,
      weight: exercise.weight,
      baseWeight: exercise.baseWeight,
      weightPercentage: exercise.weightPercentage,
      notes: exercise.notes,
    });
    setError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setError("");
  };

  const saveExercise = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      setError("Inserisci il nome dell’esercizio.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        editingId ? `/api/exercises/${editingId}` : "/api/exercises",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Salvataggio non riuscito");

      setExercises((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? data.exercise : item))
          : [...current, data.exercise],
      );
      setActiveWeek(data.exercise.week);
      setModalOpen(false);
      setToast(editingId ? "Esercizio aggiornato" : "Esercizio aggiunto");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
    } finally {
      setSaving(false);
    }
  };

  const deleteExercise = async () => {
    if (!exerciseToDelete) return;
    const exercise = exerciseToDelete;
    try {
      const response = await fetch(`/api/exercises/${exercise.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Eliminazione non riuscita");
      setExercises((current) => current.filter((item) => item.id !== exercise.id));
      setExerciseToDelete(null);
      setToast("Esercizio eliminato");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
    }
  };

  const activeWeekIds = useMemo(
    () => new Set(activeWeeks.map((week) => week.id)),
    [activeWeeks],
  );
  const activeExercises = useMemo(
    () => exercises.filter((exercise) => activeWeekIds.has(exercise.week)),
    [exercises, activeWeekIds],
  );
  const totalExercises = activeExercises.length;
  const totalSets = activeExercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const activeWeekData = activeWeeks.find((week) => week.id === activeWeek) ?? null;
  const reviewedArchiveWeek =
    archivedWeeks.find((week) => week.id === reviewedArchiveWeekId) ?? null;
  const reviewedExercises = useMemo(
    () =>
      exercises
        .filter((exercise) => exercise.week === reviewedArchiveWeekId)
        .sort((a, b) => a.position - b.position || a.id - b.id),
    [exercises, reviewedArchiveWeekId],
  );
  const archivedExerciseCount = exercises.filter((exercise) =>
    archivedWeeks.some((week) => week.id === exercise.week),
  ).length;

  const openWeekCreate = () => {
    setEditingWeek(null);
    setWeekName(`Settimana ${activeWeeks.length + 1}`);
    setError("");
    setWeekModalOpen(true);
  };

  const openWeekEdit = (week: Week) => {
    setEditingWeek(week);
    setWeekName(week.name);
    setError("");
    setWeekModalOpen(true);
  };

  const saveWeek = async (event: FormEvent) => {
    event.preventDefault();
    if (!weekName.trim()) {
      setError("Inserisci il nome della settimana.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        editingWeek ? `/api/weeks/${editingWeek.id}` : "/api/weeks",
        {
          method: editingWeek ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: weekName }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Salvataggio non riuscito");
      setWeeks((current) =>
        editingWeek
          ? current.map((week) => (week.id === editingWeek.id ? data.week : week))
          : [...current, data.week],
      );
      if (!editingWeek) {
        setActiveWeek(data.week.id);
        setView("program");
      }
      setWeekModalOpen(false);
      setToast(editingWeek ? "Settimana rinominata" : "Settimana aggiunta");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
    } finally {
      setSaving(false);
    }
  };

  const deleteWeek = async () => {
    if (!weekToDelete) return;
    const target = weekToDelete;
    setSaving(true);
    try {
      const response = await fetch(`/api/weeks/${target.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Eliminazione non riuscita");
      const remainingWeeks = weeks.filter((week) => week.id !== target.id);
      setWeeks(remainingWeeks);
      setExercises((current) => current.filter((exercise) => exercise.week !== target.id));
      if (activeWeek === target.id) {
        setActiveWeek(remainingWeeks.find((week) => !week.archived)?.id ?? null);
      }
      setWeekToDelete(null);
      setToast("Settimana eliminata");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
    } finally {
      setSaving(false);
    }
  };

  const toggleWeekCompleted = async (week: Week) => {
    setUpdatingWeekId(week.id);
    setError("");
    try {
      const response = await fetch(`/api/weeks/${week.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !week.completed }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Aggiornamento non riuscito");
      setWeeks((current) =>
        current.map((item) => (item.id === week.id ? data.week : item)),
      );
      setToast(data.week.completed ? "Settimana completata" : "Settimana riaperta");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
    } finally {
      setUpdatingWeekId(null);
    }
  };

  const archiveWeek = async () => {
    if (!weekToArchive) return;
    const target = weekToArchive;
    setUpdatingWeekId(target.id);
    setError("");
    try {
      const response = await fetch(`/api/weeks/${target.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Archiviazione non riuscita");
      setWeeks((current) =>
        current.map((week) => (week.id === target.id ? data.week : week)),
      );
      setActiveWeek(activeWeeks.find((week) => week.id !== target.id)?.id ?? null);
      setReviewedArchiveWeekId(target.id);
      setWeekToArchive(null);
      setView("archive");
      setToast("Settimana archiviata");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
    } finally {
      setUpdatingWeekId(null);
    }
  };

  const restoreWeek = async (week: Week) => {
    setUpdatingWeekId(week.id);
    setError("");
    try {
      const response = await fetch(`/api/weeks/${week.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ripristino non riuscito");
      setWeeks((current) =>
        current.map((item) => (item.id === week.id ? data.week : item)),
      );
      setActiveWeek(week.id);
      setReviewedArchiveWeekId(null);
      setView("program");
      setToast("Settimana ripristinata");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
    } finally {
      setUpdatingWeekId(null);
    }
  };

  const openProgram = (weekId?: number) => {
    setView("program");
    setActiveWeek(
      weekId ??
        (activeWeeks.some((week) => week.id === activeWeek)
          ? activeWeek
          : activeWeeks[0]?.id ?? null),
    );
  };

  const openArchive = () => {
    setView("archive");
    if (!archivedWeeks.some((week) => week.id === reviewedArchiveWeekId)) {
      setReviewedArchiveWeekId(archivedWeeks[0]?.id ?? null);
    }
  };

  const openCopyModal = () => {
    if (activeWeek === null || currentExercises.length === 0) return;
    const fallback = activeWeeks.find((week) => week.id !== activeWeek)?.id ?? null;
    if (fallback === null) {
      setError("Crea un’altra settimana prima di copiare gli esercizi.");
      return;
    }
    setSelectedExerciseIds(currentExercises.map((exercise) => exercise.id));
    setCopyTargetWeek(fallback);
    setError("");
    setCopyModalOpen(true);
  };

  const copyExercises = async () => {
    if (!selectedExerciseIds.length || copyTargetWeek === null) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/exercises/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseIds: selectedExerciseIds,
          targetWeek: copyTargetWeek,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Copia non riuscita");
      setExercises((current) => [...current, ...data.exercises]);
      setActiveWeek(copyTargetWeek);
      setView("program");
      setCopyModalOpen(false);
      setToast(
        `${data.exercises.length} ${data.exercises.length === 1 ? "esercizio copiato" : "esercizi copiati"}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="GymFlow home">
          <span className="brand-mark">G</span>
          <span>GYMFLOW</span>
        </a>
        <nav className="side-nav" aria-label="Navigazione principale">
          <button
            className={`nav-item ${view === "program" ? "active" : ""}`}
            onClick={() => openProgram()}
            type="button"
          >
            <span className="nav-icon">▦</span> Programma
          </button>
          <button
            className={`nav-item ${view === "archive" ? "active" : ""}`}
            onClick={openArchive}
            type="button"
          >
            <span className="nav-icon">▤</span> Archivio
            <span className="side-count">{archivedWeeks.length}</span>
          </button>
          {view === "program" ? (
            <>
              <div className="nav-caption week-caption">
                <span>LE MIE SETTIMANE</span>
                <button aria-label="Aggiungi settimana" onClick={openWeekCreate} type="button">＋</button>
              </div>
              {activeWeeks.map((week) => (
                <div className={`week-nav-row ${activeWeek === week.id ? "selected" : ""} ${week.completed ? "completed" : ""}`} key={week.id}>
                  <button
                    className={`nav-item week-link ${activeWeek === week.id ? "selected" : ""}`}
                    onClick={() => openProgram(week.id)}
                    type="button"
                  >
                    <span className="week-dot" style={{ backgroundColor: week.accent }} />
                    <span className="week-name">{week.name}</span>
                    {week.completed && <span className="week-check" aria-label="Completata">✓</span>}
                    <span className="side-count">
                      {exercises.filter((item) => item.week === week.id).length}
                    </span>
                  </button>
                  <button
                    aria-label={`Gestisci ${week.name}`}
                    className="week-manage"
                    onClick={() => openWeekEdit(week)}
                    type="button"
                  >
                    •••
                  </button>
                </div>
              ))}
              {activeWeeks.length === 0 && (
                <button className="sidebar-empty" onClick={openWeekCreate} type="button">
                  ＋ Crea una settimana
                </button>
              )}
            </>
          ) : (
            <>
              <div className="nav-caption">SETTIMANE ARCHIVIATE</div>
              {archivedWeeks.map((week) => (
                <button
                  className={`nav-item archive-link ${reviewedArchiveWeekId === week.id ? "selected" : ""}`}
                  key={week.id}
                  onClick={() => setReviewedArchiveWeekId(week.id)}
                  type="button"
                >
                  <span className="week-dot" style={{ backgroundColor: week.accent }} />
                  <span className="week-name">{week.name}</span>
                </button>
              ))}
              {archivedWeeks.length === 0 && (
                <p className="sidebar-empty static">Nessuna settimana archiviata</p>
              )}
            </>
          )}
        </nav>
        <div className="sidebar-tip">
          <span>↗</span>
          <p>
            <strong>Un passo alla volta.</strong>
            La costanza batte la perfezione.
          </p>
        </div>
      </aside>

      <section className="content">
        <div className="mobile-view-switch" aria-label="Sezione" role="tablist">
          <button
            aria-selected={view === "program"}
            className={view === "program" ? "active" : ""}
            onClick={() => openProgram()}
            role="tab"
            type="button"
          >
            Programma
          </button>
          <button
            aria-selected={view === "archive"}
            className={view === "archive" ? "active" : ""}
            onClick={openArchive}
            role="tab"
            type="button"
          >
            Archivio <span>{archivedWeeks.length}</span>
          </button>
        </div>
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {view === "program" ? "IL MIO ALLENAMENTO" : "STORICO ALLENAMENTI"}
            </p>
            <h1>{view === "program" ? "Programma palestra" : "Archivio"}</h1>
          </div>
          {view === "program" && (
            <button className="primary-button desktop-add" onClick={openCreate}>
              <span>＋</span> Nuovo esercizio
            </button>
          )}
        </header>

        {view === "program" ? (
          <>
        <section className="summary-grid" aria-label="Riepilogo programma">
          <article className="summary-card">
            <span className="summary-label">ESERCIZI TOTALI</span>
            <strong>{totalExercises.toString().padStart(2, "0")}</strong>
            <small>su tutte le settimane</small>
          </article>
          <article className="summary-card">
            <span className="summary-label">SERIE PROGRAMMATE</span>
            <strong>{totalSets.toString().padStart(2, "0")}</strong>
            <small>volume totale</small>
          </article>
          <article className="summary-card featured">
            <span className="summary-label">SETTIMANA ATTIVA</span>
            <strong>{activeWeekData ? String(activeWeekData.position).padStart(2, "0") : "—"}</strong>
            <small>{currentExercises.length} esercizi in programma</small>
          </article>
        </section>

        <div className="mobile-weeks" role="tablist" aria-label="Settimane">
          {activeWeeks.map((week) => (
            <button
              aria-selected={activeWeek === week.id}
              className={`${activeWeek === week.id ? "active" : ""} ${week.completed ? "completed" : ""}`}
              key={week.id}
              onClick={() => setActiveWeek(week.id)}
              role="tab"
            >
              {week.completed ? `✓ ${week.name}` : week.name}
            </button>
          ))}
          <button aria-label="Aggiungi settimana" className="mobile-week-add" onClick={openWeekCreate}>＋</button>
        </div>

        <section className={`week-section ${activeWeekData?.completed ? "completed" : ""}`}>
          <div className="section-heading">
            <div>
              <span
                className="section-accent"
                style={{ backgroundColor: activeWeekData?.accent ?? "#c8ff5a" }}
              />
              <div>
                <p>{activeWeekData ? `PIANO ${activeWeekData.position}` : "NESSUNA SETTIMANA"}</p>
                <h2>{activeWeekData?.name ?? "Crea la prima settimana"}</h2>
              </div>
            </div>
            {activeWeekData && (
              <div className="week-heading-actions">
                <span className="exercise-count">
                  {currentExercises.length} {currentExercises.length === 1 ? "esercizio" : "esercizi"}
                </span>
                {currentExercises.length > 0 && activeWeeks.length > 1 && (
                  <button className="copy-week-button" onClick={openCopyModal} type="button">
                    Copia esercizi
                  </button>
                )}
                <label
                  className={`week-complete-button ${activeWeekData.completed ? "completed" : ""}`}
                >
                  <input
                    aria-label={`Contrassegna ${activeWeekData.name} come completata`}
                    checked={activeWeekData.completed}
                    disabled={updatingWeekId === activeWeekData.id}
                    onChange={() => toggleWeekCompleted(activeWeekData)}
                    type="checkbox"
                  />
                  {updatingWeekId === activeWeekData.id
                    ? "Salvataggio…"
                    : "Completata"}
                </label>
                {activeWeekData.completed && (
                  <button
                    className="archive-week-button"
                    disabled={updatingWeekId === activeWeekData.id}
                    onClick={() => setWeekToArchive(activeWeekData)}
                    type="button"
                  >
                    Archivia
                  </button>
                )}
                <button onClick={() => openWeekEdit(activeWeekData)} type="button">Rinomina</button>
                <button className="delete-week" onClick={() => setWeekToDelete(activeWeekData)} type="button">Elimina</button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="state-card">
              <span className="loader" />
              <p>Carico il tuo programma…</p>
            </div>
          ) : !activeWeekData ? (
            <div className="state-card empty">
              <div className="empty-icon">＋</div>
              <h3>Inizia creando una settimana</h3>
              <p>Potrai darle un nome e aggiungere tutti gli esercizi che vuoi.</p>
              <button className="primary-button" onClick={openWeekCreate}>Crea settimana</button>
            </div>
          ) : currentExercises.length === 0 ? (
            <div className="state-card empty">
              <div className="empty-icon">＋</div>
              <h3>Questa settimana è ancora vuota</h3>
              <p>Aggiungi il primo esercizio e comincia a costruire il tuo piano.</p>
              <button className="primary-button" onClick={openCreate}>
                Aggiungi esercizio
              </button>
            </div>
          ) : (
            <div className="exercise-list">
              {currentExercises.map((exercise, index) => (
                <article className="exercise-card" key={exercise.id}>
                  <div className="exercise-index">{String(index + 1).padStart(2, "0")}</div>
                  <div className="exercise-main">
                    <div className="exercise-title-row">
                      <div>
                        <span className="muscle-tag">
                          {exercise.muscleGroup || "ALLENAMENTO"}
                        </span>
                        <h3>{exercise.name}</h3>
                      </div>
                      <div className="card-actions">
                        <button
                          aria-label={`Modifica ${exercise.name}`}
                          onClick={() => openEdit(exercise)}
                          title="Modifica"
                        >
                          ✎
                        </button>
                        <button
                          aria-label={`Elimina ${exercise.name}`}
                          className="delete"
                          onClick={() => setExerciseToDelete(exercise)}
                          title="Elimina"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <div className="metrics">
                      <div><span>SERIE</span><strong>{exercise.sets}</strong></div>
                      <div><span>RIPETIZIONI</span><strong>{exercise.reps}</strong></div>
                      <div>
                        <span>CARICO</span>
                        <strong>{exercise.weight || "—"}</strong>
                        {exercise.baseWeight && exercise.weightPercentage && (
                          <small>{exercise.weightPercentage}% di {exercise.baseWeight} kg</small>
                        )}
                      </div>
                    </div>
                    {exercise.notes && (
                      <div className="notes">
                        <span>NOTE</span>
                        <p>{exercise.notes}</p>
                      </div>
                    )}
                  </div>
                </article>
              ))}
              <button className="add-row" onClick={openCreate}>
                <span>＋</span> Aggiungi un altro esercizio
              </button>
            </div>
          )}
        </section>
          </>
        ) : (
          <>
            <section className="summary-grid archive-summary" aria-label="Riepilogo archivio">
              <article className="summary-card">
                <span className="summary-label">SETTIMANE ARCHIVIATE</span>
                <strong>{archivedWeeks.length.toString().padStart(2, "0")}</strong>
                <small>sempre disponibili</small>
              </article>
              <article className="summary-card">
                <span className="summary-label">ESERCIZI CONSERVATI</span>
                <strong>{archivedExerciseCount.toString().padStart(2, "0")}</strong>
                <small>con carichi e note</small>
              </article>
              <article className="summary-card featured archive-featured">
                <span className="summary-label">ULTIMO ARCHIVIO</span>
                <strong>{archivedWeeks.length ? "✓" : "—"}</strong>
                <small>{formatArchiveDate(archivedWeeks[0]?.archivedAt ?? null)}</small>
              </article>
            </section>

            <section className="archive-section">
              {loading ? (
                <div className="state-card">
                  <span className="loader" />
                  <p>Carico il tuo archivio…</p>
                </div>
              ) : archivedWeeks.length === 0 ? (
                <div className="state-card empty archive-empty">
                  <div className="empty-icon">▤</div>
                  <h3>L’archivio è vuoto</h3>
                  <p>
                    Completa una settimana e premi “Archivia”: potrai sempre
                    recuperarla e rivederne esercizi, carichi e note.
                  </p>
                  <button className="primary-button" onClick={() => openProgram()}>
                    Torna al programma
                  </button>
                </div>
              ) : (
                <>
                  <div className="archive-grid">
                    {archivedWeeks.map((week) => {
                      const weekExercises = exercises.filter(
                        (exercise) => exercise.week === week.id,
                      );
                      const weekSets = weekExercises.reduce(
                        (sum, exercise) => sum + exercise.sets,
                        0,
                      );
                      return (
                        <article
                          className={`archive-card ${reviewedArchiveWeekId === week.id ? "selected" : ""}`}
                          key={week.id}
                        >
                          <div className="archive-card-top">
                            <span
                              className="archive-accent"
                              style={{ backgroundColor: week.accent }}
                            />
                            <span className="archive-status">✓ COMPLETATA</span>
                          </div>
                          <h2>{week.name}</h2>
                          <p>Archiviata il {formatArchiveDate(week.archivedAt)}</p>
                          <div className="archive-card-metrics">
                            <span><strong>{weekExercises.length}</strong> esercizi</span>
                            <span><strong>{weekSets}</strong> serie</span>
                          </div>
                          <div className="archive-card-actions">
                            <button
                              className="secondary-button"
                              onClick={() => setReviewedArchiveWeekId(week.id)}
                              type="button"
                            >
                              Rivedi
                            </button>
                            <button
                              className="restore-button"
                              disabled={updatingWeekId === week.id}
                              onClick={() => restoreWeek(week)}
                              type="button"
                            >
                              {updatingWeekId === week.id ? "Ripristino…" : "Ripristina"}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {reviewedArchiveWeek && (
                    <section className="archive-review" aria-label={`Revisione ${reviewedArchiveWeek.name}`}>
                      <div className="archive-review-heading">
                        <div>
                          <p className="eyebrow">SCHEDA ARCHIVIATA · SOLA LETTURA</p>
                          <h2>{reviewedArchiveWeek.name}</h2>
                          <span>
                            {reviewedExercises.length} {reviewedExercises.length === 1 ? "esercizio" : "esercizi"}
                          </span>
                        </div>
                        <button
                          className="restore-button"
                          disabled={updatingWeekId === reviewedArchiveWeek.id}
                          onClick={() => restoreWeek(reviewedArchiveWeek)}
                          type="button"
                        >
                          {updatingWeekId === reviewedArchiveWeek.id
                            ? "Ripristino…"
                            : "Ripristina nel programma"}
                        </button>
                      </div>
                      {reviewedExercises.length === 0 ? (
                        <div className="archive-no-exercises">
                          Questa settimana non contiene esercizi.
                        </div>
                      ) : (
                        <div className="exercise-list archive-exercise-list">
                          {reviewedExercises.map((exercise, index) => (
                            <article className="exercise-card archived" key={exercise.id}>
                              <div className="exercise-index">
                                {String(index + 1).padStart(2, "0")}
                              </div>
                              <div className="exercise-main">
                                <div className="exercise-title-row">
                                  <div>
                                    <span className="muscle-tag">
                                      {exercise.muscleGroup || "ALLENAMENTO"}
                                    </span>
                                    <h3>{exercise.name}</h3>
                                  </div>
                                  <span className="read-only-badge">SOLA LETTURA</span>
                                </div>
                                <div className="metrics">
                                  <div><span>SERIE</span><strong>{exercise.sets}</strong></div>
                                  <div><span>RIPETIZIONI</span><strong>{exercise.reps}</strong></div>
                                  <div>
                                    <span>CARICO</span>
                                    <strong>{exercise.weight || "—"}</strong>
                                    {exercise.baseWeight && exercise.weightPercentage && (
                                      <small>{exercise.weightPercentage}% di {exercise.baseWeight} kg</small>
                                    )}
                                  </div>
                                </div>
                                {exercise.notes && (
                                  <div className="notes">
                                    <span>NOTE</span>
                                    <p>{exercise.notes}</p>
                                  </div>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </section>

      {view === "program" && (
        <button className="floating-add" aria-label="Nuovo esercizio" onClick={openCreate}>
          ＋
        </button>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onMouseDown={closeModal} role="presentation">
          <section
            aria-labelledby="exercise-modal-title"
            aria-modal="true"
            className="modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">{editingId ? "MODIFICA" : "NUOVO"}</p>
                <h2 id="exercise-modal-title">
                  {editingId ? "Modifica esercizio" : "Aggiungi esercizio"}
                </h2>
              </div>
              <button aria-label="Chiudi" className="close-button" onClick={closeModal}>×</button>
            </div>
            <form onSubmit={saveExercise}>
              <div className="form-grid">
                <label className="full">
                  Nome esercizio *
                  <input
                    autoFocus
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Es. Panca piana"
                    value={draft.name}
                  />
                </label>
                <label>
                  Gruppo muscolare
                  <input
                    onChange={(e) => setDraft({ ...draft, muscleGroup: e.target.value })}
                    placeholder="Es. Petto"
                    value={draft.muscleGroup}
                  />
                </label>
                <label>
                  Settimana
                  <select
                    onChange={(e) => setDraft({ ...draft, week: Number(e.target.value) })}
                    value={draft.week}
                  >
                    {activeWeeks.map((week) => (
                      <option key={week.id} value={week.id}>{week.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Serie
                  <input
                    min="1"
                    onChange={(e) => setDraft({ ...draft, sets: Number(e.target.value) })}
                    type="number"
                    value={draft.sets}
                  />
                </label>
                <label>
                  Ripetizioni
                  <input
                    onChange={(e) => setDraft({ ...draft, reps: e.target.value })}
                    placeholder="Es. 8–10"
                    value={draft.reps}
                  />
                </label>
                <label>
                  Peso base (kg)
                  <input
                    inputMode="decimal"
                    onChange={(e) => {
                      const baseWeight = e.target.value;
                      setDraft({
                        ...draft,
                        baseWeight,
                        weight: calculateWeight(baseWeight, draft.weightPercentage),
                      });
                    }}
                    placeholder="Es. 67,5"
                    value={draft.baseWeight}
                  />
                </label>
                <label>
                  Percentuale (%)
                  <input
                    min="1"
                    onChange={(e) => {
                      const weightPercentage = e.target.value ? Number(e.target.value) : null;
                      setDraft({
                        ...draft,
                        weightPercentage,
                        weight: calculateWeight(draft.baseWeight, weightPercentage),
                      });
                    }}
                    placeholder="Es. 50"
                    type="number"
                    value={draft.weightPercentage ?? ""}
                  />
                </label>
                <div className="calculated-weight full">
                  <span>CARICO CALCOLATO</span>
                  <strong>{draft.weight || "Inserisci peso base e percentuale"}</strong>
                </div>
                <label className="full">
                  Note
                  <textarea
                    onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                    placeholder="Tecnica, recupero, sensazioni o promemoria…"
                    rows={4}
                    value={draft.notes}
                  />
                </label>
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="modal-actions">
                <button className="secondary-button" onClick={closeModal} type="button">
                  Annulla
                </button>
                <button className="primary-button" disabled={saving} type="submit">
                  {saving ? "Salvataggio…" : editingId ? "Salva modifiche" : "Aggiungi esercizio"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {weekModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="week-modal-title"
            aria-modal="true"
            className="modal week-modal"
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">{editingWeek ? "MODIFICA" : "NUOVA"}</p>
                <h2 id="week-modal-title">
                  {editingWeek ? "Rinomina settimana" : "Aggiungi settimana"}
                </h2>
              </div>
              <button
                aria-label="Chiudi"
                className="close-button"
                onClick={() => setWeekModalOpen(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={saveWeek}>
              <label className="week-name-field">
                Nome della settimana *
                <input
                  autoFocus
                  onChange={(event) => setWeekName(event.target.value)}
                  placeholder="Es. Forza — Settimana 1"
                  value={weekName}
                />
              </label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="modal-actions">
                {editingWeek && (
                  <button
                    className="danger-link"
                    onClick={() => {
                      setWeekModalOpen(false);
                      setWeekToDelete(editingWeek);
                    }}
                    type="button"
                  >
                    Elimina settimana
                  </button>
                )}
                <button
                  className="secondary-button"
                  onClick={() => setWeekModalOpen(false)}
                  type="button"
                >
                  Annulla
                </button>
                <button className="primary-button" disabled={saving} type="submit">
                  {saving ? "Salvataggio…" : editingWeek ? "Salva nome" : "Crea settimana"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {copyModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="copy-modal-title"
            aria-modal="true"
            className="modal copy-modal"
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">COPIA PROGRAMMA</p>
                <h2 id="copy-modal-title">Copia esercizi in un’altra settimana</h2>
              </div>
              <button aria-label="Chiudi" className="close-button" onClick={() => setCopyModalOpen(false)}>×</button>
            </div>
            <label className="copy-target">
              Settimana di destinazione
              <select
                onChange={(event) => setCopyTargetWeek(Number(event.target.value))}
                value={copyTargetWeek ?? ""}
              >
                {activeWeeks.filter((week) => week.id !== activeWeek).map((week) => (
                  <option key={week.id} value={week.id}>{week.name}</option>
                ))}
              </select>
            </label>
            <div className="copy-exercise-list">
              {currentExercises.map((exercise) => (
                <label key={exercise.id}>
                  <input
                    checked={selectedExerciseIds.includes(exercise.id)}
                    onChange={(event) =>
                      setSelectedExerciseIds((current) =>
                        event.target.checked
                          ? [...current, exercise.id]
                          : current.filter((id) => id !== exercise.id),
                      )
                    }
                    type="checkbox"
                  />
                  <span>{exercise.name}</span>
                </label>
              ))}
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setCopyModalOpen(false)} type="button">
                Annulla
              </button>
              <button
                className="primary-button"
                disabled={saving || !selectedExerciseIds.length || copyTargetWeek === null}
                onClick={copyExercises}
                type="button"
              >
                {saving ? "Copia…" : `Copia ${selectedExerciseIds.length} esercizi`}
              </button>
            </div>
          </section>
        </div>
      )}

      {weekToArchive && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="archive-week-modal-title"
            aria-modal="true"
            className="confirm-modal archive-confirm-modal"
            role="dialog"
          >
            <div className="confirm-icon archive-confirm-icon">▤</div>
            <p className="eyebrow">ARCHIVIA SETTIMANA</p>
            <h2 id="archive-week-modal-title">Archiviare “{weekToArchive.name}”?</h2>
            <p>
              La scheda verrà rimossa dal programma attivo, ma esercizi, carichi
              e note resteranno disponibili nell’Archivio. Potrai ripristinarla
              in qualsiasi momento.
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setWeekToArchive(null)}
                type="button"
              >
                Annulla
              </button>
              <button
                className="primary-button"
                disabled={updatingWeekId === weekToArchive.id}
                onClick={archiveWeek}
                type="button"
              >
                {updatingWeekId === weekToArchive.id ? "Archiviazione…" : "Archivia settimana"}
              </button>
            </div>
          </section>
        </div>
      )}

      {weekToDelete && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="delete-week-modal-title"
            aria-modal="true"
            className="confirm-modal"
            role="dialog"
          >
            <div className="confirm-icon">×</div>
            <p className="eyebrow">CONFERMA ELIMINAZIONE</p>
            <h2 id="delete-week-modal-title">Eliminare “{weekToDelete.name}”?</h2>
            <p>
              Verranno eliminati anche tutti gli esercizi e le note contenuti
              in questa settimana. L’operazione non può essere annullata.
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setWeekToDelete(null)}
                type="button"
              >
                Annulla
              </button>
              <button className="danger-button" disabled={saving} onClick={deleteWeek} type="button">
                {saving ? "Eliminazione…" : "Elimina settimana"}
              </button>
            </div>
          </section>
        </div>
      )}

      {exerciseToDelete && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="delete-modal-title"
            aria-modal="true"
            className="confirm-modal"
            role="dialog"
          >
            <div className="confirm-icon">×</div>
            <p className="eyebrow">CONFERMA ELIMINAZIONE</p>
            <h2 id="delete-modal-title">Eliminare “{exerciseToDelete.name}”?</h2>
            <p>L’esercizio e le sue note verranno rimossi dal programma.</p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setExerciseToDelete(null)}
                type="button"
              >
                Annulla
              </button>
              <button className="danger-button" onClick={deleteExercise} type="button">
                Elimina definitivamente
              </button>
            </div>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status">✓ {toast}</div>}
      {error && !modalOpen && !weekModalOpen && !copyModalOpen && !weekToArchive && (
        <button className="error-banner" onClick={() => setError("")}>
          {error} <span>×</span>
        </button>
      )}
    </main>
  );
}
