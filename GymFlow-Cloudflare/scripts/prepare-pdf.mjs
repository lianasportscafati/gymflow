import { mkdirSync, copyFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const target=resolve('public/pdf-5.4.624');
if(!existsSync(join(target,'pdf.mjs'))||!existsSync(join(target,'pdf.worker.mjs'))){
 const temp=mkdtempSync(join(tmpdir(),'gymflow-pdf-'));
 try {
  const result=JSON.parse(execFileSync('npm',['pack','pdfjs-dist@5.4.624','--ignore-scripts','--pack-destination',temp,'--json'],{encoding:'utf8'}));
  execFileSync('tar',['-xzf',join(temp,result[0].filename),'-C',temp]);mkdirSync(target,{recursive:true});
  copyFileSync(join(temp,'package/build/pdf.min.mjs'),join(target,'pdf.mjs'));
  copyFileSync(join(temp,'package/build/pdf.worker.min.mjs'),join(target,'pdf.worker.mjs'));
  copyFileSync(join(temp,'package/LICENSE'),join(target,'LICENSE'));
 } finally { rmSync(temp,{recursive:true,force:true}); }
}
