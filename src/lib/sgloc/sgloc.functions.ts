import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { errorCode } from "@/lib/auth-errors";

type Ctx = { supabase: any; userId: string };

async function assertMaster(context: Ctx) {
  const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).maybeSingle();
  if (error || data?.role !== "master") throw new Error("Você não tem permissão (apenas master).");
}
async function assertApproved(context: Ctx) {
  const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).maybeSingle();
  if (error || !data?.role) throw new Error("Seu usuário ainda não tem acesso ao painel.");
}

/** Converte qualquer erro em mensagem segura em português, com código curto para suporte. */
async function safeError(op: string, caught: unknown): Promise<Error> {
  const { SglocError } = await import("./core");
  if (caught instanceof SglocError) return new Error(caught.message);
  if (caught instanceof Error && /permissão|acesso ao painel/.test(caught.message)) return caught;
  const code = errorCode();
  console.error(`[sgloc] ${op} falhou cód=${code}`, (caught as Error)?.name ?? "erro");
  return new Error(`Erro inesperado na integração SGLOC (cód. ${code}).`);
}

const settingsInput = z.object({
  baseUrl: z.string().trim().max(300),
  enabled: z.boolean(),
  writeEnabled: z.boolean().default(false),
  timeoutSeconds: z.number().int().min(3, "Tempo limite mínimo: 3 segundos.").max(60, "Tempo limite máximo: 60 segundos."),
  intervalMinutes: z.number().int("Intervalo deve ser em minutos inteiros.").min(15, "Intervalo mínimo: 15 minutos.").max(1440, "Intervalo máximo: 24 horas (1440 minutos).").optional(),
  windowDaysBack: z.number().int().min(0, "Dias para trás: mínimo 0.").max(60, "Dias para trás: máximo 60.").optional(),
  windowDaysAhead: z.number().int().min(0, "Dias para frente: mínimo 0.").max(180, "Dias para frente: máximo 180.").optional(),
  syncUserId: z.string().uuid().nullable().optional(),
  syncLive: z.boolean().optional(),
});

export const saveSglocSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const p = settingsInput.safeParse(data);
    if (!p.success) throw new Error(p.error.issues[0]?.message ?? "Dados inválidos.");
    return p.data;
  })
  .handler(async ({ data, context }) => {
    await assertMaster(context);
    const { validateBaseUrl, SglocError } = await import("./core");
    let baseUrl: string | null = null;
    if (data.baseUrl) {
      try { baseUrl = validateBaseUrl(data.baseUrl); } catch (e) { throw new Error(e instanceof SglocError ? e.message : "URL inválida."); }
    }
    if (data.enabled && !baseUrl) throw new Error("Informe a URL base antes de ativar a integração.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.syncUserId) {
      const { data: acc } = await supabaseAdmin.from("sgloc_accounts").select("user_id").eq("user_id", data.syncUserId).maybeSingle();
      if (!acc) throw new Error("O usuário escolhido não tem conta SGLOC conectada.");
    }
    if (data.syncLive) {
      const { data: cur } = await supabaseAdmin.from("sgloc_settings").select("sync_live").eq("id", true).maybeSingle();
      if (!cur?.sync_live) {
        const { data: sim } = await supabaseAdmin.from("sgloc_sync_runs").select("id").eq("dry_run", true).eq("status", "success")
          .gte("started_at", new Date(Date.now() - 24 * 3600_000).toISOString()).limit(1).maybeSingle();
        if (!sim) throw new Error("Rode uma simulação concluída (últimas 24 h) antes de ligar a sincronização de verdade.");
      }
    }
    const row: Record<string, unknown> = {
      id: true, base_url: baseUrl, enabled: data.enabled, write_enabled: data.writeEnabled, request_timeout_seconds: data.timeoutSeconds,
      updated_at: new Date().toISOString(), updated_by: context.userId,
    };
    if (data.intervalMinutes !== undefined) row["interval_minutes"] = data.intervalMinutes;
    if (data.windowDaysBack !== undefined) row["window_days_back"] = data.windowDaysBack;
    if (data.windowDaysAhead !== undefined) row["window_days_ahead"] = data.windowDaysAhead;
    if (data.syncUserId !== undefined) row["sync_user_id"] = data.syncUserId;
    if (data.syncLive !== undefined) row["sync_live"] = data.syncLive;
    const { error } = await supabaseAdmin.from("sgloc_settings").upsert(row as never);
    if (error) throw await safeError("saveSettings", error);
    return { baseUrl, enabled: data.enabled, writeEnabled: data.writeEnabled, timeoutSeconds: data.timeoutSeconds };
  });

