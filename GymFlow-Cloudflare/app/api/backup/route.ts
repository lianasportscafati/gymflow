import {getAuthenticatedEmail} from "../../../db";
import {trainingDatabase} from "../../../lib/training-store";
export async function GET(request:Request){
 try{
  const owner=getAuthenticatedEmail(request),db=await trainingDatabase();
  const tables=["workout_plans","weeks","workouts","exercises","exercise_maxima","performed_sets"];
  const data=await db.batch(tables.map(t=>db.prepare(`SELECT * FROM ${t} WHERE owner_email=?`).bind(owner)));
  const result:Record<string,unknown>={format:"gymflow-online",version:1,exportedAt:new Date().toISOString()};
  tables.forEach((t,i)=>{result[t]=data[i].results;});
  return Response.json(result,{headers:{"cache-control":"no-store","content-disposition":"attachment; filename=gymflow-backup.json"}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:"Backup non disponibile"},{status:400});}
}
