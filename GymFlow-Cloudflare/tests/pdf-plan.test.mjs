import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
async function source(name){const text=await readFile(new URL('../lib/'+name+'.ts',import.meta.url),'utf8');return import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(text)).toString('base64'));}
const {parsePdfPlan,validateDraft}=await source('pdf-plan');
const {exactPercentage}=await source('decimal');
const words=[];let y=0;
function line(cells){y+=20;cells.forEach(([text,x,width=20])=>words.push({text,x,y,width,page:1}));}
line([['DURATA 6 settimane',0,180]]);
line([['1 CRUNCH V 3x15',500,160]]);line([['2 PLANK caviglie stese 3x60"',500,200]]);line([['3 hollow hold 3x40"',500,160]]);
for(const d of ['A','B','C']){
 line([['ALLENAMENTO '+d,0,150]]);
 line([['Gruppo',0],['Esercizio',150],['Serie',300],['Ripetizioni',360],['REC',430],['note',490],...Array.from({length:6},(_,i)=>['W'+(i+1),560+i*65])]);
 line([['PETTO',0],[d==='A'?'Panca Piana':d==='B'?'Stacco da terra':'Squat',145,110],['V',300],['V',360],['120"',430],['70%',490],...['5sx3','6sx3','7sx3','8sx3'].map((v,i)=>[v,560+i*65])]);
 line([['GAMBE',0],[d==='A'?'Squat':d==='B'?'Panca piana':'Stacco da terra',145,110],['5',300],['x5',360],['120"',430],[d==='B'?'fermo 3"':'da rialzo',480,55],...(d==='B'?['57.5%','60%','62.5%','65%']:['60%','62.5%','65%','67.5%']).map((v,i)=>[v,560+i*65])]);
 for(let i=0;i<4;i++)line([['SPALLE',0],['Accessorio '+d+' '+i,145,110],['3',300],['x10/12',360],['90"',430]]);
}
test('tabella a coordinate: 6 settimane, 72 prescrizioni e 3 non assegnate',()=>{
 const d=parsePdfPlan(words,'Accumulo');assert.equal(d.weeks,6);assert.equal(d.rows.length,75);assert.equal(d.warnings.length,0);
 assert.equal(d.rows.filter(r=>r.week>=5).length,0);assert.equal(d.rows.filter(r=>r.week===0&&r.day==='?').length,3);
 assert.deepEqual(d.rows.filter(r=>r.day==='A'&&r.name==='Panca Piana').map(r=>[r.week,r.sets,r.reps,r.percentage]),[[1,5,'3','70'],[2,6,'3','70'],[3,7,'3','70'],[4,8,'3','70']]);
 assert.equal(d.rows.find(r=>r.day==='B'&&r.name==='Panca piana'&&r.week===1).percentage,'57.5');
 assert.equal(d.rows.find(r=>r.name==='hollow hold').reps,'40 secondi');assert.doesNotThrow(()=>validateDraft(d));
});
test('i dati provengono dal documento e non da un modello precompilato',()=>{
 const changed=words.map(w=>w.text==='5sx3'?{...w,text:'9sx2'}:w.text==='Panca Piana'?{...w,text:'Panca variante'}:w);
 const d=parsePdfPlan(changed,'Altro');assert.equal(d.rows.find(r=>r.name==='Panca variante'&&r.week===1).sets,9);
 assert.equal(d.rows.find(r=>r.name==='Panca variante'&&r.week===1).reps,'2');
});
test('scansione vuota: nessun esercizio inventato',()=>{const d=parsePdfPlan([],'Scan');assert.equal(d.rows.length,0);assert.ok(d.warnings.length);});
test('validazione rifiuta duplicati, campi errati e assegnazioni implicite',()=>{
 const d=parsePdfPlan(words,'Test');assert.throws(()=>validateDraft({...d,rows:[d.rows[0],d.rows[0]]}));assert.throws(()=>validateDraft({...d,rows:[{...d.rows[0],day:'A'}]}));assert.throws(()=>validateDraft({...d,rows:[{...d.rows[0],percentage:'101'}]}));
});
test('calcolo decimale esatto senza arrotondamenti',()=>{
 assert.equal(exactPercentage('117,5','62,5'),'73.4375');assert.equal(exactPercentage('0.0001','1'),'0.000001');assert.equal(exactPercentage('100','70'),'70');assert.equal(exactPercentage('0','70'),'0');assert.throws(()=>exactPercentage('-1','70'));
});
