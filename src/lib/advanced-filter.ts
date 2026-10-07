// Filtro avançado: campos gerados dos campos configuráveis; OU dentro do campo, E entre campos.
import { foldKey, EMPTY_OPTION } from "./agenda-safety";
import { safeText } from "./normalize";

export type AdvancedFilters = Record<string, string[]>;
export type AdvancedField = { key: string; label: string; kind: "choice" | "text" };
type Definition = { field_key: string; label: string; field_type: string; storage: string; visible: boolean };

export const URGENT_KEY = "__urgent";
export const STATUS_KEY = "status";
export const URGENT_YES = "Urgente";
export const URGENT_NO = "Não urgente";

/** Coluna do banco (field_key) → propriedade do agendamento exibido. */
const COLUMN_PROPS: Record<string, string> = {
  store: "store", model: "model", contact: "contact", workshop: "workshop", issue: "issue", note: "note", operator: "operator",
  external_order: "externalOrder", brand: "brand", contact_number: "contactNumber", km_scheduled: "kmScheduled", os_number: "osNumber",
};

/** Campos filtráveis: Situação, Urgência e os campos visíveis do formulário (datas ficam no período). */
export function buildAdvancedFields(definitions: Definition[]): AdvancedField[] {
  const fields: AdvancedField[] = [{ key: STATUS_KEY, label: "Situação", kind: "choice" }, { key: URGENT_KEY, label: "Urgência", kind: "choice" }];
  for (const def of definitions) {
    if (!def.visible || def.field_type === "date") continue;
    const key = def.storage === "custom" ? `custom:${def.field_key}` : COLUMN_PROPS[def.field_key] ? def.field_key : null;
    if (!key || fields.some((field) => field.key === key)) continue;
    fields.push({ key, label: def.label, kind: def.field_type === "textarea" ? "text" : "choice" });
  }
  return fields;
}

type Row = Record<string, unknown> & { customFields?: Record<string, unknown>; priorityUrgent?: boolean };

export function fieldValue(item: Row, key: string): string {
  if (key === URGENT_KEY) return item.priorityUrgent ? URGENT_YES : URGENT_NO;
  if (key.startsWith("custom:")) return safeText(item.customFields?.[key.slice(7)]);
  return safeText(item[COLUMN_PROPS[key] ?? key]);
}

export function matchesAdvanced(item: Row, filters: AdvancedFilters, fields: AdvancedField[]): boolean {
  for (const [key, selected] of Object.entries(filters)) {
    if (!selected.length) continue;
    const field = fields.find((candidate) => candidate.key === key);
    if (!field) continue;
    const value = fieldValue(item, key);
    if (field.kind === "text") {
      const needle = foldKey(selected[0]);
      if (needle && !foldKey(value).includes(needle)) return false;
    } else if (!selected.some((option) => (option === EMPTY_OPTION ? value === "" : foldKey(value) === foldKey(option)))) return false;
  }
  return true;
}

export function activeAdvancedCount(filters: AdvancedFilters): number {
  return Object.values(filters).filter((values) => values.length > 0).length;
}

export function toggleAdvancedValue(filters: AdvancedFilters, key: string, value: string): AdvancedFilters {
  const current = filters[key] ?? [];
  const next = current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
  const { [key]: _removed, ...rest } = filters;
  return next.length ? { ...rest, [key]: next } : rest;
}

export function setAdvancedText(filters: AdvancedFilters, key: string, text: string): AdvancedFilters {
  const { [key]: _removed, ...rest } = filters;
  return text.trim() ? { ...rest, [key]: [text] } : rest;
}

/** Lê filtros salvos (JSON do banco) ignorando lixo e campos que não existem mais. */
export function sanitizeAdvanced(raw: unknown, fields: AdvancedField[]): AdvancedFilters {
  const result: AdvancedFilters = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return result;
  for (const [key, values] of Object.entries(raw as Record<string, unknown>)) {
    if (!fields.some((field) => field.key === key) || !Array.isArray(values)) continue;
    const clean = values.filter((value): value is string => typeof value === "string" && value.length <= 200).slice(0, 100);
    if (clean.length) result[key] = clean;
  }
  return result;
}
