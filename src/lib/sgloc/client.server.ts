/** Cliente SGLOC — SOMENTE servidor. Nunca registra senha, token, Authorization nem corpo com dados pessoais. */
import { classifyHttp, classifyNetwork, SglocError, validateBaseUrl } from "./core";

export type SglocSettings = { enabled: boolean; base_url: string | null; request_timeout_seconds: number };

export async function loadSettings(): Promise<SglocSettings> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("sgloc_settings").select("enabled, base_url, request_timeout_seconds").eq("id", true).maybeSingle();
  return { enabled: data?.enabled ?? false, base_url: data?.base_url ?? null, request_timeout_seconds: data?.request_timeout_seconds ?? 15 };
}

/** Garante integração ligada e URL válida antes de qualquer chamada de rede. */
export function assertUsable(settings: SglocSettings): string {
  if (!settings.enabled) throw new SglocError("disabled", "Integração SGLOC desligada. O master pode ativá-la em Configurações > SGLOC.");
  return validateBaseUrl(settings.base_url);
}

export type SglocResponse = { status: number; latencyMs: number; body: unknown; headers: Record<string, string> };

const RATE_HEADERS = ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset", "retry-after"];

function logCall(method: string, path: string, status: number | string, latency: number, code = "") {
  console.info(`[sgloc] ${method} ${path} status=${status} ${latency}ms${code ? ` erro=${code}` : ""}`);
}

/**
 * Faz uma chamada ao SGLOC. GET pode ter 1 nova tentativa apenas em falha de rede.
 * `classify=false` devolve qualquer status HTTP sem lançar erro (usado no teste de alcance).
 */
export async function sglocFetch(opts: {
  baseUrl: string; timeoutSeconds: number; method: "GET" | "POST"; path: string;
  query?: Record<string, string | number> | undefined; token?: string; json?: unknown; classify?: boolean;
}): Promise<SglocResponse> {
  const url = new URL(opts.path ? `${opts.baseUrl}/${opts.path.replace(/^\/+/, "")}` : opts.baseUrl);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, String(v));
  const logPath = url.pathname;
  const attempts = opts.method === "GET" ? 2 : 1;
  let lastError: SglocError | null = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(3, opts.timeoutSeconds) * 1000);
    const started = Date.now();
    let res: Response;
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
      if (opts.json !== undefined) headers["Content-Type"] = "application/json";
      res = await fetch(url.toString(), {
        method: opts.method, headers, signal: controller.signal, redirect: "manual",
        body: opts.json !== undefined ? JSON.stringify(opts.json) : null,
      });
    } catch (caught) {
      clearTimeout(timer);
      const latency = Date.now() - started;
      lastError = classifyNetwork(caught);
      lastError.latencyMs = latency;
      logCall(opts.method, logPath, "-", latency, lastError.kind);
      if (lastError.kind === "network" && attempt < attempts) continue;
      throw lastError;
    }
    const latencyMs = Date.now() - started;
    let text = "";
    try { text = await res.text(); } catch { /* corpo ilegível */ }
    clearTimeout(timer);
    const headers: Record<string, string> = {};
    for (const h of RATE_HEADERS) { const v = res.headers.get(h); if (v) headers[h] = v; }
    const ct = res.headers.get("content-type") ?? "";
    if (ct) headers["content-type"] = ct.slice(0, 80);
    let body: unknown = null;
    let isJson = true;
    if (text) { try { body = JSON.parse(text); } catch { isJson = false; } }
    if (opts.classify === false) { logCall(opts.method, logPath, res.status, latencyMs); return { status: res.status, latencyMs, body: isJson ? body : null, headers }; }
    if (res.status >= 300 && res.status < 400) {
      logCall(opts.method, logPath, res.status, latencyMs, "redirect");
      throw new SglocError("http", `O SGLOC redirecionou a chamada (${res.status}). Confira se a URL base está completa e correta.`, res.status, latencyMs);
    }
    const httpError = classifyHttp(res.status, isJson ? body : null);
    if (httpError) { httpError.latencyMs = latencyMs; logCall(opts.method, logPath, res.status, latencyMs, httpError.kind); throw httpError; }
    if (!isJson) { logCall(opts.method, logPath, res.status, latencyMs, "not_json"); throw new SglocError("not_json", "O SGLOC respondeu, mas não em formato JSON. Confira a URL base.", res.status, latencyMs); }
    logCall(opts.method, logPath, res.status, latencyMs);
    return { status: res.status, latencyMs, body, headers };
  }
  throw lastError ?? new SglocError("network", "Sem conexão com o SGLOC.");
}

/* ---------------- Token criptografado em repouso (AES-GCM) ---------------- */

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function tokenKey(): Promise<CryptoKey | null> {
  const secret = process.env["SGLOC_TOKEN_KEY"];
  if (!secret || secret.length < 32) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptToken(token: string): Promise<{ value: string; encrypted: boolean }> {
  const key = await tokenKey();
  if (!key) throw new SglocError("http", "Chave de proteção do token (SGLOC_TOKEN_KEY) não configurada no servidor.");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token)));
  return { value: `v1:${b64(iv)}:${b64(cipher)}`, encrypted: true };
}

export async function decryptToken(value: string, encrypted: boolean): Promise<string> {
  if (!encrypted) return value;
  const key = await tokenKey();
  const [, iv, cipher] = value.split(":");
  if (!key || !iv || !cipher) throw new SglocError("no_account", "Não foi possível ler o token SGLOC salvo. Conecte a conta novamente.");
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(cipher));
    return new TextDecoder().decode(plain);
  } catch { throw new SglocError("no_account", "Não foi possível ler o token SGLOC salvo. Conecte a conta novamente."); }
}

/** Busca o token válido do usuário (servidor). Expirado → erro; nunca devolve o token ao navegador. */
export async function getUserToken(userId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("sgloc_accounts").select("token, token_encrypted, token_expires_at").eq("user_id", userId).maybeSingle();
  if (!data) throw new SglocError("no_account", "Sua conta SGLOC não está conectada. Conecte em Minha conta > Conta SGLOC.");
  if (data.token_expires_at && Date.parse(data.token_expires_at) <= Date.now() + 30_000)
    throw new SglocError("expired", "Sua conexão com o SGLOC expirou. Conecte novamente em Minha conta > Conta SGLOC.");
  return decryptToken(data.token, data.token_encrypted);
}

/** Em 401, marca a conta como expirada (sem apagar o e-mail). */
export async function markExpired(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("sgloc_accounts").update({ token_expires_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("user_id", userId);
}
