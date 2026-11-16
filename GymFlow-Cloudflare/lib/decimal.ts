export function decimal(value: string) {
  const s=value.trim().replace(",",".").replace(/\s*kg$/i,"");
  if(!/^\d+(?:\.\d+)?$/.test(s)||s.length>100)throw new Error("Valore decimale non valido");
  const parts=s.split(".");return {integer:BigInt(parts.join("")),scale:parts[1]?.length??0};
}
export function exactPercentage(base: string, percentage: string) {
  const a=decimal(base),b=decimal(percentage),scale=a.scale+b.scale+2;
  const digits=(a.integer*b.integer).toString().padStart(scale+1,"0");
  return (digits.slice(0,-scale)+"."+digits.slice(-scale)).replace(/0+$/,"").replace(/\.$/,"").replace(/^0+(?=\d)/,"");
}
