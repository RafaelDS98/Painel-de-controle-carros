// Regras puras do módulo de Ordens de Serviço (sem acesso ao banco).
export type OsRow = {
  id: string;
  numero: number;
  plate: string;
  opened_at: string;
  status_id: number;
  status_label?: string | null;
  status_color?: string | null;
  tipo_label?: string | null;
  workshop_name?: string | null;
  store_code?: string | null;
  centro_custo_name?: string | null;
  total_os?: number | null;
  km?: number | null;
  tipo_atendimento?: string | null;
  pendencia?: boolean | null;
  closed_at?: string | null;
  previsao_conclusao?: string | null;
  externa_ref?: string | null;
  condutor_nome?: string | null;
  obs1?: string | null;
  [k: string]: unknown;
};
export type OsItem = {
  id: string;
  description: string;
  qty: number;
  unit_price: number;
  total: number | null;
  item_type: string;
  approval: string | null;
  mechanic_name: string | null;
  service_code: string | null;
  part_code: string | null;
};

export const TIPO_ATENDIMENTO: Record<string, string> = {
  N: "Normal",
  E: "Emergencial",
  P: "Programado",
  D: "Devolução",
};

/** Lê o retorno de search_ordens_servico sem quebrar com dado ausente. */
export function parseSearch(value: unknown): { rows: OsRow[]; total: number } {
  const v = (value ?? {}) as { rows?: unknown; total?: unknown };
  return { rows: Array.isArray(v.rows) ? (v.rows as OsRow[]) : [], total: Number(v.total) || 0 };
}

export function money(value: unknown): string {
  const n = Number(value);
  return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function itemTotal(qty: unknown, price: unknown): number {
  const q = Number(qty),
    p = Number(price);
  return Number.isFinite(q) && Number.isFinite(p) ? Math.round(q * p * 100) / 100 : 0;
}

/** Filtros da lista: só envia o que foi preenchido. */
export function buildFilters(f: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(f)
      .map(([k, v]) => [k, v.trim()])
      .filter(([, v]) => v),
  );
}

export function osDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export const PAGAMENTO_STATUS = ["Em aberto", "Pago", "Cortesia"] as const;
export const NAO_FINALIZADAS = "nao_finalizadas";

/** Converte o formulário da consulta de O.S. no filtro do banco: vazio sai, "Não finalizadas" vira flag, Sim/Não vira booleano. */
export function osConsultaFilters(draft: Record<string, string>): Record<string, string> {
  const out = buildFilters(draft);
  if (out["status_id"] === NAO_FINALIZADAS) {
    delete out["status_id"];
    out["nao_finalizadas"] = "1";
  }
  for (const k of ["recuperado", "com_pendencia"])
    if (k in out) out[k] = out[k] === "Sim" ? "true" : "false";
  return out;
}

export const OS_STATUS = { EM_ANDAMENTO: 1, CANCELADA: 3, FINALIZADA: 7, AGUARDANDO_RETIRADA: 8 } as const;

/** Finalizada e Cancelada são "encerradas" e ficam fora das telas de trabalho. */
export function isClosedStatus(statusId: unknown): boolean {
  return Number(statusId) === OS_STATUS.CANCELADA || Number(statusId) === OS_STATUS.FINALIZADA;
}

/** Espelho do banco: qualquer perfil finaliza; só Master/Gerente cancelam. */
export function canCancelOs(role: string | null | undefined): boolean {
  return role === "master" || role === "gerente";
}

/** Situações oferecidas na troca manual: encerrar só pelos botões próprios. */
export function manualStatusOptions<T extends { id: number | string }>(status: T[]): T[] {
  return status.filter((s) => !isClosedStatus(s.id));
}

export function todaySaoPaulo(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function nowTimeSaoPaulo(now = new Date()): string {
  return now.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
