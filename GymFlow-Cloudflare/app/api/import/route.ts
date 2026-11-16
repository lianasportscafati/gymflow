import { ensureSchema,getAuthenticatedEmail,getDatabase } from "../../../db";
import { validateDraft } from "../../../lib/pdf-plan";
export async function POST(request:Request){
 let marker="";
 try{
  const owner=getAuthenticatedEmail(request),key=request.headers.get("idempotency-key")??"";
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(key))throw new Error("Identificativo importazione non valido");
  marker=`pdf_import:${owner}:${key}`;
  const text=await request.text();if(text.length>2_000_000)throw new Error("Importazione troppo grande");
  const draft=validateDraft(JSON.parse(text));if(draft.rows.length>500)throw new Error("Massimo 500 prescrizioni per importazione");
  await ensureSchema();const db=getDatabase();
  const existing=await db.prepare("SELECT value FROM app_meta WHERE key=?").bind(marker).first<{value:string}>();
  if(existing)return Response.json({planId:Number(existing.value),reused:true},{headers:{"cache-control":"no-store"}});
  const q=(sql:string,...values:unknown[])=>db.prepare(sql).bind(...values);
  const plan="(SELECT CAST(value AS INTEGER) FROM app_meta WHERE key=?)";
  const statements=[
   q("INSERT INTO workout_plans(owner_email,name,position) SELECT ?,?,COALESCE(MAX(position),0)+1 FROM workout_plans WHERE owner_email=?",owner,draft.name,owner),
   q("INSERT INTO app_meta(key,value) VALUES(?,CAST(last_insert_rowid() AS TEXT))",marker),
  ];
  const weeks=Array.from({length:draft.weeks},(_,i)=>i+1);if(draft.rows.some(r=>r.week===0))weeks.push(0);
  const weekName=(n:number)=>n?`Settimana ${n}`:"Da assegnare (senza settimana)";
  const dayName=(d:string)=>d==="?"?"Non assegnato":`Allenamento ${d}`;
  for(const w of weeks){
   statements.push(q(`INSERT INTO weeks(owner_email,plan_id,name,accent,position) SELECT ?,${plan},?,'#c8ff5a',COALESCE(MAX(position),0)+1 FROM weeks WHERE owner_email=?`,owner,marker,weekName(w),owner));
   const days=[...new Set(draft.rows.filter(r=>r.week===w).map(r=>r.day))];
   for(const [index,day] of days.entries())statements.push(q(`INSERT INTO workouts(owner_email,week_id,name,position) VALUES(?,(SELECT id FROM weeks WHERE plan_id=${plan} AND name=?),?,?)`,owner,marker,weekName(w),dayName(day),index+1));
  }
  draft.rows.forEach((r,index)=>{
   statements.push(q(`INSERT INTO exercises(owner_email,week,workout_id,name,muscle_group,sets,reps,weight,base_weight,weight_percentage,recovery_seconds,notes,position) VALUES(?,(SELECT id FROM weeks WHERE plan_id=${plan} AND name=?),(SELECT workouts.id FROM workouts JOIN weeks ON weeks.id=workouts.week_id WHERE weeks.plan_id=${plan} AND weeks.name=? AND workouts.name=?),?,?,?,?,?,'',?,0,?,?)`,owner,marker,weekName(r.week),marker,weekName(r.week),dayName(r.day),r.name.trim(),r.muscleGroup,r.sets,r.reps,r.weight,r.percentage?Number(r.percentage.replace(",",".")):null,r.notes,index+1));
  });
  // D1 batch is atomic: no partly imported plan is left after a failed row.
  await db.batch(statements);
  const created=await db.prepare("SELECT value FROM app_meta WHERE key=?").bind(marker).first<{value:string}>();
  return Response.json({planId:Number(created!.value)},{status:201,headers:{"cache-control":"no-store"}});
 }catch(error){
  if(marker){try{const old=await getDatabase().prepare("SELECT value FROM app_meta WHERE key=?").bind(marker).first<{value:string}>();if(old)return Response.json({planId:Number(old.value),reused:true});}catch{/* Keep the original failure. */}}
  return Response.json({error:error instanceof Error?error.message:"Importazione non riuscita"},{status:400});
 }
}
