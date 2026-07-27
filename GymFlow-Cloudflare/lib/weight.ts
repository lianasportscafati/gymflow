export function parseWeight(value: string) {
  const normalized = value.trim().replace(",", ".").replace(/[^\d.-]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateWeight(baseWeight: string, percentage: number | null) {
  const base = parseWeight(baseWeight);
  if (base === null || percentage === null || percentage <= 0) return "";
  const result = Math.round(base * percentage) / 100;
  return `${result.toLocaleString("it-IT", { maximumFractionDigits: 2 })} kg`;
}
