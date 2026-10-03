// Regras puras de "dado vazio nunca quebra a tela": exibição, filtros, ordenação, agrupamento e exportação.
import type { TablesInsert } from "@/integrations/supabase/types";
import { importRowSkipReason, normalizeDate, normalizePlate, normalizeTime, safeText, sglocExtras, stripHtml } from "./normalize";

export const DASH = "—";
export const EMPTY_OPTION = "(sem valor)";
export const NO_DATE_GROUP = "Sem data";

/** Valor para exibição: vazio, nulo, "null", "undefined" ou NaN viram "—". */
export function dash(value: unknown): string {
  if (typeof value === "number" && !Number.isFinite(value)) return DASH;
  const text = safeText(value);
  return text === "" || text === "null" || text === "undefined" || text === "NaN" ? DASH : text;
}

/** Chave para comparar sem diferenciar maiúsculas, acentos e espaços extras. */
export function foldKey(value: unknown): string {
  return safeText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
}

/** Opções únicas de filtro (exibe o primeiro formato visto) e "(sem valor)" quando existir vazio. */
export function foldedOptions(values: unknown[]): string[] {
  const seen = new Map<string, string>();
  let hasEmpty = false;
  for (const value of values) {
    const text = safeText(value);
    if (!text) { hasEmpty = true; continue; }
    const key = foldKey(text);
    if (!seen.has(key)) seen.set(key, text);
  }
  const options = [...seen.values()].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  return hasEmpty ? [...options, EMPTY_OPTION] : options;
}

export function matchesFilter(value: unknown, filter: string): boolean {
  if (!filter) return true;
  if (filter === EMPTY_OPTION) return safeText(value) === "";
  return foldKey(value) === foldKey(filter);
}

/** Sem período: inclui tudo. Com período: registros sem data ficam de fora. */
export function inPeriod(date: unknown, start: string, end: string): boolean {
  if (!start && !end) return true;
  const iso = normalizeDate(date);
  if (!iso) return false;
  return (!start || iso >= start) && (!end || iso <= end);
}

export function timeKey(time: unknown): string {
  return normalizeTime(time);
}

/** Ordena por data e hora; sem data (ou hora inválida) sempre por último, nos dois sentidos. */
export function compareDateTime(a: { date: unknown; time: unknown }, b: { date: unknown; time: unknown }, asc = true): number {
  const da = normalizeDate(a.date);
  const db = normalizeDate(b.date);
  if (!da || !db) return da === db ? 0 : da ? -1 : 1;
  const ta = timeKey(a.time);
  const tb = timeKey(b.time);
  if (da === db && (!ta || !tb)) return ta === tb ? 0 : ta ? -1 : 1;
  return `${da}${ta}`.localeCompare(`${db}${tb}`) * (asc ? 1 : -1);
}

/** Compara textos com vazios por último. */
export function compareText(a: unknown, b: unknown, asc = true): number {
  const ta = safeText(a);
  const tb = safeText(b);
  if (!ta || !tb) return ta === tb ? 0 : ta ? -1 : 1;
  return ta.localeCompare(tb, "pt-BR", { numeric: true, sensitivity: "base" }) * (asc ? 1 : -1);
}

/** Segunda=0 … Sábado=5; domingo ou data inválida = -1. */
export function weekdayIndex(date: unknown): number {
  const iso = normalizeDate(date);
  if (!iso) return -1;
  const day = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return day === 0 ? -1 : day - 1;
}

/** Agrupa a semana em seis dias e um grupo "Sem data". */
export function groupWeek<T extends { date: unknown }>(rows: T[], start: string, end: string) {
  const days: T[][] = [[], [], [], [], [], []];
  const noDate: T[] = [];
  for (const row of rows) {
    const iso = normalizeDate(row.date);
    if (!iso) { noDate.push(row); continue; }
    if (iso < start || iso > end) continue;
    const index = weekdayIndex(iso);
    if (index >= 0) days[index]?.push(row);
  }
  return { days, noDate };
}

export function safeAverage(total: number, divisor: number): number {
  return divisor > 0 && Number.isFinite(total) ? total / divisor : 0;
}

export function serviceCategory(issue: unknown): string {
  const text = safeText(issue).toLocaleUpperCase("pt-BR");
  if (text.includes("FREIO")) return "Freios";
  if (text.includes("SUSPENS")) return "Suspensão";
  if (text.includes("PNEU") || text.includes("ALINH") || text.includes("BALANCE")) return "Pneus";
  if (text.includes("REVIS") || text.includes("MANUTEN")) return "Revisão";
  return "Corretiva";
}

/** Conta agrupando sem diferenciar caixa/acentos; vazio vira "—". */
export function countBy<T>(data: T[], getter: (item: T) => unknown) {
  const counts = new Map<string, { name: string; value: number }>();
  for (const item of data) {
    const label = dash(getter(item));
    const key = label === DASH ? DASH : foldKey(label);
    const entry = counts.get(key);
    if (entry) entry.value++; else counts.set(key, { name: label, value: 1 });
  }
  return [...counts.values()].sort((a, b) => b.value - a.value);
}

