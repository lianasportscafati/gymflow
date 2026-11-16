import {getAuthenticatedEmail} from "../../../db";
import {trainingDatabase} from "../../../lib/training-store";
import {exerciseKey} from "../../../lib/pdf-plan";
import {decimal} from "../../../lib/decimal";
export type SetLog={id:number;exercise_id:number;exercise_key:string;exercise_name:string;plan_name:string;week_name:string;day_name:string;set_number:number;kg:string;reps:string;note:string;recorded_at:string};
async function context(request:Request,id:unknown){
 const owner=getAuthenticatedEmail(request),db=await trainingDatabase(),exerciseId=Number(id);
 if(!Number.isInteger(exerciseId)||exerciseId<1)throw new Error("Esercizio non valido");
 const exercise=await db.prepare(`SELECT e.id,e.name,e.sets,e.week,w.plan_id,w.name AS week_name,w.position,p.name AS plan_name,p.archived,wo.name AS day_name FROM exercises e JOIN weeks w ON w.id=e.week JOIN workout_plans p ON p.id=w.plan_id JOIN workouts wo ON wo.id=e.workout_id WHERE e.id=? AND e.owner_email=? AND w.owner_email=? AND p.owner_email=? AND wo.owner_email=?`).bind(exerciseId,owner,owner,owner,owner).first<{id:number;name:string;sets:number;week:number;plan_id:number;week_name:string;position:number;plan_name:string;day_name:string;archived:number}>();
 if(!exercise)throw new Error("Esercizio non trovato");return {owner,db,exercise,key:exerciseKey(exercise.name)};
}
export async function GET(request:Request){
 try{
  const {owner,db,exercise,key}=await context(request,new URL(request.url).searchParams.get("exerciseId"));
  const max=await db.prepare("SELECT kg FROM exercise_maxima WHERE owner_email=? AND exercise_key=?").bind(owner,key).first<{kg:string}>();
  const current=await db.prepare("SELECT * FROM performed_sets WHERE owner_email=? AND exercise_id=? ORDER BY set_number").bind(owner,exercise.id).all<SetLog>();
  const previousWeek=await db.prepare("SELECT id FROM weeks WHERE owner_email=? AND plan_id=? AND position<? AND name NOT LIKE 'Da assegnare%' ORDER BY position DESC LIMIT 1").bind(owner,exercise.plan_id,exercise.position).first<{id:number}>();
  const previous=previousWeek?await db.prepare("SELECT * FROM performed_sets WHERE owner_email=? AND plan_id=? AND week_id=? AND LOWER(TRIM(day_name))=LOWER(TRIM(?)) AND exercise_key=? ORDER BY set_number").bind(owner,exercise.plan_id,previousWeek.id,exercise.day_name,key).all<SetLog>():{results:[]};
  return Response.json({max:max?.kg??"",current:current.results,previous:previous.results},{headers:{"cache-control":"no-store"}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:"Errore"},{status:400});}
}
export async function POST(request:Request){
 try{
  const body=await request.json() as {exerciseId:number;action:string;kg:string;setNumber:number;reps:string;note:string};
  const {owner,db,exercise,key}=await context(request,body.exerciseId);
  if(exercise.archived)throw new Error("Ripristina la scheda per registrare nuove serie");
  if(typeof body.kg!=="string")throw new Error("Inserisci i kg");decimal(body.kg);
  const kg=body.kg.trim().replace(",",".");
  if(body.action==="max")await db.prepare("INSERT INTO exercise_maxima(owner_email,exercise_key,kg) VALUES(?,?,?) ON CONFLICT(owner_email,exercise_key) DO UPDATE SET kg=excluded.kg").bind(owner,key,kg).run();
  else if(body.action==="set"){
   if(!Number.isInteger(body.setNumber)||body.setNumber<1||body.setNumber>exercise.sets)throw new Error("Numero serie non valido");
   if(typeof body.reps!=="string"||!/^\d+$/.test(body.reps)||Number(body.reps)<1||body.reps.length>6)throw new Error("Inserisci ripetizioni o secondi positivi");
   if(typeof body.note!=="string"||body.note.length>2000)throw new Error("Nota troppo lunga");
   await db.prepare(`INSERT INTO performed_sets(owner_email,exercise_id,exercise_key,exercise_name,plan_id,plan_name,week_id,week_name,day_name,set_number,kg,reps,note,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_email,exercise_id,set_number) DO UPDATE SET kg=excluded.kg,reps=excluded.reps,note=excluded.note,recorded_at=excluded.recorded_at`).bind(owner,exercise.id,key,exercise.name,exercise.plan_id,exercise.plan_name,exercise.week,exercise.week_name,exercise.day_name,body.setNumber,kg,body.reps,body.note,new Date().toISOString()).run();
  }else throw new Error("Operazione non valida");
  return Response.json({saved:true});
 }catch(e){return Response.json({error:e instanceof Error?e.message:"Errore"},{status:400});}
}
