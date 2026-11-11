export const nameKey = (name: string) => name.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g," ").trim();
export function cleanImportedName(event: string) {
  const name = event.trim().replace(/^(?:unha|manuten[çc][ãa]o|remo[çc][ãa]o|cut[ií]cula)\s+/iu, "")
    .replace(/^casamento\s+/iu, "").replace(/^\(dedo\)\s*/iu, "")
    .replace(/\s+paga\b/giu, "").replace(/\s*\(presente\)/giu, "")
    .replace(/\s*\(-\s*\d+(?:[.,]\d+)?\s*reais?\)/giu, "")
    .replace(/\s+(?:remo[çc][ãa]o|cliente)\s*$/iu, "").replace(/\s+/g," ").trim();
  if (!name || name.length > 100) throw new Error("Nome de cliente inválido na planilha.");
  return name[0].toLocaleUpperCase("pt-BR") + name.slice(1);
}
export function importedProcedure(amount: number | null) {
  if (amount === null) return { base:"undefined", extra:0 } as const;
  if (amount < 12000) return { base:"cuticle", extra:0 } as const;
  if (amount < 14000) return { base:"alignment", extra:amount-12000 } as const;
  return { base:"extension", extra:amount-14000 } as const;
}
export function importedDate(value: unknown) {
  const date=value instanceof Date ? value : typeof value === "number" ? new Date(Math.round((value-25569)*86400000)) : null;
  if (!date || Number.isNaN(date.getTime())) throw new Error("Data inválida na planilha.");
  return date.toISOString().slice(0,10);
}
export function importedTime(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return `${String(value.getUTCHours()).padStart(2,"0")}:${String(value.getUTCMinutes()).padStart(2,"0")}`;
  if (typeof value === "number" && value >= 0 && value < 1) { const mins=Math.round(value*1440); if(mins>=1440)throw new Error("Horário inválido na planilha.");return `${String(Math.floor(mins/60)).padStart(2,"0")}:${String(mins%60).padStart(2,"0")}`; }
  if (typeof value === "string" && /^([01]?\d|2[0-3]):[0-5]\d(?::00)?$/.test(value.trim())) return value.trim().split(":").slice(0,2).map(v=>v.padStart(2,"0")).join(":");
  throw new Error("Horário inválido na planilha.");
}
export function importedAmount(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1_000_000) throw new Error("Valor inválido na planilha.");
  return Math.round(value*100);
}
