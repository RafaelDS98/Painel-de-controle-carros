// Filtro cruzado dos gráficos (estilo Power BI): estado único, puro e testável.
import { DASH, dash, foldKey, serviceCategory, weekdayIndex } from "./agenda-safety";
import { normalizeTime } from "./normalize";

export type ChartDim = "weekday" | "hour" | "workshop" | "contact" | "service" | "model";
export type ChartSelection = Partial<Record<ChartDim, string[]>>;
export type ChartRow = { date: unknown; time: unknown; workshop: unknown; contact: unknown; issue: unknown; model: unknown };

export const chartDimLabels: Record<ChartDim, string> = { weekday: "Dia", hour: "Horário", workshop: "Oficina", contact: "Contato", service: "Serviço", model: "Modelo" };
export const weekdayShort = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Valor do item na dimensão do gráfico; null = fica fora (ex.: sem data no gráfico de dia). */
export function chartKey(dim: ChartDim, row: ChartRow): string | null {
  if (dim === "weekday") { const i = weekdayIndex(row.date); return i >= 0 ? weekdayShort[i] ?? null : null; }
  if (dim === "hour") return dash(normalizeTime(row.time));
  if (dim === "service") return serviceCategory(row.issue);
  return dash(row[dim]);
}

const same = (a: string, b: string) => (a === DASH || b === DASH ? a === b : foldKey(a) === foldKey(b));

/** Clique: seleciona; mesmo item de novo desmarca; outro item troca. Com additive (Ctrl/Cmd) soma/retira. */
export function toggleSelection(sel: ChartSelection, dim: ChartDim, value: string, additive = false): ChartSelection {
  const current = sel[dim] ?? [];
  const has = current.some((v) => same(v, value));
  let next: string[];
  if (additive) next = has ? current.filter((v) => !same(v, value)) : [...current, value];
  else next = has && current.length === 1 ? [] : [value];
  const out = { ...sel };
  if (next.length) out[dim] = next; else delete out[dim];
  return out;
}

export function removeSelection(sel: ChartSelection, dim: ChartDim, value?: string): ChartSelection {
  const out = { ...sel };
  const rest = value === undefined ? [] : (sel[dim] ?? []).filter((v) => !same(v, value));
  if (rest.length) out[dim] = rest; else delete out[dim];
  return out;
}

export function isSelected(sel: ChartSelection, dim: ChartDim, value: string): boolean {
  return (sel[dim] ?? []).some((v) => same(v, value));
}

export function hasSelection(sel: ChartSelection, dim?: ChartDim): boolean {
  return dim ? Boolean(sel[dim]?.length) : Object.values(sel).some((v) => v?.length);
}

/** Entre gráficos = E; dentro do mesmo gráfico = OU. `except` deixa o próprio gráfico sem se filtrar. */
export function applySelection<T extends ChartRow>(rows: T[], sel: ChartSelection, except?: ChartDim): T[] {
  const dims = (Object.keys(sel) as ChartDim[]).filter((d) => d !== except && sel[d]?.length);
  if (!dims.length) return rows;
  return rows.filter((row) => dims.every((d) => { const k = chartKey(d, row); return k !== null && (sel[d] ?? []).some((v) => same(v, k)); }));
}

export function selectionChips(sel: ChartSelection) {
  return (Object.keys(sel) as ChartDim[]).flatMap((dim) => (sel[dim] ?? []).map((value) => ({ dim, value, label: `${chartDimLabels[dim]}: ${value}` })));
}