export function textMatches(query: string, values: unknown[]): boolean {
  const q = foldKey(query);
  if (!q) return true;
  return values.some((value) => foldKey(value).includes(q));
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export function formatDateBR(value: unknown): string {
  const iso = normalizeDate(value);
  return iso ? dateFormatter.format(new Date(`${iso}T12:00:00Z`)) : DASH;
}

export function formatDateTimeBR(value: unknown): string {
  const date = value instanceof Date ? value : new Date(safeText(value));
  return Number.isNaN(date.getTime()) ? DASH : dateTimeFormatter.format(date);
}

export function clampPage(page: number, total: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
  const current = Math.min(Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1), pages);
  return { pages, current };
}

// ---------- Exportação ----------

/** Protege contra injeção de fórmula em Excel/CSV. */
export function guardFormula(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export function csvEscape(value: unknown, separator = ","): string {
  const text = guardFormula(value);
  return /["\n\r,;]/.test(text) || text.includes(separator) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Record<string, unknown>[], headers: string[], separator = ","): string {
  const lines = [headers.map((header) => csvEscape(header, separator)).join(separator)];
  for (const row of rows) lines.push(headers.map((header) => csvEscape(row[header], separator)).join(separator));
  return lines.join("\r\n");
}

export type ExportSource = {
  id: unknown; date: unknown; time: unknown; plate: unknown; status: unknown; brand?: unknown; model: unknown;
  contact: unknown; contactNumber?: unknown; workshop: unknown; issue: unknown; note: unknown; operator: unknown;
  externalOrder?: unknown; kmScheduled?: unknown; osNumber?: unknown; sglocReference?: unknown;
};

export const exportHeaders = ["ID", "ID SGLOC", "Data Atendimento", "Hora", "Placa", "Situação", "Marca", "Modelo", "Contato", "Telefone do contato", "Local/Oficina", "Problemas Relatado", "Observação", "Operador", "O.S Externa", "O.S Fornecedor", "KM do agendamento"];

/** Linhas de exportação: só campos de negócio (nunca colunas técnicas sgloc_*), nulos viram vazio, texto protegido. */
export function exportRows(items: ExportSource[]): Record<string, string>[] {
  const text = (value: unknown) => guardFormula(safeText(value));
  return items.map((item) => ({
    ID: text(item.id), "ID SGLOC": text(item.sglocReference), "Data Atendimento": normalizeDate(item.date) ?? "", Hora: timeKey(item.time),
    Placa: text(item.plate), Situação: text(item.status) || "Não atualizada", Marca: text(item.brand), Modelo: text(item.model),
    Contato: text(item.contact), "Telefone do contato": text(item.contactNumber), "Local/Oficina": text(item.workshop),
    "Problemas Relatado": text(item.issue), Observação: text(item.note), Operador: text(item.operator),
    "O.S Externa": text(item.externalOrder), "O.S Fornecedor": text(item.osNumber), "KM do agendamento": text(item.kmScheduled),
  }));
}

// ---------- Importação ----------

export function buildImportRecords(rows: Record<string, unknown>[], createdBy: string | null, hasDeadline: boolean) {
  const cell = (row: Record<string, unknown>, column: string) => stripHtml(row[column]);
  let skippedEmpty = 0;
  const records: TablesInsert<"appointments">[] = [];
  for (const row of rows) {
    if (importRowSkipReason(row)) { skippedEmpty++; continue; }
    const deadline = hasDeadline ? normalizeDate(row["Previsão de Entrega"]) : null;
    const extras = sglocExtras(row);
    records.push({
      sheet_id: cell(row, "ID"), registered_at: normalizeDate(row["Data Cadastro"]), date: normalizeDate(row["Data Atendimento"]),
      time: normalizeTime(row["Hora"]), plate: normalizePlate(cell(row, "Placa")), store: cell(row, "Loja"), model: cell(row, "Modelo"),
      contact: cell(row, "Contato"), workshop: cell(row, "Local/Oficina"), issue: cell(row, "Problemas Relatado"),
      note: cell(row, "Observação"), operator: cell(row, "Operador"), external_order: cell(row, "O.S Externa"),
      status: "", created_by: createdBy, original_deadline: deadline, current_deadline: deadline,
      os_number: extras.os_number, schedule_type: extras.schedule_type, sgloc_reference: extras.sgloc_reference,
    });
  }
  return { records, skippedEmpty };
}

/** Remove registros cujo ID do SGLOC já existe (no banco ou repetido no arquivo). */
export function dropExistingReferences<T extends { sgloc_reference?: string | null }>(records: T[], existing: Iterable<string>) {
  const seen = new Set(existing);
  let skippedExisting = 0;
  const kept = records.filter((item) => {
    if (!item.sgloc_reference) return true;
    if (seen.has(item.sgloc_reference)) { skippedExisting++; return false; }
    seen.add(item.sgloc_reference);
    return true;
  });
  return { kept, skippedExisting };
}
