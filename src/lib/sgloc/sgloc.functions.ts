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
  timeoutSeconds: z.number().int().min(3, "Tempo limite mínimo: 3 segundos.").max(60, "Tempo limite máximo: 60 segundos."),
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
    const { error } = await supabaseAdmin.from("sgloc_settings").upsert({
      id: true, base_url: baseUrl, enabled: data.enabled, request_timeout_seconds: data.timeoutSeconds,
      updated_at: new Date().toISOString(), updated_by: context.userId,
    });
    if (error) throw await safeError("saveSettings", error);
    return { baseUrl, enabled: data.enabled, timeoutSeconds: data.timeoutSeconds };
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
        if (e instanceof SglocError && (e.kind === "unauthorized" || e.kind === "validation" || e.kind === "not_found"))
          throw new SglocError(e.kind, e.kind === "not_found" ? e.message : `E-mail ou senha do SGLOC recusados${e.status ? ` (${e.status})` : ""}. ${e.kind === "validation" ? e.message : ""}`.trim());
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
