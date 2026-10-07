/** Sincronização SGLOC → painel: funções puras (sem rede, sem banco). */
import { normalizeDate, normalizePlate, normalizeTime, stripHtml } from "@/lib/normalize";
import { maskValue, readItem } from "./core";

export const SYNC_FIELDS = ["date", "time", "plate", "km_scheduled", "contact", "contact_number", "issue", "note", "workshop", "supplier_id",
  "external_order", "store_id", "store", "operator_id", "operator", "brand", "model", "schedule_type", "os_number", "client_id",
  "sgloc_performed", "sgloc_confirmed"] as const;
export type SyncField = (typeof SYNC_FIELDS)[number];
export type Mapped = Partial<Record<SyncField, string | number | null>>;

export type LocalRow = { id: string; sgloc_reference: string | null; plate: string; date: string | null; time: string; archived_at: string | null;
  sgloc_sync_state: string | null; sgloc_missing_count?: number | null } & Partial<Record<SyncField, unknown>>;

const text = (v: unknown, max = 2000) => { const t = stripHtml(v); return t ? t.slice(0, max) : null; };
const int = (v: unknown) => (typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= 2147483647 ? v : null);

/** Converte um item da listagem SGLOC nas colunas de appointments. Sem id/data/placa válidos → motivo de descarte. */
export function mapSglocItem(raw: unknown, stores: { store_id: number; code: string }[] = []): { ref: string; fields: Mapped } | { skip: string } {
  const it = readItem(raw);
  if (it.id === null || !Number.isSafeInteger(it.id)) return { skip: "sem id" };
  const date = normalizeDate(it.data_agenda);
  if (!date) return { skip: "sem data" };
  const plate = normalizePlate(stripHtml(it.placa));
  if (!plate) return { skip: "sem placa" };
  const storeId = int(it.loja_id);
  const storeCode = text(it.loja_codigo, 40) ?? (storeId !== null ? stores.find((s) => s.store_id === storeId)?.code ?? null : null);
  return { ref: String(it.id), fields: {
    date, plate, time: normalizeTime(it.hora) || null, km_scheduled: int(it.km_agendamento), contact: text(it.contato, 200),
    contact_number: text(it.contato_numero, 40), issue: text(it.problema), note: text(it.obs), workshop: text(it.fornecedor_nome, 200),
    supplier_id: int(it.fornecedor_id), external_order: text(it.os_externa, 100), store_id: storeId, store: storeCode,
    operator_id: int(it.operador_id), operator: text(it.operador_nome, 200), brand: text(it.marca, 100), model: text(it.modelo, 200),
    schedule_type: it.tipo_agenda ? (/^e/i.test(it.tipo_agenda.trim()) || /emerg/i.test(it.tipo_agenda) ? "E" : "N") : null,
    os_number: int(it.os_numero), client_id: int(it.cliente_id), sgloc_performed: text(it.realizado, 40), sgloc_confirmed: text(it.confirmado, 40),
  } };
}

const same = (a: unknown, b: unknown) => (a === null || a === undefined || a === "" ? "" : String(a).trim()) === (b === null || b === undefined ? "" : String(b).trim());

/** Só campos que mudaram; valor vazio do SGLOC nunca apaga o painel. */
export function diffAppointment(local: Partial<Record<SyncField, unknown>>, mapped: Mapped): Mapped {
  const patch: Mapped = {};
  for (const k of SYNC_FIELDS) {
    const v = mapped[k];
    if (v === null || v === undefined || v === "") continue;
    if (k === "plate" ? normalizePlate(local[k]) !== v : !same(local[k], v)) patch[k] = v;
  }
  return patch;
}

export type SyncPlan = {
  create: { ref: string; fields: Mapped }[];
  update: { id: string; ref: string; patch: Record<string, unknown> }[];
  link: { id: string; ref: string; patch: Record<string, unknown> }[];
  notReturned: { id: string; missing: number }[];
  counts: { fetched: number; created: number; updated: number; linked: number; protected: number; ambiguous: number; not_returned: number; skipped: number; unchanged: number };
  skippedReasons: Record<string, number>;
  ambiguousRefs: string[];
};

const PROTECTED = new Set(["pending_push", "push_failed"]);
const hhmm = (v: unknown) => normalizeTime(v);

/**
 * Decide o que fazer com cada item. `complete` = todas as páginas lidas sem erro (só então marca "não retornado").
 * `locals` deve incluir arquivados (nunca recriados nem alterados).
 */
