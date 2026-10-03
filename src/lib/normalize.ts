// Funções puras de normalização para dados digitados ou importados (planilha e SGLOC).

export function safeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  return String(value).trim();
}

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function stripHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") return safeText(value);
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
      const lower = code.toLowerCase();
      if (lower.startsWith("#x")) return String.fromCodePoint(parseInt(lower.slice(2), 16) || 32);
      if (lower.startsWith("#")) return String.fromCodePoint(parseInt(lower.slice(1), 10) || 32);
      return entities[lower] ?? match;
    })
    .replace(/\r\n?/g, "\n")
    .split("\n").map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizePlate(value: unknown): string {
  return safeText(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function validIso(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function normalizeDate(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : validIso(value.getFullYear(), value.getMonth() + 1, value.getDate());
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 1 || value > 2958465) return null;
    const date = new Date(Math.round((Math.floor(value) - 25569) * 86400000));
    return validIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  const raw = stripHtml(value);
  let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (match) return validIso(Number(match[1]), Number(match[2]), Number(match[3]));
  match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s.*)?$/);
  if (match) return validIso(Number(match[3]), Number(match[2]), Number(match[1]));
  return null;
}

function hhmm(hours: number, minutes: number): string {
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60 ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}` : "";
}

export function normalizeTime(value: unknown): string {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : hhmm(value.getHours(), value.getMinutes());
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return "";
    const total = Math.round((value % 1) * 1440) % 1440;
    return hhmm(Math.floor(total / 60), total % 60);
  }
  const match = stripHtml(value).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  return match ? hhmm(Number(match[1]), Number(match[2])) : "";
}

/** Inteiro >= 0 opcional. "" -> null; inválido -> undefined. */
export function parseKm(value: unknown): number | null | undefined {
  const raw = safeText(value);
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return undefined;
  const number = Number(raw);
  return Number.isSafeInteger(number) && number <= 2147483647 ? number : undefined;
}

export const phonePattern = /^[\d\s()+-]*$/;

export function isEmergency(scheduleType: unknown): boolean {
  const text = stripHtml(scheduleType);
  return text === "E" || /emerg/i.test(text);
}

export const sglocStateLabels: Record<string, string> = {
  local_only: "Local", synced: "Sincronizado", pending_push: "Aguardando envio ao SGLOC",
  push_failed: "Falha no envio", not_returned: "Não retornado pelo SGLOC",
};

export function authorLabel(changedBy: string | null | undefined, fullName: string | null | undefined): string {
  if (!changedBy) return "Sincronização SGLOC";
  return fullName?.trim() || "Usuário sem nome";
}

// ---------- Importação de planilha ----------

/** Linha deve ser importada? Ignora linhas vazias, sem placa e a linha de total do SGLOC ("127 registro(s)"). */
export function importRowSkipReason(row: Record<string, unknown>): "vazia" | "sem placa" | null {
  if (!Object.values(row).some((value) => stripHtml(value) !== "")) return "vazia";
  if (/registro\(s\)|registros?$/i.test(stripHtml(row["ID"]))) return "vazia";
  if (!normalizePlate(stripHtml(row["Placa"]))) return "sem placa";
  return null;
}

/** Colunas extras do export do SGLOC. */
export function sglocExtras(row: Record<string, unknown>) {
  const os = stripHtml(row["OS FORNEC"]);
  const id = stripHtml(row["ID"]);
  return {
    os_number: /^\d+$/.test(os) && Number(os) <= 2147483647 ? Number(os) : null,
    schedule_type: /emerg/i.test(stripHtml(row["Tipo"])) ? "E" : "N",
    sgloc_reference: /^\d+$/.test(id) ? id : null,
  };
}
