/** Funções puras do conector SGLOC (sem rede, sem segredos). Usadas no servidor e nos testes. */

export type SglocErrorKind =
  | "disabled" | "no_url" | "invalid_url" | "no_account" | "expired" | "network" | "timeout"
  | "unauthorized" | "not_found" | "validation" | "server" | "not_json" | "http" | "rate_limited";

export class SglocError extends Error {
  constructor(public kind: SglocErrorKind, message: string, public status: number | null = null, public latencyMs: number | null = null) {
    super(message);
    this.name = "SglocError";
  }
}

/* ---------------- URL base (proteção contra SSRF) ---------------- */

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19));
}

/** Valida e normaliza a URL base. Devolve a URL sem barra final ou lança SglocError("invalid_url"). */
export function validateBaseUrl(raw: string | null | undefined): string {
  const text = (raw ?? "").trim();
  if (!text) throw new SglocError("no_url", "URL base do SGLOC não configurada. Peça ao master para informá-la em Configurações > SGLOC.");
  let url: URL;
  try { url = new URL(text); } catch { throw new SglocError("invalid_url", "URL base inválida. Use o formato https://servidor.exemplo.com.br"); }
  if (url.protocol !== "https:") throw new SglocError("invalid_url", "A URL base precisa começar com https://");
  if (url.username || url.password) throw new SglocError("invalid_url", "A URL base não pode conter usuário ou senha.");
  if (url.search || url.hash) throw new SglocError("invalid_url", "A URL base não pode ter parâmetros (?…) nem âncora (#…).");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".") && !host.startsWith("[")) throw new SglocError("invalid_url", "Endereço interno não permitido na URL base.");
  if (host.startsWith("[") || host.includes(":")) throw new SglocError("invalid_url", "Endereço IPv6 não permitido; use o nome do servidor.");
  if (host === "localhost" || /\.(localhost|local|internal|lan|home|corp)$/.test(host) || host === "metadata.google.internal")
    throw new SglocError("invalid_url", "Endereço interno não permitido na URL base.");
  if (isPrivateIPv4(host)) throw new SglocError("invalid_url", "Endereço de rede privada não permitido na URL base.");
  if (/^\d+$/.test(host) || /^0x/i.test(host)) throw new SglocError("invalid_url", "Endereço numérico não permitido na URL base.");
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.protocol}//${url.host}${path}`;
}

/* ---------------- Classificação de erros ---------------- */

export function classifyHttp(status: number, body: unknown): SglocError | null {
  if (status >= 200 && status < 300) return null;
  if (status === 401) return new SglocError("unauthorized", "Token SGLOC inválido ou expirado. Conecte a conta SGLOC novamente em Minha conta.", status);
  if (status === 404) return new SglocError("not_found", "Endereço não encontrado no SGLOC (404). Confira a URL base.", status);
  if (status === 429) return new SglocError("rate_limited", "O SGLOC limitou as requisições (429). Aguarde e tente de novo.", status);
  if (status === 422 || status === 400) {
    const msg = sglocMessage(body);
    return new SglocError("validation", `O SGLOC recusou os dados (${status})${msg ? `: ${msg}` : "."}`, status);
  }
  if (status >= 500) return new SglocError("server", `O SGLOC está com erro interno (${status}). Tente mais tarde.`, status);
  return new SglocError("http", `O SGLOC respondeu com o código ${status}.`, status);
}

export function classifyNetwork(error: unknown): SglocError {
  const e = error as { name?: string; message?: string } | null;
  if (e?.name === "AbortError" || e?.name === "TimeoutError") return new SglocError("timeout", "Tempo esgotado: o SGLOC não respondeu a tempo.");
  return new SglocError("network", "Sem conexão com o SGLOC (falha de rede, DNS ou certificado).");
}

/** Extrai uma mensagem curta do corpo de erro do SGLOC/Laravel, sem dados extras. */
export function sglocMessage(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const b = body as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof b['message'] === "string") parts.push(b['message']);
  if (b['errors'] && typeof b['errors'] === "object") {
    for (const v of Object.values(b['errors'] as Record<string, unknown>)) {
      if (Array.isArray(v)) parts.push(...v.filter((x): x is string => typeof x === "string"));
      else if (typeof v === "string") parts.push(v);
    }
  }
  return parts.join(" ").replace(/\s+/g, " ").slice(0, 300).trim();
}

/* ---------------- Leitura tolerante ---------------- */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export const str = (v: unknown): string | null => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : null);
export const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
};

export type SglocItem = {
  id: number | null; data: string | null; placa: string | null; contato: string | null; contato_numero: string | null;
  problema: string | null; data_agenda: string | null; hora: string | null; obs: string | null; operador_id: number | null;
  operador_nome: string | null; tipo_agenda: string | null; os_numero: number | null; realizado: string | null; cliente_id: number | null;
  confirmado: string | null; fornecedor_id: number | null; fornecedor_nome: string | null; os_externa: string | null;
  km_agendamento: number | null; marca: string | null; modelo: string | null; loja_id: number | null; loja_codigo: string | null;
};
const NUM_FIELDS = ["id", "operador_id", "os_numero", "cliente_id", "fornecedor_id", "km_agendamento", "loja_id"] as const;
const STR_FIELDS = ["data", "placa", "contato", "contato_numero", "problema", "data_agenda", "hora", "obs", "operador_nome", "tipo_agenda", "realizado", "confirmado", "fornecedor_nome", "os_externa", "marca", "modelo", "loja_codigo"] as const;

