"use client";
import {useEffect,useState} from "react";
import type {SetLog} from "./api/training/route";
export default function TrainingHistory({close}:{close:()=>void}){
 const [logs,setLogs]=useState<SetLog[]|null>(null),[error,setError]=useState("");
 useEffect(()=>{let active=true;void fetch("/api/backup",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(active)setLogs(d.performed_sets.sort((a:SetLog,b:SetLog)=>b.recorded_at.localeCompare(a.recorded_at)));}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 return <div className="modal-backdrop"><section className="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="history-title"><div className="modal-header"><h2 id="history-title">Storico allenamenti</h2><button aria-label="Chiudi storico" className="close-button" onClick={close}>×</button></div><p>Le serie eseguite rimangono nello storico anche cambiando o eliminando scheda.</p><a className="secondary-button" href="/api/backup" download="gymflow-backup.json">Esporta backup completo</a>{error&&<p role="alert">{error}</p>}{logs===null&&!error&&<p>Caricamento…</p>}{logs?.length===0&&<p>Nessuna serie registrata.</p>}{logs?.map(log=><article className="import-row" key={log.id}><small>{log.plan_name} · {log.week_name} · {log.day_name}</small><h3>{log.exercise_name}</h3><p>Serie {log.set_number}: <strong>{log.kg} kg × {log.reps}</strong></p>{log.note&&<p>{log.note}</p>}</article>)}</section></div>;
}
