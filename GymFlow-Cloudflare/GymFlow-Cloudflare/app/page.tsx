"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Exercise = {
  id: number;
  week: number;
  name: string;
  muscleGroup: string;
  sets: number;
  reps: string;
  weight: string;
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
};

const emptyDraft = (week: number): ExerciseDraft => ({
  week,
  name: "",
  muscleGroup: "",
  sets: 3,
  reps: "10",
  weight: "",
  notes: "",
});

export default function Home() {
  const [activeWeek, setActiveWeek] = useState<number | null>(null);
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
  const [weekName, setWeekName] = useState("");
  const [draft, setDraft] = useState<ExerciseDraft>(emptyDraft(1));
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
        setActiveWeek(weeksData.weeks[0]?.id ?? null);
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

  const totalExercises = exercises.length;
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const activeWeekData = weeks.find((week) => week.id === activeWeek) ?? null;

  const openWeekCreate = () => {
    setEditingWeek(null);
    setWeekName(`Settimana ${weeks.length + 1}`);
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
      if (!editingWeek) setActiveWeek(data.week.id);
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
      if (activeWeek === target.id) setActiveWeek(remainingWeeks[0]?.id ?? null);
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

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="GymFlow home">
          <span className="brand-mark">G</span>
          <span>GYMFLOW</span>
        </a>
        <nav className="side-nav" aria-label="Navigazione principale">
          <button className="nav-item active" type="button">
            <span className="nav-icon">▦</span> Programma
          </button>
          <div className="nav-caption week-caption">
            <span>LE MIE SETTIMANE</span>
            <button aria-label="Aggiungi settimana" onClick={openWeekCreate} type="button">＋</button>
          </div>
          {weeks.map((week) => (
            <div className={`week-nav-row ${activeWeek === week.id ? "selected" : ""} ${week.completed ? "completed" : ""}`} key={week.id}>
              <button
                className={`nav-item week-link ${activeWeek === week.id ? "selected" : ""}`}
                onClick={() => setActiveWeek(week.id)}
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
          {weeks.length === 0 && (
            <button className="sidebar-empty" onClick={openWeekCreate} type="button">
              ＋ Crea la prima settimana
            </button>
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
        <header className="topbar">
          <div>
            <p className="eyebrow">IL MIO ALLENAMENTO</p>
            <h1>Programma palestra</h1>
          </div>
          <button className="primary-button desktop-add" onClick={openCreate}>
            <span>＋</span> Nuovo esercizio
          </button>
        </header>

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
          {weeks.map((week) => (
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
                <button
                  aria-pressed={activeWeekData.completed}
                  className={`week-complete-button ${activeWeekData.completed ? "completed" : ""}`}
                  disabled={updatingWeekId === activeWeekData.id}
                  onClick={() => toggleWeekCompleted(activeWeekData)}
                  type="button"
                >
                  {updatingWeekId === activeWeekData.id
                    ? "Salvataggio…"
                    : activeWeekData.completed
                      ? "✓ Completata"
                      : "Segna completata"}
                </button>
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
                      <div><span>CARICO</span><strong>{exercise.weight || "—"}</strong></div>
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
      </section>

      <button className="floating-add" aria-label="Nuovo esercizio" onClick={openCreate}>
        ＋
      </button>

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
                    {weeks.map((week) => (
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
                <label className="full">
                  Carico
                  <input
                    onChange={(e) => setDraft({ ...draft, weight: e.target.value })}
                    placeholder="Es. 60 kg"
                    value={draft.weight}
                  />
                </label>
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
      {error && !modalOpen && !weekModalOpen && (
        <button className="error-banner" onClick={() => setError("")}>
          {error} <span>×</span>
        </button>
      )}
    </main>
  );
}
