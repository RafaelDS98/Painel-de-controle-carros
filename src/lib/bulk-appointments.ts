import type { TablesUpdate } from "@/integrations/supabase/types";

export const batchIdHeader = "ID do sistema (não editar nem apagar)";

export const batchColumns = [
  ["date", "Data Atendimento"], ["time", "Hora"], ["plate", "Placa"],
  ["status", "Situação"], ["model", "Modelo"], ["contact", "Contato"],
  ["workshop", "Local/Oficina"], ["issue", "Problemas Relatado"],
  ["note", "Observação"], ["operator", "Operador"],
  ["external_order", "O.S Externa"], ["current_deadline", "Previsão de Entrega"],
] as const;

export type BatchColumn = (typeof batchColumns)[number][0];
export type BatchRecord = Record<BatchColumn, string | null>;

function excelDate(value: unknown): string {
  if (value instanceof Date) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  if (typeof value === "number") return new Date(Math.round((value - 25569) * 86400000)).toISOString().slice(0, 10);
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  return match?.[1] && match[2] && match[3] ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : raw;
}

function excelTime(value: unknown): string {
  if (value instanceof Date) return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  if (typeof value === "number") {
    const minutes = Math.round(value * 1440);
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::00)?$/);
  return match?.[1] && match[2] ? `${match[1].padStart(2, "0")}:${match[2]}` : raw;
}

export function batchValue(column: BatchColumn, value: unknown): string | null {
  if (column === "date" || column === "current_deadline") {
    const date = excelDate(value);
    return column === "current_deadline" && !date ? null : date;
  }
  if (column === "time") return excelTime(value);
  if (column === "status") {
    const status = String(value ?? "").trim();
    return status === "Não atualizada" ? "" : status;
  }
  return String(value ?? "");
}

export function batchChanges(row: Record<string, unknown>, current: BatchRecord): TablesUpdate<"appointments"> {
  const changes: TablesUpdate<"appointments"> = {};
  for (const [column, header] of batchColumns) {
    const next = batchValue(column, row[header]);
    const existing = column === "time" ? excelTime(current[column]) : current[column];
    if (next !== existing) Object.assign(changes, { [column]: next });
  }
  return changes;
}

export function batchValidation(changes: TablesUpdate<"appointments">, statuses: string[] = ["Recebido", "Em execução", "Peça", "Finalizado"]): string | null {
  if (changes.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(changes.date ?? "")) return "Data Atendimento inválida.";
  if (changes.current_deadline && !/^\d{4}-\d{2}-\d{2}$/.test(changes.current_deadline)) return "Previsão de Entrega inválida.";
  if (changes.time !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(changes.time ?? "")) return "Hora inválida.";
  if (changes.status !== undefined && !["", ...statuses].includes(changes.status ?? "")) return "Situação inválida.";
  return null;
}