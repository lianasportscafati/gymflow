"use client";
import {useEffect,useState} from "react";
import {calculateWeight} from "../lib/weight";
import type {SetLog} from "./api/training/route";
type Data={max:string;current:SetLog[];previous:SetLog[]};
export default function TrainingExercise({id,sets,percentage,readOnly}:{id:number;sets:number;percentage:number|null;readOnly:boolean}){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(""),[max,setMax]=useState(""),[busy,setBusy]=useState(false);
 async function load(){const response=await fetch(`/api/training?exerciseId=${id}`,{cache:"no-store"});const value=await response.json();if(!response.ok)throw new Error(value.error);setData(value);setMax(value.max);}
 useEffect(()=>{let alive=true;void fetch(`/api/training?exerciseId=${id}`,{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(alive){setData(d);setMax(d.max);}}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[id]);
 async function save(values:object){setBusy(true);setError("");try{const r=await fetch("/api/training",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({exerciseId:id,...values})});const d=await r.json();if(!r.ok)throw new Error(d.error);await load();}catch(e){setError(e instanceof Error?e.message:"Salvataggio non riuscito");throw e;}finally{setBusy(false);}}
 return <div className="training-exercise">
  {error&&<p role="alert" className="training-error">{error}</p>}
  {data&&<>
   <div className="shared-max"><label>Massimale condiviso (kg)<input disabled={busy||readOnly} inputMode="decimal" value={max} onChange={e=>setMax(e.target.value)}/></label>{!readOnly&&<button disabled={busy} className="secondary-button" onClick={()=>void save({action:"max",kg:max}).catch(()=>{})}>Salva massimale</button>}</div>
   {percentage!==null&&<p className="programmed-load">Carico da massimale: {calculateWeight(data.max,percentage)||"imposta il massimale"}</p>}
   <p className="previous-load"><strong>Settimana precedente:</strong> {data.previous.length?data.previous.map(s=>`S${s.set_number}: ${s.kg} kg × ${s.reps}`).join(" · "):"nessuna serie registrata per questo esercizio e giornata"}</p>
   <details><summary>Serie realmente eseguite <span>{data.current.length} / {sets}</span></summary>
    <p className="training-hint">Inserisci solo ciò che hai eseguito. Il carico previsto non viene registrato automaticamente.</p>
    {Array.from({length:sets},(_,i)=><SetForm key={`${id}-${i}-${data.current.find(s=>s.set_number===i+1)?.recorded_at??""}`} index={i+1} old={data.current.find(s=>s.set_number===i+1)} disabled={busy||readOnly} save={save}/>)}
   </details>
  </>}
 </div>;
}
function SetForm({index,old,disabled,save}:{index:number;old?:SetLog;disabled:boolean;save:(value:object)=>Promise<void>}){
 const [kg,setKg]=useState(old?.kg??""),[reps,setReps]=useState(old?.reps??""),[note,setNote]=useState(old?.note??"");
 return <form className="performed-form" onSubmit={e=>{e.preventDefault();void save({action:"set",kg,reps,note,setNumber:index}).catch(()=>{});}}><strong>Serie {index}{old?" · salvata":""}</strong><div className="performed-fields"><label>Kg reali<input required disabled={disabled} inputMode="decimal" value={kg} onChange={e=>setKg(e.target.value)}/></label><label>Ripetizioni / secondi<input required disabled={disabled} inputMode="numeric" value={reps} onChange={e=>setReps(e.target.value)}/></label><label>Nota<input disabled={disabled} value={note} onChange={e=>setNote(e.target.value)}/></label></div><button disabled={disabled} className="secondary-button" type="submit">{old?"Aggiorna serie":"Salva serie"}</button></form>;
}
