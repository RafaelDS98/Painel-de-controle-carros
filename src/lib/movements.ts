// Movimentações por veículo: regras puras (rótulos, linha do tempo de situações, resumo e exportação).
import { formatDateBR, formatDateTimeBR, guardFormula, safeText } from "./agenda-safety";
import { normalizePlate } from "./normalize";

export type MovementEvent = { field: string; old: string | null; new: string | null; at: string; by: string | null };
export type Pass = {
  id: string; plate: string; date: string | null; time: string; created_at: string; store: string; workshop: string; mechanic: string | null;
  operator: string; issue: string; service: string; schedule_type: string | null; external_order: string; os_number: number | null; km: number | null;
  original_deadline: string | null; current_deadline: string | null; urgent: boolean; rework_of: string | null; rework_reason: string | null;
  note: string; status: string; brand: string; model: string; sector: string | null; archived: boolean;
  rework_original: { id: string; date: string | null; time: string } | null; events: MovementEvent[];
};
export type Vehicle = { plate_key: string; passes: Pass[] };
export type MovementResult = { total_vehicles: number; total_passes: number; vehicles: Vehicle[] };

export type MovementFilters = {
  plate: string; from: string; to: string; status: string; store: string; workshop: string; mechanic: string; service: string; sector: string;
  urgent: "" | "sim" | "nao"; rework: "" | "sim" | "nao"; includeArchived: boolean;
};
export const emptyMovementFilters = (): MovementFilters => ({ plate: "", from: "", to: "", status: "", store: "", workshop: "", mechanic: "", service: "", sector: "", urgent: "", rework: "", includeArchived: false });

/** Há ao menos um critério? (sem critério a aba não consulta o banco). */
export function hasCriteria(f: MovementFilters): boolean {
  return Boolean(normalizePlate(f.plate) || f.from || f.to || f.status || f.store || f.workshop || f.mechanic || f.service || f.sector || f.urgent || f.rework);
}

/** Parâmetros da RPC search_vehicle_movements. */
export function rpcArgs(f: MovementFilters, page: number, pageSize = 20) {
  const n = (v: string) => (v.trim() ? v.trim() : undefined);
  const yn = (v: "" | "sim" | "nao") => (v === "sim" ? true : v === "nao" ? false : undefined);
  return {
    _plate: n(normalizePlate(f.plate)), _from: n(f.from), _to: n(f.to), _status: n(f.status), _store: n(f.store), _workshop: n(f.workshop),
    _mechanic: n(f.mechanic), _service: n(f.service), _sector: n(f.sector), _urgent: yn(f.urgent), _rework: yn(f.rework),
    _include_archived: f.includeArchived, _page: Math.max(1, Math.floor(page) || 1), _page_size: pageSize,
  };
}

/** Lê o JSON da RPC sem nunca quebrar com valores vazios/estranhos. */
export function parseResult(raw: unknown): MovementResult {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const vehicles = Array.isArray(r["vehicles"]) ? (r["vehicles"] as Record<string, unknown>[]) : [];
  return {
    total_vehicles: Number(r["total_vehicles"]) || 0, total_passes: Number(r["total_passes"]) || 0,
    vehicles: vehicles.map((v) => ({
      plate_key: safeText(v?.["plate_key"]),
      passes: (Array.isArray(v?.["passes"]) ? (v["passes"] as Record<string, unknown>[]) : []).map((p) => ({
        ...(p as unknown as Pass),
        plate: safeText(p["plate"]), time: safeText(p["time"]), store: safeText(p["store"]), workshop: safeText(p["workshop"]), operator: safeText(p["operator"]),
        issue: safeText(p["issue"]), service: safeText(p["service"]), external_order: safeText(p["external_order"]), note: safeText(p["note"]),
        status: safeText(p["status"]), brand: safeText(p["brand"]), model: safeText(p["model"]), mechanic: safeText(p["mechanic"]) || null,
        urgent: p["urgent"] === true, archived: p["archived"] === true,
        events: Array.isArray(p["events"]) ? (p["events"] as MovementEvent[]).filter((e) => e && typeof e.field === "string" && typeof e.at === "string") : [],
      })),
    })),
  };
}

const LABELS: Record<string, string> = {
  status: "Situação", date: "Data do atendimento", time: "Hora", plate: "Placa", store: "Loja", model: "Modelo", contact: "Contato", workshop: "Local/Oficina",
  issue: "Problema relatado", note: "Observação", operator: "Operador", external_order: "O.S externa", original_deadline: "Previsão original",
  current_deadline: "Previsão de entrega", priority_urgent: "Urgente", rework_of: "Retrabalho de", rework_reason: "Motivo do retrabalho",
  brand: "Marca", contact_number: "Telefone do contato", schedule_type: "Tipo (E/N)", os_number: "O.S fornecedor", km_scheduled: "KM",
  mecanico_responsavel: "Mecânico responsável", forwarded_workshop: "Encaminhado para",
};
const HIDDEN = new Set(["sgloc_reference", "store_id", "operator_id", "supplier_id", "client_id", "sgloc_performed", "sgloc_confirmed"]);

/** Rótulo amigável do campo do histórico; null = campo técnico (escondido). */
export function fieldLabel(field: string): string | null {
  if (!field || HIDDEN.has(field) || field.startsWith("sgloc_")) return null;
  return LABELS[field] ?? (/^[a-z0-9_]+$/.test(field) ? field.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : field);
}
export const actorLabel = (by: string | null) => by || "Sistema (SGLOC/importação)";

