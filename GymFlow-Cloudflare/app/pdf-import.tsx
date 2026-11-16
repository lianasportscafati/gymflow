"use client";
import { useEffect,useRef,useState } from "react";
import { openPdf,type PdfDocument } from "../lib/pdf-browser";
import { parsePdfPlan,validateDraft,type ImportDraft,type ImportRow } from "../lib/pdf-plan";

export default function PdfImport({close,complete}:{close:()=>void;complete:(id:number)=>Promise<void>}){
 const [draft,setDraft]=useState<ImportDraft|null>(null),[doc,setDoc]=useState<PdfDocument|null>(null);
 const [page,setPage]=useState(1),[week,setWeek]=useState(1),[error,setError]=useState(""),[busy,setBusy]=useState(false),[reviewed,setReviewed]=useState(false);
 const [status,setStatus]=useState("");const canvas=useRef<HTMLCanvasElement>(null),requestKey=useRef(crypto.randomUUID());
 const latestDoc=useRef<PdfDocument|null>(null);
 useEffect(()=>()=>{void latestDoc.current?.destroy();},[]);
 useEffect(()=>{let cancelled=false;let task:{promise:Promise<void>;cancel?:()=>void}|undefined;
  if(doc)void (async()=>{try{const p=await doc.getPage(page);if(cancelled||!canvas.current)return;const viewport=p.getViewport({scale:1.5});canvas.current.width=viewport.width;canvas.current.height=viewport.height;task=p.render({canvas:canvas.current,canvasContext:canvas.current.getContext("2d"),viewport});await task.promise;}catch(e){if(!cancelled)setError(e instanceof Error?e.message:"Anteprima non disponibile");}})();
  return ()=>{cancelled=true;task?.cancel?.();};
 },[doc,page]);
 const change=(index:number,key:keyof ImportRow,value:string)=>{if(!draft)return;setReviewed(false);requestKey.current=crypto.randomUUID();setDraft({...draft,rows:draft.rows.map((r,i)=>i===index?{...r,[key]:key==="week"||key==="sets"?Number(value):value}:r)});};
 async function load(file:File){setBusy(true);setError("");setReviewed(false);setDraft(null);setDoc(null);await latestDoc.current?.destroy();latestDoc.current=null;
  try{const result=await openPdf(file);latestDoc.current=result.doc;setDoc(result.doc);setPage(1);setWeek(1);requestKey.current=crypto.randomUUID();setDraft(parsePdfPlan(result.words,file.name.replace(/\.pdf$/i,"")));}catch(e){setError(e instanceof Error?e.message:"PDF non leggibile");}finally{setBusy(false);}
 }
 async function save(){if(!draft||!reviewed)return;setBusy(true);setError("");try{
  const valid=validateDraft(draft);setStatus("Salvataggio della nuova scheda…");
  const response=await fetch("/api/import",{method:"POST",headers:{"content-type":"application/json","idempotency-key":requestKey.current},body:JSON.stringify(valid)});
  const data=await response.json() as {planId:number;error?:string};if(!response.ok)throw new Error(data.error||"Importazione non riuscita");await complete(data.planId);
 }catch(e){setError(e instanceof Error?e.message:"Errore di connessione: puoi riprovare senza duplicare la scheda");}finally{setBusy(false);setStatus("");}}
 return <div className="modal-backdrop"><section className="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="pdf-title">
  <div className="modal-header"><div><p className="eyebrow">NUOVA SCHEDA</p><h2 id="pdf-title">Importa PDF</h2></div><button disabled={busy} className="close-button" aria-label="Chiudi importazione" onClick={close}>×</button></div>
  <p>Il PDF viene letto sul tuo dispositivo. Solo i dati verificati saranno salvati online, come nuova scheda.</p>
  <label className="pdf-upload">Scegli PDF (massimo 20 MB)<input disabled={busy} type="file" accept="application/pdf,.pdf" onChange={e=>{const f=e.target.files?.[0];if(f)void load(f);}} /></label>
  {busy&&<p role="status">{status||"Lettura del documento…"}</p>}{error&&<p className="error-banner" role="alert">{error}</p>}
  {doc&&<details open><summary>Anteprima del documento</summary><div className="pdf-preview"><canvas ref={canvas} aria-label={`Pagina ${page} del PDF`} /></div><div className="pdf-pager"><button disabled={busy||page===1} onClick={()=>setPage(page-1)}>Precedente</button><span>{page} / {doc.numPages}</span><button disabled={busy||page===doc.numPages} onClick={()=>setPage(page+1)}>Successiva</button></div></details>}
  {draft&&<>
   <div className="form-grid"><label>Nome scheda<input disabled={busy} value={draft.name} onChange={e=>{setDraft({...draft,name:e.target.value});requestKey.current=crypto.randomUUID();}} /></label><label>Settimane previste<input disabled={busy} type="number" min="1" max="52" value={draft.weeks} onChange={e=>{setDraft({...draft,weeks:Number(e.target.value)});setReviewed(false);requestKey.current=crypto.randomUUID();}} /></label></div>
   {draft.warnings.length>0&&<div className="import-warnings" role="status"><strong>Controlla i dati riconosciuti</strong>{draft.warnings.map((w,i)=><p key={i}>{w}</p>)}</div>}
   <p>{draft.rows.length} prescrizioni riconosciute. Le settimane senza righe rimarranno vuote. “Da assegnare” non appartiene ad A/B/C.</p>
   <div className="import-weeks">{Array.from({length:draft.weeks},(_,i)=>i+1).concat(0).map(w=><button key={w} className={week===w?"active":""} onClick={()=>setWeek(w)}>{w?`W${w}`:"Da assegnare"} <small>({draft.rows.filter(r=>r.week===w).length})</small></button>)}</div>
   <div className="import-rows">{draft.rows.map((r,index)=>r.week===week&&<article key={index} className="import-row"><div className="form-grid">
    <label className="full">Esercizio<input disabled={busy} value={r.name} onChange={e=>change(index,"name",e.target.value)}/></label>
    <label>Settimana<select disabled={busy} value={r.week} onChange={e=>change(index,"week",e.target.value)}><option value="0">Senza settimana</option>{Array.from({length:draft.weeks},(_,i)=><option value={i+1} key={i}>{i+1}</option>)}</select></label>
    <label>Giornata<select disabled={busy} value={r.day} onChange={e=>change(index,"day",e.target.value)}>{["?","A","B","C","D","E","F"].map(d=><option key={d}>{d}</option>)}</select></label>
    <label>Serie<input disabled={busy} type="number" min="1" max="99" value={r.sets} onChange={e=>change(index,"sets",e.target.value)}/></label><label>Ripetizioni / secondi<input disabled={busy} value={r.reps} onChange={e=>change(index,"reps",e.target.value)}/></label>
    <label>% massimale<input disabled={busy} inputMode="decimal" value={r.percentage} onChange={e=>change(index,"percentage",e.target.value)}/></label><label>Kg programmati<input disabled={busy} inputMode="decimal" value={r.weight} onChange={e=>change(index,"weight",e.target.value)}/></label>
    <label className="full">Note<input disabled={busy} value={r.notes} onChange={e=>change(index,"notes",e.target.value)}/></label>
   </div><button disabled={busy} className="delete-week" onClick={()=>{setDraft({...draft,rows:draft.rows.filter((_,i)=>i!==index)});setReviewed(false);requestKey.current=crypto.randomUUID();}}>Rimuovi riga</button></article>)}</div>
   {!draft.rows.some(r=>r.week===week)&&<p>Nessun esercizio in questa sezione.</p>}
   <button disabled={busy} className="secondary-button" onClick={()=>{setDraft({...draft,rows:[...draft.rows,{week,day:week?"A":"?",name:"",sets:3,reps:"10",muscleGroup:"",percentage:"",weight:"",notes:""}]});setReviewed(false);requestKey.current=crypto.randomUUID();}}>＋ Aggiungi riga</button>
   <label className="import-confirm"><input disabled={busy} type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/> Ho confrontato tutte le settimane e le giornate con il PDF.</label>
   <div className="modal-actions"><button disabled={busy} className="secondary-button" onClick={close}>Annulla</button><button className="primary-button" disabled={busy||!reviewed||!draft.rows.length} onClick={()=>void save()}>{busy?"Salvataggio…":"Crea scheda dal PDF"}</button></div>
  </>}
 </section></div>;
}
