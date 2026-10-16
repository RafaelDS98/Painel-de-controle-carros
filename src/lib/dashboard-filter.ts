// Seleção do Dashboard (estilo Power BI + caixinhas do pop-up): estado puro e testável.
import { foldKey } from "./agenda-safety";

export type DashDim = "day" | "situation" | "vehicle";
export type DashSelection = Partial<Record<DashDim, string[]>>;

export const dashDimLabels: Record<DashDim, string> = {
  day: "Dia",
  situation: "Situação",
  vehicle: "Veículo",
};

const same = (a: string, b: string) => foldKey(a) === foldKey(b);

/** Marca/desmarca um valor numa lista (caixinhas do pop-up). */
export function toggleValue(list: string[], value: string): string[] {
  return list.some((v) => same(v, value)) ? list.filter((v) => !same(v, value)) : [...list, value];
}

/** Grava (ou limpa, com lista vazia) os valores de uma dimensão. */
export function setValues(sel: DashSelection, dim: DashDim, values: string[]): DashSelection {
  const out = { ...sel };
  if (values.length) out[dim] = values;
  else delete out[dim];
  return out;
}

/** Clique no gráfico: seleciona; o mesmo item de novo limpa; Ctrl/Cmd soma ou retira. */
export function toggleSelect(
  sel: DashSelection,
  dim: DashDim,
  value: string,
  additive = false,
): DashSelection {
  const current = sel[dim] ?? [];
  const has = current.some((v) => same(v, value));
  const next = additive ? toggleValue(current, value) : has && current.length === 1 ? [] : [value];
  return setValues(sel, dim, next);
}

/** Tira um valor (ou a dimensão inteira, sem `value`). */
export function removeValue(sel: DashSelection, dim: DashDim, value?: string): DashSelection {
  const rest = value === undefined ? [] : (sel[dim] ?? []).filter((v) => !same(v, value));
  return setValues(sel, dim, rest);
}

export function isSelected(sel: DashSelection, dim: DashDim, value: string): boolean {
  return (sel[dim] ?? []).some((v) => same(v, value));
}

export function hasSelection(sel: DashSelection, dim?: DashDim): boolean {
  return dim ? Boolean(sel[dim]?.length) : Object.values(sel).some((v) => v?.length);
}

export function selectionChips(sel: DashSelection) {
  return (Object.keys(sel) as DashDim[]).flatMap((dim) =>
    (sel[dim] ?? []).map((value) => ({
      dim,
      value,
      label: `${dashDimLabels[dim]}: ${value}`,
    })),
  );
}

/** Estado da caixinha "todos": true = todos marcados, false = nenhum, "partial" = alguns. */
export function checkAllState(list: string[], chosen: string[]): boolean | "partial" {
  const hit = list.filter((v) => chosen.some((c) => same(c, v))).length;
  if (!hit) return false;
  return hit === list.length ? true : "partial";
}

/** Caixinha "todos": marca tudo; se já estava tudo marcado, limpa. */
export function toggleAll(list: string[], chosen: string[]): string[] {
  return checkAllState(list, chosen) === true ? [] : [...list];
}

const strip = (value: unknown) => foldKey(value).replace(/[^a-z0-9]/g, "");

/** Busca do pop-up: aceita parte do texto, ignora acento/caixa e símbolos da placa. */
export function searchRows<T extends object>(rows: T[], query: string, keys: (keyof T)[]): T[] {
  const folded = foldKey(query);
  if (!folded) return rows;
  const clean = strip(query);
  return rows.filter((row) =>
    keys.some(
      (key) => foldKey(row[key]).includes(folded) || (clean && strip(row[key]).includes(clean)),
    ),
  );
}
