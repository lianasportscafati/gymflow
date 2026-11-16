import type { PdfWord } from "./pdf-plan";
type PdfTextItem={str:string;width:number;transform:number[]};
type PdfPage={getTextContent():Promise<{items:unknown[]}>;getViewport(options:{scale:number}):{width:number;height:number};render(options:object):{promise:Promise<void>}};
export type PdfDocument={numPages:number;getPage(page:number):Promise<PdfPage>;destroy():Promise<void>};
type PdfLibrary={GlobalWorkerOptions:{workerSrc:string};getDocument(options:object):{promise:Promise<PdfDocument>}};
export async function openPdf(file:File){
 if(file.size>20_000_000)throw new Error("Il PDF deve essere inferiore a 20 MB");
 const url="/pdf-5.4.624/pdf.mjs";const lib=await import(/* @vite-ignore */ url) as PdfLibrary;
 lib.GlobalWorkerOptions.workerSrc="/pdf-5.4.624/pdf.worker.mjs";
 const doc=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,stopAtErrors:true}).promise;
 if(doc.numPages>30){await doc.destroy();throw new Error("Massimo 30 pagine per importazione");}
 const words:PdfWord[]=[];
 try{for(let page=1;page<=doc.numPages;page++){
  const p=await doc.getPage(page),content=await p.getTextContent();
  for(const raw of content.items){if(!raw||typeof raw!=="object"||!("str" in raw))continue;
   const item=raw as PdfTextItem;words.push({text:item.str,x:item.transform[4],y:-item.transform[5],width:item.width,page});
  }
 }return {doc,words};}catch(e){await doc.destroy();throw e;}
}
