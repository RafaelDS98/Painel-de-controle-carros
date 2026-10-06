/** Execução da sincronização SGLOC → painel. SOMENTE servidor. Logs só com contagens e tipos de erro. */
import { SglocError, readList, todayInSaoPaulo } from "./core";
import { maskedSample, planSync, syncWindow, type LocalRow } from "./sync-core";

export type SyncTrigger = "schedule" | "manual";
export type SyncSummary = { runId: string | null; status: string; dryRun: boolean; message: string; counts: Record<string, number> };

const MAX_PAGES = 50;
const PER_PAGE = 100;
const LOCAL_COLS = "id, sgloc_reference, plate, date, time, archived_at, sgloc_sync_state, sgloc_missing_count, km_scheduled, contact, contact_number, issue, note, workshop, supplier_id, external_order, store_id, store, operator_id, operator, brand, model, schedule_type, os_number, client_id, sgloc_performed, sgloc_confirmed";

export class SyncBusyError extends Error {}

export async function loadSyncSettings() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("sgloc_settings").select("*").eq("id", true).maybeSingle();
  return data;
}

/** Início da última execução concluída (success/partial) de um tipo, para o intervalo. */
export async function lastCompletedStart(trigger?: SyncTrigger): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin.from("sgloc_sync_runs").select("started_at").in("status", ["success", "partial"]).eq("dry_run", false);
  if (trigger) q = q.eq("trigger_source", trigger);
  const { data } = await q.order("started_at", { ascending: false }).limit(1).maybeSingle();
  return data?.started_at ?? null;
}