/** Usuários com conta SGLOC conectada (para escolher a conta da rotina). Só master. */
export const listSglocConnectedUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMaster(context);
    const { data, error } = await context.supabase.rpc("list_sgloc_connected_users");
    if (error) throw await safeError("listConnected", error);
    return ((data ?? []) as { user_id: string; full_name: string | null; sgloc_email: string; token_expires_at: string | null }[])
      .map((u) => ({ userId: u.user_id, name: u.full_name ?? "", sglocEmail: u.sgloc_email, expiresAt: u.token_expires_at }));
  });

/** Situação da sincronização: última execução, última simulação, próxima prevista e aviso da conta. Só master. */
export const getSglocSyncStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadSyncSettings, lastCompletedStart } = await import("./sync.server");
    const { nextRunAt } = await import("./sync-core");
    const { tokenState } = await import("./core");
    const s = await loadSyncSettings();
    const cols = "id, started_at, finished_at, status, trigger_source, dry_run, fetched, inserted, updated, linked, protected, ambiguous, not_returned, skipped, errors, error_detail, sample";
    const { data: last } = await supabaseAdmin.from("sgloc_sync_runs").select(cols).order("started_at", { ascending: false }).limit(1).maybeSingle();
    const { data: lastSim } = await supabaseAdmin.from("sgloc_sync_runs").select(cols).eq("dry_run", true).neq("status", "running").order("started_at", { ascending: false }).limit(1).maybeSingle();
    const { data: lastReal } = await supabaseAdmin.from("sgloc_sync_runs").select("started_at").eq("dry_run", false).in("status", ["success", "partial"]).order("started_at", { ascending: false }).limit(1).maybeSingle();
    let accountWarning: string | null = null;
    if (!s?.sync_user_id) accountWarning = "Nenhuma conta SGLOC designada para a sincronização.";
    else {
      const { data: acc } = await supabaseAdmin.from("sgloc_accounts").select("token_expires_at").eq("user_id", s.sync_user_id).maybeSingle();
      if (!acc) accountWarning = "A conta designada não está conectada ao SGLOC.";
      else if (tokenState(acc.token_expires_at) === "expired") accountWarning = "A conexão SGLOC da conta designada expirou; ela precisa reconectar em Minha conta.";
    }
    const tick = { enabled: Boolean(s?.enabled), base_url: s?.base_url ?? null, interval_minutes: s?.interval_minutes ?? 480, sync_user_id: s?.sync_user_id ?? null };
    return {
      settings: { intervalMinutes: s?.interval_minutes ?? 480, windowDaysBack: s?.window_days_back ?? 7, windowDaysAhead: s?.window_days_ahead ?? 45,
        syncUserId: s?.sync_user_id ?? null, syncLive: Boolean(s?.sync_live) },
      last: last ?? null, lastSimulation: lastSim ?? null, lastRealSuccessAt: lastReal?.started_at ?? null,
      nextRunAt: nextRunAt(tick, await lastCompletedStart("schedule")), accountWarning,
    };
  });

/** "Simular agora" / "Sincronizar agora" (manual). Só master; 1 a cada 30 s; sem sobreposição. */
export const runSglocSyncNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ simulate: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: last } = await supabaseAdmin.from("sgloc_sync_runs").select("started_at").order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (last?.started_at && Date.now() - Date.parse(last.started_at) < 30_000) {
      const wait = Math.ceil((30_000 - (Date.now() - Date.parse(last.started_at))) / 1000);
      throw new Error(`Aguarde ${wait} s para rodar de novo (limite: 1 execução a cada 30 segundos).`);
    }
    const { runSglocSync, SyncBusyError } = await import("./sync.server");
    try { return await runSglocSync({ trigger: "manual", simulate: data.simulate, actorId: context.userId }); }
    catch (e) { if (e instanceof SyncBusyError) throw new Error(e.message); throw await safeError("syncNow", e); }
  });

const connectInput = z.object({
  email: z.string().trim().min(3, "Informe o e-mail do SGLOC.").max(255),
  password: z.string().min(1, "Informe a senha do SGLOC.").max(200),
});

