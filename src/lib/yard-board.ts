import { periodRange, saoPauloDate, type PeriodPreset } from "@/lib/agenda-period";
import type { YardAppointment } from "@/lib/yard-utils";

/** Onde a situação aparece: Principal (em execução), Pronto, só na aba Pátio ou oculta. */
export type YardColumn = "main" | "ready" | "yard" | "hidden";
export type BoardColumnKey = "arriving" | "working" | "ready";
export type CardField =
  "model" | "store" | "contact" | "issue" | "note" | "operator" | "deadline" | "workshop";

export interface BoardConfig {
  columns: Record<BoardColumnKey, { label: string; visible: boolean }>;
  cardFields: CardField[];
}

export const CARD_FIELD_LABELS: Record<CardField, string> = {
  model: "Modelo",
  store: "Loja",
  contact: "Contato",
  issue: "Problema relatado",
  note: "Observação",
  operator: "Mecânico",
  deadline: "Previsão de entrega",
  workshop: "Local/Oficina",
};

export const DEFAULT_BOARD_CONFIG: BoardConfig = {
  columns: {
    arriving: { label: "Chegando", visible: true },
    working: { label: "Em execução / análise", visible: true },
    ready: { label: "Prontos / aguardando retirada", visible: true },
  },
  cardFields: ["model", "issue", "operator", "deadline"],
};

export function parseBoardConfig(value: unknown): BoardConfig {
  const v = (value && typeof value === "object" ? value : {}) as Partial<BoardConfig>;
  const columns = { ...DEFAULT_BOARD_CONFIG.columns };
  for (const key of Object.keys(columns) as BoardColumnKey[]) {
    const c = v.columns?.[key];
    if (c && typeof c === "object")
      columns[key] = {
        label: String(c.label ?? "").trim() || columns[key].label,
        visible: c.visible !== false,
      };
  }
  const cardFields = Array.isArray(v.cardFields)
    ? v.cardFields.filter((f): f is CardField => f in CARD_FIELD_LABELS)
    : DEFAULT_BOARD_CONFIG.cardFields;
  return { columns, cardFields };
}

/** Momento de referência do carro no local: encaminhamento, entrada, última situação ou cadastro. */
export function referenceTime(a: YardAppointment): string {
  return a.forwardedAt || a.checkInAt || a.lastStatusChangeAt || a.registeredAt || "";
}

const ms = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

export type YardSort = "newest" | "oldest" | "plate";

export function sortYard(items: YardAppointment[], sort: YardSort, urgentFirst = false) {
  return [...items].sort((a, b) => {
    if (urgentFirst && a.priorityUrgent !== b.priorityUrgent) return a.priorityUrgent ? -1 : 1;
    if (sort === "plate") return a.plate.localeCompare(b.plate);
    const d = ms(referenceTime(a)) - ms(referenceTime(b));
    return sort === "oldest" ? d : -d;
  });
}

/** Separa os carros do pátio próprio nas colunas da tela principal. */
export function buildBoard(
  items: YardAppointment[],
  columnOf: (status: string) => YardColumn,
): Record<BoardColumnKey, YardAppointment[]> {
  const board: Record<BoardColumnKey, YardAppointment[]> = {
    arriving: [],
    working: [],
    ready: [],
  };
  for (const item of items) {
    const col = columnOf(item.status);
    if (col === "hidden") continue;
    if (item.forwardedAt && !item.checkInAt) board.arriving.push(item);
    else if (col === "main") board.working.push(item);
    else if (col === "ready") board.ready.push(item);
  }
  return board;
}

export function inPeriod(
  a: YardAppointment,
  preset: PeriodPreset | "all",
  custom: { start: string; end: string },
  now = new Date(),
) {
  if (preset === "all") return true;
  const ref = referenceTime(a);
  if (!ref) return false;
  const day = ref.length === 10 ? ref : saoPauloDate(new Date(ref));
  const range = preset === "custom" ? custom : periodRange(preset, saoPauloDate(now));
  return (!range.start || day >= range.start) && (!range.end || day <= range.end);
}