export function planSync(input: { items: unknown[]; locals: LocalRow[]; window: { start: string; end: string }; complete: boolean; stores?: { store_id: number; code: string }[] }): SyncPlan {
  const plan: SyncPlan = { create: [], update: [], link: [], notReturned: [], ambiguousRefs: [], skippedReasons: {},
    counts: { fetched: input.items.length, created: 0, updated: 0, linked: 0, protected: 0, ambiguous: 0, not_returned: 0, skipped: 0, unchanged: 0 } };
  const byRef = new Map<string, LocalRow>();
  for (const l of input.locals) if (l.sgloc_reference) byRef.set(l.sgloc_reference, l);
  const unlinked = input.locals.filter((l) => !l.sgloc_reference && !l.archived_at);
  const usedLocal = new Set<string>();
  const seen = new Set<string>();
  const skip = (r: string) => { plan.counts.skipped++; plan.skippedReasons[r] = (plan.skippedReasons[r] ?? 0) + 1; };
  for (const raw of input.items) {
    const m = mapSglocItem(raw, input.stores);
    if ("skip" in m) { skip(m.skip); continue; }
    if (seen.has(m.ref)) { skip("repetido"); continue; }
    seen.add(m.ref);
    const local = byRef.get(m.ref);
    if (local) {
      if (local.archived_at) { skip("na Lixeira"); continue; }
      if (PROTECTED.has(local.sgloc_sync_state ?? "")) { plan.counts.protected++; continue; }
      const patch: Record<string, unknown> = diffAppointment(local, m.fields);
      const wasMissing = local.sgloc_sync_state !== "synced" || (local.sgloc_missing_count ?? 0) > 0;
      if (!Object.keys(patch).length && !wasMissing) { plan.counts.unchanged++; continue; }
      plan.update.push({ id: local.id, ref: m.ref, patch: { ...patch, sgloc_sync_state: "synced", sgloc_missing_count: 0, sgloc_last_error: null } });
      if (Object.keys(patch).length) plan.counts.updated++; else plan.counts.unchanged++;
      continue;
    }
    const time = hhmm(m.fields.time);
    const candidates = unlinked.filter((l) => !usedLocal.has(l.id) && normalizePlate(l.plate) === m.fields.plate && l.date === m.fields.date
      && (!time || !hhmm(l.time) || hhmm(l.time) === time));
    if (candidates.length > 1) { plan.counts.ambiguous++; plan.ambiguousRefs.push(m.ref); continue; }
    const match = candidates[0];
    if (match) {
      usedLocal.add(match.id);
      if (PROTECTED.has(match.sgloc_sync_state ?? "")) { plan.counts.protected++; continue; }
      plan.link.push({ id: match.id, ref: m.ref, patch: { ...diffAppointment(match, m.fields), sgloc_reference: m.ref, sgloc_sync_state: "synced", sgloc_missing_count: 0 } });
      plan.counts.linked++;
      continue;
    }
    plan.create.push(m);
    plan.counts.created++;
  }
  if (input.complete) {
    for (const l of input.locals) {
      if (!l.sgloc_reference || l.archived_at || seen.has(l.sgloc_reference) || PROTECTED.has(l.sgloc_sync_state ?? "")) continue;
      if (!l.date || l.date < input.window.start || l.date > input.window.end) continue;
      plan.notReturned.push({ id: l.id, missing: (l.sgloc_missing_count ?? 0) + 1 });
      plan.counts.not_returned++;
    }
  }
  return plan;
}

/** Datas YYYY-MM-DD a partir de "hoje" em São Paulo. */
export function syncWindow(today: string, back: number, ahead: number): { start: string; end: string } {
  const base = Date.parse(`${today}T12:00:00Z`);
  const fmt = (d: number) => new Date(base + d * 86400_000).toISOString().slice(0, 10);
  return { start: fmt(-back), end: fmt(ahead) };
}

export type TickSettings = { enabled: boolean; auto_sync_enabled: boolean; base_url: string | null; interval_minutes: number; sync_user_id: string | null };

/** O tick deve rodar agora? `lastStartedAt` = início da última execução agendada concluída (success/partial). */
export function shouldRunTick(s: TickSettings, lastStartedAt: string | null, now = Date.now()): { run: boolean; reason: string } {
  if (!s.auto_sync_enabled) return { run: false, reason: "sincronização automática desligada" };
  if (!s.enabled || !s.base_url) return { run: false, reason: "integração desligada" };
  if (!s.sync_user_id) return { run: false, reason: "sem conta designada" };
  if (lastStartedAt) {
    const t = Date.parse(lastStartedAt);
    if (!Number.isNaN(t) && now - t < (s.interval_minutes - 1) * 60_000) return { run: false, reason: "intervalo não atingido" };
  }
  return { run: true, reason: "ok" };
}

/** Próxima execução prevista (ISO) ou null se desligada. */
export function nextRunAt(s: TickSettings, lastStartedAt: string | null, now = Date.now()): string | null {
  if (!s.auto_sync_enabled || !s.enabled || !s.base_url || !s.sync_user_id) return null;
  const t = lastStartedAt ? Date.parse(lastStartedAt) : NaN;
  const due = Number.isNaN(t) ? now : Math.max(now, t + s.interval_minutes * 60_000);
  const tick = 15 * 60_000;
  return new Date(Math.ceil(due / tick) * tick).toISOString();
}

/** Amostra mascarada (sem dados pessoais) para o relatório da simulação. */
export function maskedSample(plan: SyncPlan, max = 20) {
  const out: Record<string, unknown>[] = [];
  for (const c of plan.create) { if (out.length >= max) break; out.push({ acao: "criar", ref: c.ref, placa: maskValue("placa", c.fields.plate), data: c.fields.date }); }
  for (const u of plan.update) { if (out.length >= max) break; out.push({ acao: "atualizar", ref: u.ref, campos: Object.keys(u.patch).filter((k) => !k.startsWith("sgloc_")) }); }
  for (const l of plan.link) { if (out.length >= max) break; out.push({ acao: "vincular", ref: l.ref }); }
  for (const r of plan.ambiguousRefs) { if (out.length >= max) break; out.push({ acao: "ambiguo", ref: r }); }
  return out;
}

export const intervalValid = (m: number) => Number.isInteger(m) && m >= 15 && m <= 1440;

/** Perfis que podem usar "Atualizar do SGLOC". */
export const canRefreshFromSgloc = (role: unknown) => role === "oficina" || role === "gerente" || role === "master";
/** Segundos de espera até poder atualizar de novo (0 = pode). */
export function refreshWaitSeconds(lastStartedAt: string | null, now: number, gapMs: number): number {
  const t = lastStartedAt ? Date.parse(lastStartedAt) : NaN;
  if (Number.isNaN(t) || now - t >= gapMs) return 0;
  return Math.ceil((gapMs - (now - t)) / 1000);
}
