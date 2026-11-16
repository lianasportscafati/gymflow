import { decimal, exactPercentage } from "./decimal";
export function parseWeight(value: string) {
  try { decimal(value);return Number(value.trim().replace(",",".").replace(/\s*kg$/i,"")); } catch { return null; }
}
export function calculateWeight(baseWeight: string, percentage: number | null) {
  if(percentage===null||!Number.isFinite(percentage)||percentage<=0||percentage>100)return "";
  try { return exactPercentage(baseWeight,String(percentage)).replace(".",",")+" kg"; } catch { return ""; }
}