/** Faz login no SGLOC com a conta do próprio usuário; guarda só o token (cifrado). A senha é descartada. */
export const connectSglocAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const p = connectInput.safeParse(data);
    if (!p.success) throw new Error(p.error.issues[0]?.message ?? "Dados inválidos.");
    return p.data;
  })
  .handler(async ({ data, context }) => {
    await assertApproved(context);
    try {
      const { loadSettings, assertUsable, sglocFetch, encryptToken } = await import("./client.server");
      const { readLogin, SglocError } = await import("./core");
      const settings = await loadSettings();
      const baseUrl = assertUsable(settings);
      let res;
      try {
        res = await sglocFetch({ baseUrl, timeoutSeconds: settings.request_timeout_seconds, method: "POST", path: "api/login", json: { EMAIL: data.email, PASSWORD: data.password } });
      } catch (e) {
        const { composeLoginError, SglocError } = await import("./core");
        if (e instanceof SglocError && (e.kind === "unauthorized" || e.kind === "validation" || e.kind === "not_found"))
          throw new SglocError(e.kind, composeLoginError(e));
        throw e;
      }
      const login = readLogin(res.body);
      if (!login.token) throw new SglocError("not_json", "O SGLOC respondeu ao login, mas sem token no formato esperado.");
      const enc = await encryptToken(login.token);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.from("sgloc_accounts").upsert({
        user_id: context.userId, sgloc_email: login.email ?? data.email, sgloc_user_code: login.userCode,
        token: enc.value, token_encrypted: enc.encrypted, token_expires_at: login.expiresAt, updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return { connected: true, sgloc_email: login.email ?? data.email, token_expires_at: login.expiresAt };
    } catch (caught) { throw await safeError("connect", caught); }
  });

export const disconnectSglocAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("sgloc_accounts").delete().eq("user_id", context.userId);
    if (error) throw await safeError("disconnect", error);
    return { connected: false };
  });

export type ProbeStep = { step: string; title: string; ok: boolean; httpStatus: number | null; latencyMs: number | null; explanation: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  summary: Record<string, any> };

