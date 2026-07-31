"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { calculateWeight } from "../lib/weight";

type Plan = { id: number; name: string; position: number; archived: boolean; archivedAt: string | null };
type Week = { id: number; planId: number; name: string; accent: string; position: number; completed: boolean };
type Workout = { id: number; weekId: number; name: string; position: number; completed: boolean };
type Exercise = {
  id: number; week: number; workoutId: number | null; name: string; muscleGroup: string; sets: number; reps: string;
  weight: string; baseWeight: string; weightPercentage: number | null; recoverySeconds: number; notes: string; position: number;
};
type Draft = Omit<Exercise, "id" | "position">;
type View = "program" | "archive";

const emptyDraft = (week: number, workoutId: number | null): Draft => ({
  week, workoutId, name: "", muscleGroup: "", sets: 3, reps: "10", weight: "",
  baseWeight: "", weightPercentage: null, recoverySeconds: 0, notes: "",
});
const dateLabel = (value: string | null) =>
  value ? new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value)) : "—";

export default function Home() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [activeWeekId, setActiveWeekId] = useState<number | null>(null);
  const [activeWorkoutId, setActiveWorkoutId] = useState<number | null>(null);
  const [view, setView] = useState<View>("program");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingWorkoutId, setUpdatingWorkoutId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [planModal, setPlanModal] = useState<"create" | "rename" | null>(null);
  const [planName, setPlanName] = useState("");
  const [weekModal, setWeekModal] = useState<"create" | "rename" | null>(null);
  const [weekName, setWeekName] = useState("");
  const [workoutModal, setWorkoutModal] = useState<"create" | "rename" | null>(null);
  const [workoutName, setWorkoutName] = useState("");
  const [exerciseModal, setExerciseModal] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft(0, null));
  const [confirm, setConfirm] = useState<"archive-plan" | "delete-plan" | "delete-week" | "delete-workout" | "delete-exercise" | null>(null);
  const [deleteExerciseId, setDeleteExerciseId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true); setError("");
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      const response = await fetch("/api/bootstrap", {
        cache: "no-store",
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Errore nel caricamento");
      setPlans(data.plans); setWeeks(data.weeks); setWorkouts(data.workouts); setExercises(data.exercises);
      const availablePlans = data.plans.filter((plan: Plan) => !plan.archived);
      const first = availablePlans.length === 1 ? availablePlans[0] : undefined;
      setActivePlanId(first?.id ?? null);
      setView("program");
    } catch (cause) {
      setError(cause instanceof DOMException && cause.name === "AbortError"
        ? "Il caricamento sta impiegando troppo tempo. Riprova."
        : cause instanceof Error ? cause.message : "Errore nel caricamento");
    } finally { setLoading(false); }
  };
  // The initial request is the external synchronization owned by this effect.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activePlans = useMemo(() => plans.filter((plan) => !plan.archived), [plans]);
  const archivedPlans = useMemo(() => plans.filter((plan) => plan.archived)
    .sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? "")), [plans]);
  const activePlan = plans.find((plan) => plan.id === activePlanId) ?? null;
  const planWeeks = useMemo(() => weeks.filter((week) => week.planId === activePlanId)
    .sort((a, b) => a.position - b.position), [weeks, activePlanId]);
  const activeWeek = planWeeks.find((week) => week.id === activeWeekId) ?? planWeeks[0] ?? null;
  const weekWorkouts = useMemo(() => workouts.filter((workout) => workout.weekId === activeWeek?.id)
    .sort((a, b) => a.position - b.position), [workouts, activeWeek]);
  const activeWorkout = weekWorkouts.find((workout) => workout.id === activeWorkoutId) ?? weekWorkouts[0] ?? null;
  const workoutExercises = useMemo(() => exercises.filter((item) => item.workoutId === activeWorkout?.id)
    .sort((a, b) => a.position - b.position), [exercises, activeWorkout]);
  const planExerciseCount = exercises.filter((item) => planWeeks.some((week) => week.id === item.week)).length;
  const planSets = exercises.filter((item) => planWeeks.some((week) => week.id === item.week))
    .reduce((sum, item) => sum + item.sets, 0);

  const selectPlan = (plan?: Plan) => {
    if (!plan) return;
    setActivePlanId(plan.id);
    setView(plan.archived ? "archive" : "program");
    setError("");
  };
  const api = async (url: string, method: string, body?: object) => {
    const response = await fetch(url, {
      method, headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Operazione non riuscita");
    return data;
  };

  const savePlan = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const data = planModal === "create"
        ? await api("/api/plans", "POST", { name: planName })
        : await api(`/api/plans/${activePlanId}`, "PUT", { name: planName });
      setPlans((current) => planModal === "create"
        ? [...current, data.plan]
        : current.map((plan) => plan.id === data.plan.id ? data.plan : plan));
      setActivePlanId(data.plan.id); setPlanModal(null); setView(data.plan.archived ? "archive" : "program");
      setToast(planModal === "create" ? "Scheda creata" : "Scheda rinominata");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Errore"); }
    finally { setSaving(false); }
  };
  const archiveOrRestorePlan = async (archive: boolean, targetPlan = activePlan) => {
    if (!targetPlan) return; setSaving(true); setError("");
    try {
      const data = await api(`/api/plans/${targetPlan.id}`, "PUT", { archived: archive });
      setPlans((current) => current.map((plan) => plan.id === data.plan.id ? data.plan : plan));
      setConfirm(null);
      if (archive) {
        const remainingActive = plans.filter((plan) => !plan.archived && plan.id !== targetPlan.id);
        setActivePlanId(remainingActive.length === 1 ? remainingActive[0].id : null);
        setView("program");
      } else {
        setActivePlanId(data.plan.id);
        setView("program");
      }
      setToast(archive ? "Scheda archiviata con tutto il contenuto" : "Scheda ripristinata");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Errore"); }
    finally { setSaving(false); }
  };
  const deletePlan = async () => {
    if (!activePlan) return; setSaving(true);
    try {
      await api(`/api/plans/${activePlan.id}`, "DELETE");
      const removedWeeks = new Set(planWeeks.map((week) => week.id));
      const remaining = plans.filter((plan) => plan.id !== activePlan.id);
      setPlans(remaining); setWeeks((current) => current.filter((week) => week.planId !== activePlan.id));
      setWorkouts((current) => current.filter((workout) => !removedWeeks.has(workout.weekId)));
      setExercises((current) => current.filter((item) => !removedWeeks.has(item.week)));
      const remainingActive = remaining.filter((plan) => !plan.archived);
      const next = activePlan.archived
        ? remaining.find((plan) => plan.archived) ?? null
        : remainingActive.length === 1 ? remainingActive[0] : null;
      setActivePlanId(next?.id ?? null); setView(activePlan.archived ? "archive" : "program");
      setConfirm(null); setToast("Scheda eliminata");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Errore"); }
    finally { setSaving(false); }
  };

  const saveWeek = async (event: FormEvent) => {
    event.preventDefault(); if (!activePlan) return; setSaving(true); setError("");
    try {
      const data = weekModal === "create"
        ? await api("/api/weeks", "POST", { name: weekName, planId: activePlan.id })
        : await api(`/api/weeks/${activeWeek?.id}`, "PUT", { name: weekName });
      setWeeks((current) => weekModal === "create"
        ? [...current, data.week] : current.map((week) => week.id === data.week.id ? data.week : week));
      setActiveWeekId(data.week.id); setWeekModal(null);
      setToast(weekModal === "create" ? "Settimana aggiunta" : "Settimana rinominata");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Errore"); }
    finally { setSaving(false); }
  };
  const toggleWeek = async () => {
    if (!activeWeek) return;
    try {
      const data = await api(`/api/weeks/${activeWeek.id}`, "PUT", { completed: !activeWeek.completed });
      setWeeks((current) => current.map((week) => week.id === data.week.id ? data.week : week));
      setToast(data.week.completed ? "Settimana completata" : "Settimana riaperta");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Errore"); }
  };
  const deleteWeek = async () => {
    if (!activeWeek) return; setSaving(true);
    try {
      await api(`/api/weeks/${activeWeek.id}`, "DELETE");
      setWeeks((current) => current.filter((week) => week.id !== activeWeek.id));
      setWorkouts((current) => current.filter((workout) => workout.weekId !== activeWeek.id));
      setExercises((current) => current.filter((item) => item.week !== activeWeek.id));
      setConfirm(null); setToast("Settimana eliminata");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Errore"); }
    finally { setSaving(false); }
  };

  const saveWorkout = async (event: FormEvent) => {
    event.preventDefault(); if (!activeWeek) return; setSaving(true); setError("");
    try {
      const data = workoutModal === "create"
        ? await api("/api/workouts", "POST", { weekId: activeWeek.id, name: workoutName })
        : await api(`/api/workouts/${activeWorkout?.id}`, "PUT", { name: workoutName });
      setWorkouts((current) => workoutModal === "create"
        ? [...current, data.workout]
        : current.map((workout) => workout.id === data.workout.id ? data.workout : workout));
      setActiveWorkoutId(data.workout.id); setWorkoutModal(null);
      setToast(workoutModal === "create" ? "Allenamento aggiunto" : "Allenamento rinominato");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Errore"); }
    finally { setSaving(false); }
  };
  const deleteWorkout = async () => {
    if (!activeWorkout) return; setSaving(true);
    try {
      await api(`/api/workouts/${activeWorkout.id}`, "DELETE");
      setWorkouts((current) => current.filter((workout) => workout.id !== activeWorkout.id));
      setExercises((current) => current.filter((exercise) => exercise.workoutId !== activeWorkout.id));
      setActiveWorkoutId(null); setConfirm(null); setToast("Allenamento eliminato");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Errore"); }
    finally { setSaving(false); }
  };
  const toggleWorkoutCompleted = async () => {
    if (!activeWorkout) return; setUpdatingWorkoutId(activeWorkout.id); setError("");
    try {
      const data = await api(`/api/workouts/${activeWorkout.id}`, "PUT", { completed: !activeWorkout.completed });
      setWorkouts((current) => current.map((workout) => workout.id === data.workout.id ? data.workout : workout));
      setToast(data.workout.completed ? "Allenamento completato" : "Allenamento riaperto");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Errore"); }
    finally { setUpdatingWorkoutId(null); }
  };

  const openExercise = (exercise?: Exercise) => {
    if (!activeWeek || !activeWorkout) return;
    setEditingExerciseId(exercise?.id ?? null);
    setDraft(exercise ? {
      week: exercise.week, workoutId: exercise.workoutId, name: exercise.name, muscleGroup: exercise.muscleGroup, sets: exercise.sets,
      reps: exercise.reps, weight: exercise.weight,
      baseWeight: exercise.baseWeight || exercise.weight.replace(/[^\d,.-]/g, ""),
      weightPercentage: exercise.weightPercentage ?? (exercise.weight ? 100 : null), recoverySeconds: exercise.recoverySeconds ?? 0, notes: exercise.notes,
    } : emptyDraft(activeWeek.id, activeWorkout.id));
    setExerciseModal(true);
  };
  const saveExercise = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const calculatedWeight = calculateWeight(draft.baseWeight, draft.weightPercentage);
      const payload = { ...draft, weight: calculatedWeight || draft.weight };
      const data = editingExerciseId
        ? await api(`/api/exercises/${editingExerciseId}`, "PUT", payload)
        : await api("/api/exercises", "POST", payload);
      setExercises((current) => editingExerciseId
        ? current.map((item) => item.id === data.exercise.id ? data.exercise : item)
        : [...current, data.exercise]);
      setExerciseModal(false); setToast(editingExerciseId ? "Esercizio aggiornato" : "Esercizio aggiunto");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Errore"); }
    finally { setSaving(false); }
  };
  const deleteExercise = async () => {
    if (!deleteExerciseId) return; setSaving(true);
    try {
      await api(`/api/exercises/${deleteExerciseId}`, "DELETE");
      setExercises((current) => current.filter((item) => item.id !== deleteExerciseId));
      setConfirm(null); setDeleteExerciseId(null); setToast("Esercizio eliminato");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Errore"); }
    finally { setSaving(false); }
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark" aria-hidden="true" /><span>GYMFLOW</span></div>
        <nav className="side-nav" aria-label="Schede">
          <p className="nav-caption">LE MIE SCHEDE</p>
          {activePlans.map((plan) => <button className={`nav-item ${activePlanId === plan.id ? "active" : ""}`} key={plan.id} onClick={() => selectPlan(plan)}><span className="plan-nav-icon" aria-hidden="true" /> <span className="week-name">{plan.name}</span></button>)}
          <button className="sidebar-empty" onClick={() => { setPlanName(`Scheda ${plans.length + 1}`); setPlanModal("create"); }}>＋ Nuova scheda</button>
          <p className="nav-caption archive-caption">ARCHIVIO</p>
          {archivedPlans.map((plan) => <button className={`nav-item archived ${activePlanId === plan.id ? "active" : ""}`} key={plan.id} onClick={() => selectPlan(plan)}><span className="plan-nav-icon" aria-hidden="true" /> <span className="week-name">{plan.name}</span></button>)}
          {!archivedPlans.length && <p className="sidebar-empty static">Nessuna scheda archiviata</p>}
        </nav>
        <section className="account-panel" aria-label="Account">
          <span className="account-icon" aria-hidden="true">↪</span>
          <div><strong>Account</strong><small>Esci per usare un’altra email</small></div>
          <a href="/cdn-cgi/access/logout" className="logout-button">Esci</a>
        </section>
      </aside>

      <section className="content">
        <div className="mobile-account">
          <div><strong>Account GymFlow</strong><small>Vuoi accedere con un’altra email?</small></div>
          <a href="/cdn-cgi/access/logout" className="mobile-logout-button"><span aria-hidden="true">↪</span> Esci / cambia email</a>
        </div>
        <div className="mobile-view-switch" role="tablist">
          <button className={view === "program" ? "active" : ""} onClick={() => { setView("program"); setActivePlanId(activePlans.length === 1 ? activePlans[0].id : null); }}>Schede <span>{activePlans.length}</span></button>
          <button className={view === "archive" ? "active" : ""} onClick={() => { setView("archive"); if (!activePlan?.archived) selectPlan(archivedPlans[0]); }}>Archivio <span>{archivedPlans.length}</span></button>
        </div>
        <header className="topbar">
          <div><p className="eyebrow">{activePlan?.archived ? "SCHEDA ARCHIVIATA · SOLA VISUALIZZAZIONE" : "IL MIO ALLENAMENTO"}</p>
            <h1>{activePlan ? `Scheda “${activePlan.name}”` : view === "archive" ? "Archivio schede" : activePlans.length > 1 ? "Le mie schede" : "Crea una nuova scheda"}</h1></div>
          <button className="primary-button desktop-add" onClick={() => { setPlanName(`Scheda ${plans.length + 1}`); setPlanModal("create"); }}><span>＋</span> Nuova scheda</button>
        </header>

        {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}
        {loading ? <div className="state-card"><span className="loader" /><p>Carico le tue schede…</p><button className="secondary-button loading-retry" onClick={() => void load()}>Riprova</button></div> : view === "program" && !activePlan && activePlans.length > 1 ? (
          <section className="active-plan-picker" aria-label="Schede attive">
            <p className="plan-picker-intro">Seleziona una Scheda per aprire settimane ed esercizi.</p>
            <div className="active-plan-grid">
              {activePlans.map((plan) => {
                const containedWeeks = weeks.filter((week) => week.planId === plan.id);
                const weekIds = new Set(containedWeeks.map((week) => week.id));
                const containedExercises = exercises.filter((exercise) => weekIds.has(exercise.week));
                return <button className="active-plan-card" key={plan.id} onClick={() => selectPlan(plan)} type="button">
                  <span className="active-plan-card-icon" aria-hidden="true" />
                  <span className="active-plan-card-copy">
                    <small>SCHEDA ATTIVA</small>
                    <strong>Scheda “{plan.name}”</strong>
                    <span>{containedWeeks.length} settimane · {containedExercises.length} esercizi</span>
                  </span>
                  <span className="active-plan-card-arrow" aria-hidden="true">→</span>
                </button>;
              })}
            </div>
            <button className="primary-button plan-picker-create" onClick={() => { setPlanName(`Scheda ${plans.length + 1}`); setPlanModal("create"); }}><span>＋</span> Nuova scheda</button>
          </section>
        ) : !activePlan ? (
          <div className="state-card empty"><div className="empty-icon">＋</div><h2>{view === "archive" ? "L’archivio è vuoto" : "Crea la tua prima scheda"}</h2>
            <p>Ogni scheda contiene tutte le sue settimane e tutti gli esercizi.</p>
            {view === "program" && <button className="primary-button" onClick={() => { setPlanName("La mia scheda"); setPlanModal("create"); }}>Crea scheda</button>}</div>
        ) : (
          <>
            {view === "archive" && (
              <section className="archive-section archive-plan-list" aria-label="Schede archiviate">
                <div className="archive-grid">
                  {archivedPlans.map((plan) => {
                    const archivedWeeks = weeks.filter((week) => week.planId === plan.id);
                    const archivedWeekIds = new Set(archivedWeeks.map((week) => week.id));
                    const archivedExercises = exercises.filter((exercise) => archivedWeekIds.has(exercise.week));
                    return <article className={`archive-card ${activePlanId === plan.id ? "selected" : ""}`} key={plan.id}>
                      <div className="archive-card-top"><span className="archive-accent" /><span className="archive-status">ARCHIVIATA</span></div>
                      <h2>Scheda “{plan.name}”</h2>
                      <p>Archiviata il {dateLabel(plan.archivedAt)}</p>
                      <div className="archive-card-metrics"><span><strong>{archivedWeeks.length}</strong> settimane</span><span><strong>{archivedExercises.length}</strong> esercizi</span></div>
                      <div className="archive-card-actions">
                        <button className="secondary-button" onClick={() => selectPlan(plan)}>Visualizza</button>
                        <button className="restore-button" disabled={saving} onClick={() => void archiveOrRestorePlan(false, plan)}>Ripristina</button>
                        <button className="danger-button" onClick={() => { setActivePlanId(plan.id); setConfirm("delete-plan"); }}>Elimina</button>
                      </div>
                    </article>;
                  })}
                </div>
              </section>
            )}
            <section className="plan-toolbar">
              <div><span className={activePlan.archived ? "archive-status" : "muscle-tag"}>{activePlan.archived ? "ARCHIVIATA" : "SCHEDA ATTIVA"}</span>
                {activePlan.archived && <small>Archiviata il {dateLabel(activePlan.archivedAt)} · ripristinala per modificarla</small>}</div>
              <div className="week-heading-actions">
                {!activePlan.archived && activePlans.length > 1 && <button className="all-plans-button" onClick={() => setActivePlanId(null)}>← Tutte le schede</button>}
                {!activePlan.archived && <button onClick={() => { setPlanName(activePlan.name); setPlanModal("rename"); }}>Rinomina scheda</button>}
                {activePlan.archived
                  ? <button className="restore-button" onClick={() => void archiveOrRestorePlan(false)}>Ripristina</button>
                  : <button className="archive-week-button" onClick={() => setConfirm("archive-plan")}>Archivia scheda</button>}
                <button className="delete-week" onClick={() => setConfirm("delete-plan")}>Elimina</button>
              </div>
            </section>
            <section className="summary-grid" aria-label="Riepilogo scheda">
              <article className="summary-card"><span className="summary-label">SETTIMANE</span><strong>{String(planWeeks.length).padStart(2, "0")}</strong><small>nella scheda</small></article>
              <article className="summary-card"><span className="summary-label">ESERCIZI</span><strong>{String(planExerciseCount).padStart(2, "0")}</strong><small>totali</small></article>
              <article className="summary-card featured"><span className="summary-label">SERIE</span><strong>{String(planSets).padStart(2, "0")}</strong><small>programmate</small></article>
            </section>
            <div className="mobile-weeks" role="tablist" aria-label="Settimane">
              {planWeeks.map((week) => <button className={`${activeWeek?.id === week.id ? "active" : ""} ${week.completed ? "completed" : ""}`} key={week.id} onClick={() => { setActiveWeekId(week.id); setActiveWorkoutId(null); }}>{week.completed ? "✓ " : ""}{week.name}</button>)}
              <button className="mobile-week-add" onClick={() => { setWeekName(`Settimana ${planWeeks.length + 1}`); setWeekModal("create"); }}>＋</button>
            </div>
            <section className={`week-section ${activeWeek?.completed ? "completed" : ""}`}>
              <div className="section-heading"><div><span className="section-accent" style={{ backgroundColor: activeWeek?.accent ?? "#c8ff5a" }} /><div><p>{activePlan.archived ? "NELLA SCHEDA ARCHIVIATA" : "SETTIMANA SELEZIONATA"}</p><h2>{activeWeek?.name ?? "Nessuna settimana"}</h2></div></div>
                {activeWeek && !activePlan.archived && <div className="week-heading-actions">
                  <label className={`week-complete-button ${activeWeek.completed ? "completed" : ""}`}><input type="checkbox" checked={activeWeek.completed} onChange={() => void toggleWeek()} /> Completata</label>
                  <button onClick={() => { setWeekName(activeWeek.name); setWeekModal("rename"); }}>Rinomina</button>
                  <button className="delete-week" onClick={() => setConfirm("delete-week")}>Elimina</button>
                </div>}
              </div>
              {activeWeek && <div className="workout-tabs" role="tablist" aria-label={`Allenamenti di ${activeWeek.name}`}>
                {weekWorkouts.map((workout) => <button className={`${activeWorkout?.id === workout.id ? "active" : ""} ${workout.completed ? "completed" : ""}`} key={workout.id} onClick={() => setActiveWorkoutId(workout.id)} role="tab">{workout.completed ? "✓ " : ""}{workout.name}</button>)}
                {!activePlan.archived && <button className="workout-add" onClick={() => { setWorkoutName(`Allenamento ${String.fromCharCode(65 + weekWorkouts.length)}`); setWorkoutModal("create"); }}>＋ Allenamento</button>}
              </div>}
              {activeWorkout && <div className="workout-heading">
                <div><p className="eyebrow">ALLENAMENTO SELEZIONATO</p><h3>{activeWorkout.name}</h3></div>
                {!activePlan.archived && <div><label className={`workout-complete-button ${activeWorkout.completed ? "completed" : ""}`}><input aria-label={`Contrassegna ${activeWorkout.name} come completato`} checked={activeWorkout.completed} disabled={updatingWorkoutId === activeWorkout.id} onChange={() => void toggleWorkoutCompleted()} type="checkbox" />{updatingWorkoutId === activeWorkout.id ? "Salvataggio…" : "Completato"}</label><button onClick={() => { setWorkoutName(activeWorkout.name); setWorkoutModal("rename"); }}>Rinomina</button><button className="delete-week" onClick={() => setConfirm("delete-workout")}>Elimina</button></div>}
              </div>}
              {!activeWeek ? <div className="state-card empty"><h3>{activePlan.archived ? "Scheda senza settimane" : "Aggiungi una settimana"}</h3><p>Questa scheda è pronta per essere organizzata.</p>{!activePlan.archived && <button className="primary-button" onClick={() => { setWeekName("Settimana 1"); setWeekModal("create"); }}>Aggiungi settimana</button>}</div>
                : !activeWorkout ? <div className="state-card empty"><h3>Nessun allenamento</h3><p>{activePlan.archived ? "Questa settimana non contiene allenamenti." : "Crea Allenamento A, Allenamento B o tutti quelli che ti servono."}</p>{!activePlan.archived && <button className="primary-button" onClick={() => { setWorkoutName("Allenamento A"); setWorkoutModal("create"); }}>Crea Allenamento A</button>}</div>
                : !workoutExercises.length ? <div className="state-card empty"><h3>{activeWorkout.name} è vuoto</h3><p>{activePlan.archived ? "Non contiene esercizi." : "Aggiungi il primo esercizio."}</p>{!activePlan.archived && <button className="primary-button" onClick={() => openExercise()}>Aggiungi esercizio</button>}</div>
                : <div className="exercise-list">{workoutExercises.map((exercise, index) => <article className="exercise-card" key={exercise.id}>
                    <div className="exercise-index">{String(index + 1).padStart(2, "0")}</div><div className="exercise-main">
                      <div className="exercise-title-row"><div><span className="muscle-tag">{exercise.muscleGroup || "ALLENAMENTO"}</span><h3>{exercise.name}</h3></div>
                        {!activePlan.archived && <div className="card-actions"><button aria-label={`Modifica ${exercise.name}`} onClick={() => openExercise(exercise)}>✎</button><button className="delete" aria-label={`Elimina ${exercise.name}`} onClick={() => { setDeleteExerciseId(exercise.id); setConfirm("delete-exercise"); }}>×</button></div>}</div>
                      <div className="metrics"><div><span>SERIE</span><strong>{exercise.sets}</strong></div><div><span>RIPETIZIONI</span><strong>{exercise.reps}</strong></div>
                        <div><span>{exercise.baseWeight ? "CARICO BASE" : "CARICO"}</span><strong>{exercise.baseWeight ? `${exercise.baseWeight} kg` : exercise.weight || "—"}</strong></div>
                        <div className="recovery-result"><span>RECUPERO</span><strong>{exercise.recoverySeconds ? `${exercise.recoverySeconds} sec` : "—"}</strong></div>
                        {exercise.baseWeight && exercise.weightPercentage && <div className="percentage-result"><span>{exercise.weightPercentage}% DEL CARICO</span><strong>{calculateWeight(exercise.baseWeight, exercise.weightPercentage)}</strong></div>}
                      </div>
                      {exercise.notes && <div className="notes"><span>✎ NOTE DELL’ESERCIZIO</span><p>{exercise.notes}</p></div>}
                    </div></article>)}
                    {!activePlan.archived && <button className="add-row" onClick={() => openExercise()}><span>＋</span> Aggiungi esercizio</button>}
                  </div>}
            </section>
          </>
        )}
      </section>
      {activeWorkout && !activePlan?.archived && <button className="floating-add" aria-label="Nuovo esercizio" onClick={() => openExercise()}>＋</button>}
      {toast && <div className="toast" role="status">{toast}</div>}

      {planModal && <Modal title={planModal === "create" ? "Nuova scheda" : "Rinomina scheda"} close={() => setPlanModal(null)}>
        <form onSubmit={savePlan}><label>Nome scheda *<input autoFocus value={planName} onChange={(event) => setPlanName(event.target.value)} placeholder="Es. Forza e massa" /></label><ModalActions saving={saving} close={() => setPlanModal(null)} /></form>
      </Modal>}
      {weekModal && <Modal title={weekModal === "create" ? "Nuova settimana" : "Rinomina settimana"} close={() => setWeekModal(null)}>
        <form onSubmit={saveWeek}><label>Nome settimana *<input autoFocus value={weekName} onChange={(event) => setWeekName(event.target.value)} /></label><ModalActions saving={saving} close={() => setWeekModal(null)} /></form>
      </Modal>}
      {workoutModal && <Modal title={workoutModal === "create" ? "Nuovo allenamento" : "Rinomina allenamento"} close={() => setWorkoutModal(null)}>
        <form onSubmit={saveWorkout}><label>Nome allenamento *<input autoFocus value={workoutName} onChange={(event) => setWorkoutName(event.target.value)} placeholder="Es. Allenamento A" /></label><ModalActions saving={saving} close={() => setWorkoutModal(null)} /></form>
      </Modal>}
      {exerciseModal && <Modal title={editingExerciseId ? "Modifica esercizio" : "Nuovo esercizio"} close={() => setExerciseModal(false)}>
        <form onSubmit={saveExercise}><div className="form-grid">
          <label className="full">Nome esercizio *<input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
          <label>Gruppo muscolare<input value={draft.muscleGroup} onChange={(e) => setDraft({ ...draft, muscleGroup: e.target.value })} /></label>
          <label>Allenamento<select value={draft.workoutId ?? ""} onChange={(e) => setDraft({ ...draft, workoutId: Number(e.target.value) })}>{weekWorkouts.map((workout) => <option value={workout.id} key={workout.id}>{workout.name}</option>)}</select></label>
          <label>Serie<input type="number" min="1" value={draft.sets} onChange={(e) => setDraft({ ...draft, sets: Number(e.target.value) })} /></label>
          <label>Ripetizioni<input value={draft.reps} onChange={(e) => setDraft({ ...draft, reps: e.target.value })} /></label>
          <label>Tempo di recupero (secondi)<input min="0" max="3600" step="1" type="number" inputMode="numeric" value={draft.recoverySeconds || ""} onChange={(e) => setDraft({ ...draft, recoverySeconds: e.target.value ? Number(e.target.value) : 0 })} placeholder="Es. 90" /></label>
          <label>Carico base (kg)<input inputMode="decimal" value={draft.baseWeight} onChange={(e) => setDraft({ ...draft, baseWeight: e.target.value })} placeholder="Es. 60" /></label>
          <label>Percentuale del carico<input inputMode="decimal" min="0.1" max="100" step="0.1" type="number" value={draft.weightPercentage ?? ""} onChange={(e) => setDraft({ ...draft, weightPercentage: e.target.value ? Number(e.target.value) : null })} placeholder="Es. 57.5" /></label>
          <div className="weight-calculation full" aria-live="polite">
            <span>RISULTATO CALCOLATO</span>
            <strong>{calculateWeight(draft.baseWeight, draft.weightPercentage) || "Inserisci carico e percentuale"}</strong>
            {calculateWeight(draft.baseWeight, draft.weightPercentage) && <small>{draft.baseWeight.replace(".", ",")} kg × {draft.weightPercentage}%</small>}
          </div>
          <label className="full">Note<textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
        </div><ModalActions saving={saving} close={() => setExerciseModal(false)} /></form>
      </Modal>}
      {confirm && <Modal title={confirm === "archive-plan" ? "Archiviare la scheda?" : "Conferma eliminazione"} close={() => setConfirm(null)}>
        <p>{confirm === "archive-plan" ? "La Scheda, con tutte le settimane e gli esercizi, passerà nell’archivio. Potrai visualizzarla, modificarla e ripristinarla." : "Questa eliminazione rimuove definitivamente il contenuto selezionato."}</p>
        <div className="modal-actions"><button className="secondary-button" onClick={() => setConfirm(null)}>Annulla</button><button className={confirm === "archive-plan" ? "primary-button" : "danger-button"} disabled={saving} onClick={() => void (confirm === "archive-plan" ? archiveOrRestorePlan(true) : confirm === "delete-plan" ? deletePlan() : confirm === "delete-week" ? deleteWeek() : confirm === "delete-workout" ? deleteWorkout() : deleteExercise())}>{saving ? "Attendi…" : confirm === "archive-plan" ? "Archivia tutto" : "Elimina"}</button></div>
      </Modal>}
    </main>
  );
}

function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={close}><section className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><h2>{title}</h2><button className="close-button" aria-label="Chiudi" onClick={close}>×</button></div>{children}</section></div>;
}
function ModalActions({ saving, close }: { saving: boolean; close: () => void }) {
  return <div className="modal-actions"><button className="secondary-button" type="button" onClick={close}>Annulla</button><button className="primary-button" disabled={saving} type="submit">{saving ? "Salvataggio…" : "Salva"}</button></div>;
}
