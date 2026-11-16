export type PdfWord = { text: string; x: number; y: number; width: number; page: number };
export type ImportRow = { week: number; day: string; name: string; muscleGroup: string; sets: number; reps: string; percentage: string; weight: string; notes: string };
export type ImportDraft = { name: string; weeks: number; rows: ImportRow[]; warnings: string[] };
export function exerciseKey(name: string) { return name.trim().toLocaleLowerCase("it").replace(/\s+/g, " "); }
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const percent = (s: string) => s.match(/(\d+(?:[.,]\d+)?)\s*%/)?.[1].replace(",", ".") ?? "";
/** Read table coordinates, without pre-filled exercise or athlete data. */
export function parsePdfPlan(items: PdfWord[], name: string): ImportDraft {
 const lines: PdfWord[][] = [];
 for (const item of [...items].sort((a,b) => a.page-b.page || a.y-b.y || a.x-b.x)) {
  if (!item.text.trim()) continue;
  const last = lines[lines.length-1];
  if(last&&last[0].page===item.page&&Math.abs(last[0].y-item.y)<=2.5)last.push(item);else lines.push([item]);
 }
 const text=(line:PdfWord[])=>clean([...line].sort((a,b)=>a.x-b.x).map(i=>i.text).join(" "));
 const declaredWeeks=Number(lines.map(text).join("\n").match(/(\d+)\s+settimane/i)?.[1]??0);
 const rows:ImportRow[]=[],warnings:string[]=[];
 let day="",headers:{label:string;center:number}[]=[],totalWeeks=declaredWeeks;
 const pending:Array<{day:string;name:string;group:string;sets:string;reps:string;note:string;cells:string[];weeks:number[]}>=[];
 for(const line of lines){
  const t=text(line),dayMatch=t.match(/^ALLENAMENTO\s+([A-Z])\b/i);
  if(dayMatch){day=dayMatch[1].toUpperCase();headers=[];continue;}
  if(/\bEsercizio\b/i.test(t)&&/\bSerie\b/i.test(t)&&/\bW1\b/i.test(t)){
   const words=line.flatMap(i=>[...i.text.matchAll(/\S+/g)].map(m=>({text:m[0],x:i.x+(m.index??0)*i.width/Math.max(1,i.text.length),width:m[0].length*i.width/Math.max(1,i.text.length)})));
   headers=words.filter(w=>/^(Gruppo|Esercizio|Serie|Ripetizioni|REC|note|W\d+)$/i.test(w.text)).map(w=>({label:w.text.toLowerCase(),center:w.x+w.width/2})).sort((a,b)=>a.center-b.center);continue;
  }
  if(!day){
   const ab=t.match(/(?:^|\s)\d\s+(.+?)\s+(\d+)\s*[x×]\s*(\d+(?:[/\-]\d+)?)\s*(["″]?)/i);
   if(ab)rows.push({week:0,day:"?",name:clean(ab[1]),muscleGroup:"ADDOME",sets:Number(ab[2]),reps:ab[3]+(ab[4]?" secondi":""),percentage:"",weight:"",notes:"Giornata e frequenza non specificate nel PDF"});continue;
  }
  if(!headers.length)continue;
  const columns=new Map<string,string>();
  for(const item of line){const center=item.x+item.width/2;let index=headers.findIndex((h,i)=>i===headers.length-1||center<(h.center+headers[i+1].center)/2);if(index<0)index=headers.length-1;const label=headers[index].label;columns.set(label,clean((columns.get(label)??"")+" "+item.text));}
  const exercise=columns.get("esercizio")??"";if(!exercise)continue;
  const sets=columns.get("serie")??"",reps=columns.get("ripetizioni")??"";
  if(!/^(\d+|v)$/i.test(sets)){warnings.push("Riga da verificare: "+t);continue;}
  const weekHeaders=headers.filter(h=>/^w\d+$/.test(h.label));totalWeeks=Math.max(totalWeeks,...weekHeaders.map(h=>Number(h.label.slice(1))));
  pending.push({day,name:exercise,group:columns.get("gruppo")??"",sets,reps,note:columns.get("note")??"",cells:weekHeaders.map(h=>columns.get(h.label)??""),weeks:weekHeaders.map(h=>Number(h.label.slice(1)))});
 }
 const activeWeeks=new Set<number>();pending.forEach(p=>p.cells.forEach((cell,i)=>{if(cell.trim())activeWeeks.add(p.weeks[i]);}));
 for(const p of pending){const variable=/^v$/i.test(p.sets)||/^v$/i.test(p.reps);
  p.weeks.forEach((week,i)=>{const cell=p.cells[i];if(!activeWeeks.has(week))return;
   const progression=cell.match(/(\d+)\s*s?\s*[x×]\s*(\d+(?:[/\-]\d+)?)/i);
   if(variable&&!progression){warnings.push(`${p.day} / W${week} / ${p.name}: progressione mancante`);return;}
   if(p.cells.some(Boolean)&&!cell)return;
   const sets=progression?Number(progression[1]):Number(p.sets),reps=progression?progression[2]:p.reps.replace(/^x\s*/i,"");
   if(!sets||!reps){warnings.push(`${p.day} / W${week} / ${p.name}: serie o ripetizioni mancanti`);return;}
   rows.push({week,day:p.day,name:p.name,muscleGroup:p.group,sets,reps,percentage:percent(cell)||percent(p.note),weight:"",notes:clean(p.note.replace(/\d+(?:[.,]\d+)?\s*%/g,""))});
  });
 }
 if(!rows.length)warnings.push("Nessuna tabella riconosciuta. Inserisci i dati manualmente. Le scansioni richiedono OCR, non incluso.");
 if(!activeWeeks.size&&pending.length)warnings.push("Nessuna settimana compilata riconosciuta: non sono state inventate prescrizioni.");
 return {name,weeks:Math.max(1,Math.min(52,totalWeeks||6)),rows,warnings};
}
export function validateDraft(input:unknown):ImportDraft {
 if(!input||typeof input!=="object")throw new Error("Scheda non valida");const d=input as ImportDraft;
 if(typeof d.name!=="string"||!d.name.trim()||d.name.length>160)throw new Error("Inserisci un nome scheda (massimo 160 caratteri)");
 if(!Number.isInteger(d.weeks)||d.weeks<1||d.weeks>52)throw new Error("Numero settimane non valido");
 if(!Array.isArray(d.rows)||!d.rows.length||d.rows.length>1000)throw new Error("Servono da 1 a 1000 prescrizioni");const seen=new Set<string>();
 d.rows.forEach((r,index)=>{
  if(!r||!Number.isInteger(r.week)||r.week<0||r.week>d.weeks||typeof r.day!=="string"||!/^([A-Z]|\?)$/.test(r.day)||(r.week===0&&r.day!=="?"))throw new Error(`Riga ${index+1}: settimana o giornata non valida`);
  if(typeof r.name!=="string"||!r.name.trim()||r.name.length>160||!Number.isInteger(r.sets)||r.sets<1||r.sets>99||typeof r.reps!=="string"||!r.reps.trim()||r.reps.length>80)throw new Error(`Riga ${index+1}: esercizio, serie o ripetizioni non validi`);
  for(const key of ["percentage","weight","notes","muscleGroup"] as const)if(typeof r[key]!=="string"||r[key].length>2000)throw new Error(`Riga ${index+1}: campo non valido`);
  if(r.percentage&&(!/^\d+(?:[.,]\d+)?$/.test(r.percentage)||Number(r.percentage.replace(",","."))>100))throw new Error(`Riga ${index+1}: percentuale non valida`);
  if(r.weight&&!/^\d+(?:[.,]\d+)?$/.test(r.weight))throw new Error(`Riga ${index+1}: kg non validi`);
  const key=[r.week,r.day,exerciseKey(r.name)].join("|");if(seen.has(key))throw new Error(`Riga ${index+1}: esercizio duplicato`);seen.add(key);
 });return {...d,name:d.name.trim(),warnings:[]};
}
