// Regras puras do módulo de Ordens de Serviço (sem acesso ao banco).
export type OsRow = {
  id: string; numero: number; plate: string; opened_at: string; status_id: number; status_label?: string | null;
  status_color?: string | null; tipo_label?: string | null; workshop_name?: string | null; store_code?: string | null;
  centro_custo_name?: string | null; total_os?: number | null; km?: number | null; tipo_atendimento?: string | null;
  pendencia?: boolean | null; closed_at?: string | null; [k: string]: unknown;
};
export type OsItem = { id: string; description: string; qty: number; unit_price: number; total: number | null; item_type: string; approval: string | null; mechanic_name: string | null; service_code: string | null; part_code: string | null };

export const TIPO_ATENDIMENTO: Record<string, string> = { N: "Normal", E: "Emergencial", P: "Programado", D: "Devolução" };

/** Lê o retorno de search_ordens_servico sem quebrar com dado ausente. */
export function parseSearch(value: unknown): { rows: OsRow[]; total: number } {
  const v = (value ?? {}) as { rows?: unknown; total?: unknown };
  return { rows: Array.isArray(v.rows) ? (v.rows as OsRow[]) : [], total: Number(v.total) || 0 };
}

export function money(value: unknown): string {
  const n = Number(value);
  return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function itemTotal(qty: unknown, price: unknown): number {
  const q = Number(qty), p = Number(price);
  return Number.isFinite(q) && Number.isFinite(p) ? Math.round(q * p * 100) / 100 : 0;
}

/** Filtros da lista: só envia o que foi preenchido. */
export function buildFilters(f: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
}

export function osDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
