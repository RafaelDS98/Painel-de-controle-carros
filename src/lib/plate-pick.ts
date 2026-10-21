import { normalizePlate } from "@/lib/normalize";

export interface PlateOption {
  plate: string;
  status: string | null;
  prefixo: string | null;
  ano: number | null;
  modelo: string | null;
}

/** Só aceita placa existente no cadastro: devolve a opção cuja placa normalizada bate, ou null. */
export function pickRegisteredPlate(typed: string, options: PlateOption[]): PlateOption | null {
  const t = normalizePlate(typed);
  if (!t) return null;
  return options.find((o) => normalizePlate(o.plate) === t) ?? null;
}

/** Termo de busca: só letras/números em maiúsculas; exige ao menos 2 caracteres. */
export function plateSearchTerm(typed: string): string | null {
  const t = typed.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return t.length >= 2 ? t : null;
}

export function plateOptionSummary(o: PlateOption): string {
  return [`Prefixo: ${o.prefixo || "—"}`, `Ano: ${o.ano ?? "—"}`, `Mod.: ${o.modelo || "—"}`].join(
    " | ",
  );
}

/** Liga/desliga ids numa seleção, sem duplicar. */
export function toggleId(ids: string[], id: string, on: boolean): string[] {
  return on ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter((x) => x !== id);
}