export function eventValue(field: string, value: string | null): string {
  const v = safeText(value);
  if (!v) return "vazio";
  if (field === "priority_urgent") return v === "true" ? "sim" : "não";
  if (/deadline|^date$/.test(field)) return formatDateBR(v);
  return v;
}

export type StatusSpan = { status: string; from: string; to: string | null; ms: number };

/** Tempo em cada situação: começa na entrada (created_at) e corta em cada mudança de status. */
export function statusSpans(pass: Pick<Pass, "created_at" | "status" | "events">, now = Date.now()): StatusSpan[] {
  const changes = pass.events.filter((e) => e.field === "status" && !Number.isNaN(Date.parse(e.at))).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const start = Date.parse(pass.created_at);
  if (Number.isNaN(start)) return [];
  const spans: StatusSpan[] = [];
  let status = changes.length ? safeText(changes[0]!.old) : safeText(pass.status);
  let from = pass.created_at;
  for (const c of changes) {
    spans.push({ status, from, to: c.at, ms: Math.max(0, Date.parse(c.at) - Date.parse(from)) });
    status = safeText(c.new); from = c.at;
  }
  spans.push({ status, from, to: null, ms: Math.max(0, now - Date.parse(from)) });
  return spans;
}

/** Tempo da entrada até a primeira vez em que ficou na situação de conclusão; null se nunca concluiu. */
export function timeToCompletion(pass: Pick<Pass, "created_at" | "events">, completion: string): number | null {
  if (!completion) return null;
  const done = pass.events.filter((e) => e.field === "status" && safeText(e.new) === completion).map((e) => Date.parse(e.at)).filter(Number.isFinite).sort((a, b) => a - b)[0];
  const start = Date.parse(pass.created_at);
  return done === undefined || Number.isNaN(start) ? null : Math.max(0, done - start);
}
export function completedAt(pass: Pick<Pass, "events">, completion: string): string | null {
  return pass.events.filter((e) => e.field === "status" && completion && safeText(e.new) === completion).map((e) => e.at).sort().at(-1) ?? null;
}

export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "—";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), d = Math.floor(h / 24);
  return d ? `${d} d ${h % 24} h` : `${h} h ${min % 60} min`;
}

/** Resumo do cabeçalho da carta do veículo (passes já em ordem da mais recente). */
export function vehicleSummary(v: Vehicle) {
  const passes = v.passes;
  const dates = passes.map((p) => p.date).filter((d): d is string => Boolean(d)).sort();
  const last = passes[0];
  const services = [...new Set(passes.map((p) => p.service).filter(Boolean))];
  return {
    plate: last?.plate || v.plate_key || "Não informado",
    vehicle: [last?.brand, last?.model].filter(Boolean).join(" / ") || "—",
    count: passes.length, first: dates[0] ?? null, last: dates.at(-1) ?? null,
    currentStatus: last?.status || "Não atualizada", services,
  };
}

/** Atrasou? Previsão atual depois da original, ou concluído depois da previsão. */
export function deadlineSlipped(p: Pick<Pass, "original_deadline" | "current_deadline">): boolean {
  return Boolean(p.original_deadline && p.current_deadline && p.current_deadline > p.original_deadline);
}

export const passHeaders = ["Placa", "Data", "Hora", "Loja", "Local/Oficina", "Mecânico", "Serviço", "Problema relatado", "Situação final", "Entrada", "Finalização", "Previsão original", "Previsão atual", "O.S externa", "O.S fornecedor", "KM", "Urgente", "Retrabalho"];
export const eventHeaders = ["Placa", "Data do atendimento", "Quando", "Campo", "De", "Para", "Quem"];

export function passRows(vehicles: Vehicle[], completion: string): Record<string, string>[] {
  const t = (v: unknown) => guardFormula(safeText(v));
  return vehicles.flatMap((v) => v.passes.map((p) => ({
    Placa: t(p.plate), Data: p.date ?? "", Hora: t(p.time), Loja: t(p.store), "Local/Oficina": t(p.workshop), Mecânico: t(p.mechanic), Serviço: t(p.service),
    "Problema relatado": t(p.issue), "Situação final": t(p.status) || "Não atualizada", Entrada: formatDateTimeBR(p.created_at),
    Finalização: completedAt(p, completion) ? formatDateTimeBR(completedAt(p, completion)) : "", "Previsão original": p.original_deadline ?? "",
    "Previsão atual": p.current_deadline ?? "", "O.S externa": t(p.external_order), "O.S fornecedor": t(p.os_number), KM: t(p.km),
    Urgente: p.urgent ? "Sim" : "Não", Retrabalho: p.rework_of ? "Sim" : "Não",
  })));
}
export function eventRows(vehicles: Vehicle[]): Record<string, string>[] {
  const t = (v: unknown) => guardFormula(safeText(v));
  return vehicles.flatMap((v) => v.passes.flatMap((p) => p.events.flatMap((e) => {
    const label = fieldLabel(e.field);
    return label ? [{ Placa: t(p.plate), "Data do atendimento": p.date ?? "", Quando: formatDateTimeBR(e.at), Campo: t(label), De: t(eventValue(e.field, e.old)), Para: t(eventValue(e.field, e.new)), Quem: t(actorLabel(e.by)) }] : [];
  })));
}