/** Teste de integração — somente leitura (GET). Só master, no máximo 1 a cada 30 s. */
export const runSglocProbe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: last } = await supabaseAdmin.from("sgloc_probe_runs").select("run_at").order("run_at", { ascending: false }).limit(1).maybeSingle();
    if (last && Date.now() - Date.parse(last.run_at) < 30_000) {
      const wait = Math.ceil((30_000 - (Date.now() - Date.parse(last.run_at))) / 1000);
      throw new Error(`Aguarde ${wait} s para testar de novo (limite: 1 teste a cada 30 segundos).`);
    }
    const core = await import("./core");
    const client = await import("./client.server");
    const runId = crypto.randomUUID();
    const runAt = new Date().toISOString();
    const steps: ProbeStep[] = [];
    const record = async (s: ProbeStep) => {
      steps.push(s);
      await supabaseAdmin.from("sgloc_probe_runs").insert({
        run_at: runAt, run_by: context.userId, step: s.step, ok: s.ok, http_status: s.httpStatus, latency_ms: s.latencyMs,
        summary: { run_id: runId, title: s.title, ...s.summary } as never, error: s.ok ? null : s.explanation,
      });
    };
    const fromError = (step: string, title: string, e: unknown): ProbeStep => {
      const err = e instanceof core.SglocError ? e : new core.SglocError("http", "Falha inesperada neste passo.");
      return { step, title, ok: false, httpStatus: err.status, latencyMs: err.latencyMs, explanation: err.message, summary: { error_kind: err.kind } };
    };

    const settings = await client.loadSettings();
    let baseUrl: string;
    try { baseUrl = client.assertUsable(settings); }
    catch (e) { await record(fromError("config", "Configuração", e)); return { runId, runAt, steps }; }
    let token: string;
    try { token = await client.getUserToken(context.userId); }
    catch (e) { await record(fromError("account", "Conta SGLOC do master", e)); return { runId, runAt, steps }; }
    const t = settings.request_timeout_seconds;
    const call = (path: string, query?: Record<string, string | number>) => client.sglocFetch({ baseUrl, timeoutSeconds: t, method: "GET", path, query, token });
    const on401 = async (e: unknown) => { if (e instanceof core.SglocError && e.kind === "unauthorized") await client.markExpired(context.userId); };

    // (a) alcance
    try {
      const r = await client.sglocFetch({ baseUrl, timeoutSeconds: t, method: "GET", path: "", classify: false });
      await record({ step: "reach", title: "Alcance do servidor", ok: true, httpStatus: r.status, latencyMs: r.latencyMs,
        explanation: `Servidor alcançado (DNS e TLS/HTTPS funcionaram). Qualquer resposta HTTP conta como alcançável.`, summary: { content_type: r.headers["content-type"] ?? null } });
    } catch (e) {
      await record(fromError("reach", "Alcance do servidor", e));
      return { runId, runAt, steps };
    }

    // (b) token + listagem
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const end = new Date(); const start = new Date(Date.now() - 30 * 86400_000);
    const listQuery = { data_inicial: fmt(start), data_final: fmt(end), per_page: 5 };
    let firstItem: unknown = null;
    try {
      const r = await call("api/agendamanutencao/list", listQuery);
      const list = core.readList(r.body);
      firstItem = list.items[0] ?? null;
      await record({ step: "list", title: "Token e listagem (últimos 30 dias, 5 por página)", ok: true, httpStatus: r.status, latencyMs: r.latencyMs,
        explanation: `Token aceito. ${list.items.length} item(ns) nesta página${list.total !== null ? ` de ${list.total} no total` : ""}.`,
        summary: { query: listQuery, envelope_keys: list.envelopeKeys, pagination_keys: list.paginationKeys, total: list.total, current_page: list.currentPage, last_page: list.lastPage,
          rate_limit_headers: Object.fromEntries(Object.entries(r.headers).filter(([k]) => k !== "content-type")),
          items: list.items.map((it) => core.describeFields(it)) } });
    } catch (e) { await on401(e); await record(fromError("list", "Token e listagem", e)); }

    // (c) novo
    try {
      const r = await call("api/agendamanutencao/novo");
      const defaults = core.readObject(r.body);
      const env = r.body && typeof r.body === "object" ? Object.keys(r.body as object) : [];
      await record({ step: "novo", title: "Valores padrão e opções (novo)", ok: true, httpStatus: r.status, latencyMs: r.latencyMs,
        explanation: "Opções lidas. Os valores de tipo_agenda, realizado e confirmado aparecem na íntegra.",
        summary: { envelope_keys: env, defaults: core.describeFields(defaults), opcoes: core.readOptions(r.body) } });
    } catch (e) { await on401(e); await record(fromError("novo", "Valores padrão e opções (novo)", e)); }

    // (d) detalhe
    const firstId = firstItem && typeof firstItem === "object" ? core.num((firstItem as Record<string, unknown>)['id']) : null;
    if (firstId === null) {
      await record({ step: "detail", title: "Detalhe de um agendamento", ok: false, httpStatus: null, latencyMs: null,
        explanation: "Passo não executado: a listagem não trouxe nenhum item com id nos últimos 30 dias.", summary: { skipped: true } });
    } else {
      try {
        const r = await call(`api/agendamanutencao/${firstId}`);
        const detail = core.readObject(r.body);
        await record({ step: "detail", title: `Detalhe do agendamento ${firstId}`, ok: true, httpStatus: r.status, latencyMs: r.latencyMs,
          explanation: "Detalhe lido e comparado com o item da listagem.", summary: { id: firstId, detail: core.describeFields(detail), comparison: core.compareFields(firstItem, detail) } });
      } catch (e) { await on401(e); await record(fromError("detail", `Detalhe do agendamento ${firstId}`, e)); }
    }

    // (e) página 2
    try {
      const r = await call("api/agendamanutencao/list", { ...listQuery, page: 2 });
      const list = core.readList(r.body);
      await record({ step: "page2", title: "Segunda página", ok: true, httpStatus: r.status, latencyMs: r.latencyMs,
        explanation: list.items.length ? `Paginação funciona: ${list.items.length} item(ns) na página 2.` : "Página 2 respondeu vazia (pode haver 5 itens ou menos no período).",
        summary: { items_count: list.items.length, current_page: list.currentPage, last_page: list.lastPage, pagination_keys: list.paginationKeys } });
    } catch (e) { await on401(e); await record(fromError("page2", "Segunda página", e)); }

    return { runId, runAt, steps };
  });

const pushInput = z.object({
  appointmentId: z.string().uuid(),
  origin: z.enum(["create", "update", "retry"]),
  changed: z.array(z.string().max(40)).max(20).default([]),
});

export type PushResult = { status: "skipped" | "no_change" | "synced" | "failed"; message?: string | undefined; warning?: string | undefined };

/**
 * Envia criação (POST store) ou edição (PUT {id}) ao SGLOC com o token do usuário logado.
 * Só roda com integração e escrita ativas. Falha nunca desfaz o agendamento do painel: marca push_failed.
 */