export async function runSglocSync(opts: { trigger: SyncTrigger; simulate: boolean; actorId: string | null }): Promise<SyncSummary> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const client = await import("./client.server");
  const settings = await loadSyncSettings();
  const dryRun = opts.simulate || !settings?.sync_live;

  // Execuções presas há mais de 15 min são encerradas antes de começar.
  await supabaseAdmin.from("sgloc_sync_runs").update({ status: "abandoned", finished_at: new Date().toISOString() })
    .eq("status", "running").lt("started_at", new Date(Date.now() - 15 * 60_000).toISOString());
  const { data: run, error: runErr } = await supabaseAdmin.from("sgloc_sync_runs")
    .insert({ status: "running", trigger_source: opts.trigger, created_by: opts.actorId, dry_run: dryRun }).select("id").single();
  if (runErr || !run) throw new SyncBusyError("Já existe uma sincronização em andamento. Aguarde terminar.");

  const finish = async (status: string, fields: Record<string, unknown>, message: string): Promise<SyncSummary> => {
    await supabaseAdmin.from("sgloc_sync_runs").update({ status, finished_at: new Date().toISOString(), ...fields } as never).eq("id", run.id);
    console.info(`[sgloc-sync] ${opts.trigger}${dryRun ? " simulação" : ""} status=${status} ${JSON.stringify(Object.fromEntries(Object.entries(fields).filter(([, v]) => typeof v === "number")))}`);
    const counts = Object.fromEntries(Object.entries(fields).filter(([, v]) => typeof v === "number")) as Record<string, number>;
    return { runId: run.id, status, dryRun, message, counts };
  };
  const fail = (e: unknown, step: string) => {
    const kind = e instanceof SglocError ? e.kind : "erro";
    const msg = e instanceof SglocError ? e.message : `Falha inesperada (${step}).`;
    return finish("failed", { errors: 1, error_detail: [{ step, kind, message: msg }] }, msg);
  };

  let baseUrl: string; let token: string;
  try { baseUrl = client.assertUsable({ enabled: settings?.enabled ?? false, base_url: settings?.base_url ?? null, request_timeout_seconds: settings?.request_timeout_seconds ?? 15, write_enabled: false }); }
  catch (e) { return fail(e, "configuração"); }
  if (!settings?.sync_user_id) return fail(new SglocError("no_account", "Nenhuma conta SGLOC designada para a sincronização."), "conta");
  try { token = await client.getUserToken(settings.sync_user_id); }
  catch (e) {
    const msg = e instanceof SglocError && e.kind === "expired" ? "A conta SGLOC designada para a sincronização expirou. Reconecte em Minha conta > Conta SGLOC."
      : "A conta SGLOC designada para a sincronização não está conectada.";
    return fail(new SglocError(e instanceof SglocError ? e.kind : "no_account", msg), "conta");
  }

  const window = syncWindow(todayInSaoPaulo(), settings.window_days_back, settings.window_days_ahead);
  const items: unknown[] = [];
  let complete = false;
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const r = await client.sglocFetch({ baseUrl, timeoutSeconds: settings.request_timeout_seconds, method: "GET", path: "api/agendamanutencao/list", token,
        query: { data_inicial: window.start, data_final: window.end, per_page: PER_PAGE, page } });
      const list = readList(r.body);
      items.push(...list.items);
      const last = list.lastPage ?? (list.items.length < PER_PAGE ? page : null);
      if (last !== null && page >= last) { complete = true; break; }
      if (!list.items.length) { complete = true; break; }
    }
  } catch (e) {
    if (e instanceof SglocError && e.kind === "unauthorized") {
      await client.markExpired(settings.sync_user_id);
      return fail(new SglocError("unauthorized", "O SGLOC recusou a conta designada (401). Reconecte em Minha conta > Conta SGLOC."), "listagem");
    }
    return fail(e, "listagem");
  }

  // Linhas locais (inclui arquivados; nunca recriados nem alterados).
  const locals: LocalRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin.from("appointments").select(LOCAL_COLS).range(from, from + 999);
    if (error) return fail(error, "leitura do painel");
    locals.push(...((data ?? []) as unknown as LocalRow[]));
    if (!data || data.length < 1000) break;
  }
  const { data: stores } = await supabaseAdmin.from("sgloc_stores").select("store_id, code");
  const plan = planSync({ items, locals, window, complete, stores: stores ?? [] });
  const base = { fetched: plan.counts.fetched, skipped: plan.counts.skipped, protected: plan.counts.protected, ambiguous: plan.counts.ambiguous, sample: maskedSample(plan) };
  const note = complete ? "" : ` Leitura interrompida em ${MAX_PAGES} páginas; "não retornado" não foi marcado.`;

  if (dryRun) {
    return finish(complete ? "success" : "partial", { ...base, inserted: plan.counts.created, updated: plan.counts.updated, linked: plan.counts.linked, not_returned: plan.counts.not_returned },
      `Simulação: criaria ${plan.counts.created}, atualizaria ${plan.counts.updated}, vincularia ${plan.counts.linked}, marcaria ${plan.counts.not_returned} como não retornado.${note}`);
  }

  const errors: { ref?: string; kind: string }[] = [];
  // Listas de seleção: valores novos vindos do SGLOC entram com origem "SGLOC" (casados pelo nome normalizado).
  let catalogAdded = 0;
  const touched = [...plan.create.map((c) => c.fields as Record<string, unknown>), ...plan.update.map((u) => u.patch as Record<string, unknown>), ...plan.link.map((u) => u.patch as Record<string, unknown>)];
  const seenCatalog = new Set<string>();
  for (const f of touched) {
    for (const [kind, column, idColumn] of [["store", "store", "store_id"], ["brand", "brand", null], ["operator", "operator", "operator_id"], ["workshop", "workshop", null]] as const) {
      const name = typeof f[column] === "string" ? (f[column] as string).trim() : "";
      const key = `${kind}:${name.toLowerCase()}`;
      if (!name || seenCatalog.has(key)) continue;
      seenCatalog.add(key);
      const sid = idColumn && typeof f[idColumn] === "number" ? (f[idColumn] as number) : undefined;
      const { data: added, error: catErr } = await supabaseAdmin.rpc("catalog_add", { _kind: kind, _name: name, _source: "SGLOC", ...(sid !== undefined ? { _sgloc_id: sid } : {}) });
      if (!catErr && (added as { created?: boolean } | null)?.created) catalogAdded++;
    }
  }
  let inserted = 0; let updated = 0; let linked = 0; let missing = 0;
  const today = todayInSaoPaulo();
  const now = new Date().toISOString();
  for (const c of plan.create) {
    const row = Object.fromEntries(Object.entries(c.fields).filter(([, v]) => v !== null && v !== undefined));
    const { error } = await supabaseAdmin.from("appointments").insert({ ...row, sgloc_reference: c.ref, registered_at: today, status: "", sheet_id: "",
      sgloc_sync_state: "synced", sgloc_synced_at: now } as never);
    if (error) errors.push({ ref: c.ref, kind: error.code ?? "insert" }); else inserted++;
  }
  for (const [list, inc] of [[plan.update, () => updated++], [plan.link, () => linked++]] as const) {
    for (const u of list) {
      const { error } = await supabaseAdmin.from("appointments").update({ ...u.patch, sgloc_synced_at: now } as never).eq("id", u.id).is("archived_at", null);
      if (error) errors.push({ ref: u.ref, kind: error.code ?? "update" }); else inc();
    }
  }
  for (const n of plan.notReturned) {
    const { error } = await supabaseAdmin.from("appointments").update({ sgloc_sync_state: "not_returned", sgloc_missing_count: n.missing } as never)
      .eq("id", n.id).is("archived_at", null).not("sgloc_sync_state", "in", "(pending_push,push_failed)");
    if (error) errors.push({ kind: error.code ?? "not_returned" }); else missing++;
  }
  const status = errors.length || !complete ? "partial" : "success";
  return finish(status, { ...base, inserted, updated, linked, not_returned: missing, errors: errors.length, error_detail: errors.slice(0, 50) },
    `Sincronização: ${inserted} criado(s), ${updated} atualizado(s), ${linked} vinculado(s), ${missing} não retornado(s), ${errors.length} erro(s)${catalogAdded ? `, ${catalogAdded} novo(s) item(ns) nas listas` : ""}.${note}`);
}