export function readItem(raw: unknown): SglocItem {
  const o = isObj(raw) ? raw : {};
  const out = {} as Record<string, unknown>;
  for (const k of NUM_FIELDS) out[k] = num(o[k]);
  for (const k of STR_FIELDS) out[k] = str(o[k]);
  return out as SglocItem;
}

const PAGE_KEYS = ["current_page", "last_page", "total", "per_page", "from", "to", "first_page_url", "last_page_url", "next_page_url", "prev_page_url", "path"];

/** Lê a listagem paginada dentro de qualquer envelope provável. */
export function readList(body: unknown): { items: unknown[]; envelopeKeys: string[]; paginationKeys: string[]; total: number | null; currentPage: number | null; lastPage: number | null; nextPageUrl: boolean } {
  const envelopeKeys = isObj(body) ? Object.keys(body) : Array.isArray(body) ? ["<lista>"] : [];
  let page: Record<string, unknown> | null = null;
  let items: unknown[] = [];
  if (Array.isArray(body)) items = body;
  else if (isObj(body)) {
    const candidates = [body['data'], body];
    for (const c of candidates) {
      if (Array.isArray(c)) { items = c; break; }
      if (isObj(c) && Array.isArray(c['data'])) { items = c['data']; page = c; break; }
    }
  }
  const paginationKeys = page ? Object.keys(page).filter((k) => k !== "data") : [];
  return {
    items, envelopeKeys, paginationKeys: paginationKeys.length ? paginationKeys : PAGE_KEYS.filter((k) => isObj(body) && k in body),
    total: num(page?.['total']), currentPage: num(page?.['current_page']), lastPage: num(page?.['last_page']), nextPageUrl: typeof page?.['next_page_url'] === "string",
  };
}

/** Lê um objeto único (detalhe ou "novo") dentro do envelope. */
export function readObject(body: unknown): Record<string, unknown> {
  if (isObj(body) && isObj(body['data'])) return body['data'];
  return isObj(body) ? body : {};
}

export type SglocOption = { value: string | null; label: string | null };
export function readOptions(body: unknown): Record<string, SglocOption[]> {
  const src = isObj(body) && isObj(body['opcoes']) ? body['opcoes'] : isObj(body) && isObj(body['data']) && isObj(body['data']['opcoes']) ? body['data']['opcoes'] : {};
  const out: Record<string, SglocOption[]> = {};
  for (const [k, v] of Object.entries(src)) {
    out[k] = Array.isArray(v) ? v.map((x) => (isObj(x) ? { value: str(x['value']), label: str(x['label']) } : { value: str(x), label: null })) : [];
  }
  return out;
}

export function readLogin(body: unknown): { token: string | null; expiresAt: string | null; userCode: string | null; email: string | null } {
  const root = isObj(body) && isObj(body['data']) && !("accessToken" in body) ? body['data'] : isObj(body) ? body : {};
  const at = isObj(root['accessToken']) ? root['accessToken'] : {};
  const user = isObj(root['user']) ? root['user'] : {};
  const tokenMeta = isObj(at['token']) ? at['token'] : {};
  const token = str(at['accessToken']) ?? (typeof root['accessToken'] === "string" ? root['accessToken'] : null);
  const exp = str(tokenMeta['expires_at']);
  return { token: token && token.length > 10 ? token : null, expiresAt: exp && !Number.isNaN(Date.parse(exp)) ? new Date(exp).toISOString() : null, userCode: str(user['CODIGOPESSOAL']), email: str(user['EMAIL']) };
}

/* ---------------- Máscara para relatório ---------------- */

const KEEP_KEYS = new Set(["tipo_agenda", "realizado", "confirmado", "loja_id", "loja_codigo", "status", "success", "value", "label"]);

export function jsonType(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

export function maskValue(key: string, v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v;
  if (KEEP_KEYS.has(key)) return typeof v === "object" ? "[objeto]" : v;
  if (typeof v === "number") return key === "id" || key.endsWith("_id") ? v : `${String(v).slice(0, 2)}***`;
  if (typeof v === "string") return v.length === 0 ? "" : `${v.slice(0, 2)}***`;
  if (Array.isArray(v)) return `[lista com ${v.length}]`;
  return "[objeto]";
}

export function describeFields(raw: unknown): { fields: Record<string, string>; samples: Record<string, unknown> } {
  const fields: Record<string, string> = {};
  const samples: Record<string, unknown> = {};
  if (isObj(raw)) for (const [k, v] of Object.entries(raw)) { fields[k] = jsonType(v); samples[k] = maskValue(k, v); }
  return { fields, samples };
}

/** Compara campos do item da listagem com os do detalhe. */
export function compareFields(listItem: unknown, detail: unknown) {
  const a = isObj(listItem) ? listItem : {};
  const b = isObj(detail) ? detail : {};
  const onlyInList = Object.keys(a).filter((k) => !(k in b));
  const onlyInDetail = Object.keys(b).filter((k) => !(k in a));
  const differentType = Object.keys(a).filter((k) => k in b && jsonType(a[k]) !== jsonType(b[k]));
  const differentValue = Object.keys(a).filter((k) => k in b && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  return { onlyInList, onlyInDetail, differentType, differentValue };
}

export function tokenState(expiresAt: string | null | undefined, now = Date.now()): "connected" | "expired" {
  if (!expiresAt) return "connected";
  const t = Date.parse(expiresAt);
  return Number.isNaN(t) || t > now + 30_000 ? "connected" : "expired";
}
