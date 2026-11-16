import {ensureSchema,getDatabase} from "../db";
let ready:Promise<void>|undefined;
export async function trainingDatabase(){
 await ensureSchema();const db=getDatabase();
 ready??=db.batch([
  db.prepare("CREATE TABLE IF NOT EXISTS exercise_maxima(owner_email TEXT NOT NULL,exercise_key TEXT NOT NULL,kg TEXT NOT NULL,PRIMARY KEY(owner_email,exercise_key))"),
  db.prepare(`CREATE TABLE IF NOT EXISTS performed_sets(id INTEGER PRIMARY KEY AUTOINCREMENT,owner_email TEXT NOT NULL,exercise_id INTEGER NOT NULL,exercise_key TEXT NOT NULL,exercise_name TEXT NOT NULL,plan_id INTEGER NOT NULL,plan_name TEXT NOT NULL,week_id INTEGER NOT NULL,week_name TEXT NOT NULL,day_name TEXT NOT NULL,set_number INTEGER NOT NULL,kg TEXT NOT NULL,reps TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',recorded_at TEXT NOT NULL,UNIQUE(owner_email,exercise_id,set_number))`),
  db.prepare("CREATE INDEX IF NOT EXISTS performed_sets_history ON performed_sets(owner_email,plan_id,week_id,day_name,exercise_key)"),
 ]).then(()=>{}).catch(e=>{ready=undefined;throw e;});await ready;return db;
}