export const pushAppointmentToSgloc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const p = pushInput.safeParse(data);
    if (!p.success) throw new Error("Dados inválidos.");
    return p.data;
  })
  .handler(async ({ data, context }): Promise<PushResult> => {
    await assertApproved(context);
    // Leitura com RLS do usuário: confirma que ele enxerga o agendamento.
    const { data: row, error } = await context.supabase.from("appointments")
      .select("id, date, time, plate, km_scheduled, contact, contact_number, issue, note, workshop, external_order, sgloc_reference, archived_at")
      .eq("id", data.appointmentId).maybeSingle();
    if (error || !row) throw new Error("Agendamento não encontrado.");
    if (row.archived_at) return { status: "skipped", message: "Agendamento na Lixeira não é enviado ao SGLOC." };
    const core = await import("./core");
    const client = await import("./client.server");
    const settings = await client.loadSettings();
    if (!settings.enabled || !settings.write_enabled) return { status: "skipped" };
    const isUpdate = Boolean(row.sgloc_reference);
    if (data.origin === "update" && !isUpdate) return { status: "skipped" };
    const changed = data.origin === "update" ? data.changed : [...core.SENDABLE_COLUMNS];
    if (isUpdate && !changed.some((c) => (core.SENDABLE_COLUMNS as readonly string[]).includes(c))) return { status: "no_change" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const mark = (update: Record<string, unknown>) => supabaseAdmin.from("appointments").update(update as never).eq("id", row.id);
    let warning: string | undefined;
    try {
      const baseUrl = client.assertUsable(settings);
      let supplierId: number | null = null;
      if (changed.includes("workshop") && (row.workshop ?? "").trim()) {
        const { data: sup } = await supabaseAdmin.from("sgloc_suppliers").select("supplier_id, name");
        supplierId = core.matchSupplier(row.workshop, sup ?? []);
        if (supplierId === null) warning = "Oficina sem código SGLOC: o fornecedor não foi enviado.";
      }
      const src = { ...row, supplierId };
      const token = await client.getUserToken(context.userId);
      const t = settings.request_timeout_seconds;
      if (isUpdate) {
        const body = core.buildUpdateBody(src, changed);
        if (!Object.keys(body).length) return { status: "no_change", warning };
        await client.sglocFetch({ baseUrl, timeoutSeconds: t, method: "PUT", path: `api/agendamanutencao/${encodeURIComponent(String(row.sgloc_reference))}`, token, json: body })
          .catch(async (e) => { if (e instanceof core.SglocError && e.kind === "unauthorized") await client.markExpired(context.userId); throw e; });
        await mark({ sgloc_sync_state: "synced", sgloc_synced_at: new Date().toISOString(), sgloc_last_error: null });
        return { status: "synced", warning };
      }
      const body = core.buildCreateBody(src, core.todayInSaoPaulo());
      const missing = core.missingForCreate(body);
      if (missing) throw new core.SglocError("validation", missing);
      const res = await client.sglocFetch({ baseUrl, timeoutSeconds: t, method: "POST", path: "api/agendamanutencao/store", token, json: body })
        .catch(async (e) => { if (e instanceof core.SglocError && e.kind === "unauthorized") await client.markExpired(context.userId); throw e; });
      const item = core.readItem(core.readObject(res.body));
      if (item.id === null) throw new core.SglocError("not_json", "O SGLOC aceitou o envio, mas não devolveu o ID do agendamento.");
      const update: Record<string, unknown> = { sgloc_reference: String(item.id), sgloc_sync_state: "synced", sgloc_synced_at: new Date().toISOString(), sgloc_last_error: null };
      if (item.operador_id !== null) update["operator_id"] = item.operador_id;
      if (item.loja_id !== null) update["store_id"] = item.loja_id;
      if (item.marca) update["brand"] = item.marca;
      if (item.modelo) update["model"] = item.modelo;
      const { error: upErr } = await mark(update);
      if (upErr) { console.error(`[sgloc] push gravação local falhou cód=${errorCode()}`); return { status: "synced", warning: "Enviado ao SGLOC, mas o ID não pôde ser gravado no painel." }; }
      return { status: "synced", warning };
    } catch (caught) {
      const message = core.pushErrorMessage(caught);
      console.info(`[sgloc] push ${isUpdate ? "PUT" : "POST"} falhou tipo=${caught instanceof core.SglocError ? caught.kind : "erro"}`);
      await mark({ sgloc_sync_state: "push_failed", sgloc_last_error: message });
      return { status: "failed", message, warning };
    }
  });
