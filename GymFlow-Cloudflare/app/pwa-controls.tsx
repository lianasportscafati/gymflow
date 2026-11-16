"use client";
import {useEffect,useState,useSyncExternalStore} from "react";
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
const subscribe=(notify:()=>void)=>{window.addEventListener("online",notify);window.addEventListener("offline",notify);return()=>{window.removeEventListener("online",notify);window.removeEventListener("offline",notify);};};
const subscribeDisplay=(notify:()=>void)=>{const media=window.matchMedia("(display-mode: standalone)");media.addEventListener("change",notify);return()=>media.removeEventListener("change",notify);};
export default function PwaControls(){
 const online=useSyncExternalStore(subscribe,()=>navigator.onLine,()=>true);
 const standalone=useSyncExternalStore(subscribeDisplay,()=>window.matchMedia("(display-mode: standalone)").matches,()=>false);
 const [prompt,setPrompt]=useState<InstallEvent|null>(null),[help,setHelp]=useState(false),[installed,setInstalled]=useState(false);
 useEffect(()=>{
  if("serviceWorker" in navigator)void navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"}).catch(()=>{});
  const install=(e:Event)=>{e.preventDefault();setPrompt(e as InstallEvent);};
  const done=()=>{setInstalled(true);setPrompt(null);};
  window.addEventListener("beforeinstallprompt",install);window.addEventListener("appinstalled",done);
  return()=>{window.removeEventListener("beforeinstallprompt",install);window.removeEventListener("appinstalled",done);};
 },[]);
 return <div className="pwa-toolbar">
  {!online&&<p className="error-banner" role="alert">Sei senza connessione. I dati e i salvataggi richiedono Internet. Riconnettiti prima di modificare la scheda.</p>}
  {!installed&&!standalone&&<button className="secondary-button" onClick={async()=>{if(prompt){await prompt.prompt();const choice=await prompt.userChoice;setPrompt(null);if(choice.outcome==="accepted")setInstalled(true);}else setHelp(!help);}}>Installa GymFlow</button>}
  {help&&!installed&&!standalone&&<p role="status">Android: apri il menu ⋮ di Chrome e scegli “Installa app” o “Aggiungi a schermata Home”. Su iPhone: Condividi → Aggiungi alla schermata Home. Se il comando non compare, riapri il sito nel browser.</p>}
 </div>;
}
