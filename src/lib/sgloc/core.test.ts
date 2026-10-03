import { describe, expect, it } from "vitest";
import { composeLoginError, classifyHttp, classifyNetwork, compareFields, describeFields, describeResponseDetail, maskValue, readItem, readList, readLogin, readOptions, SglocError, tokenState, validateBaseUrl } from "./core";

const bad = (u: string) => { try { validateBaseUrl(u); return null; } catch (e) { return (e as SglocError).kind; } };

describe("URL base (SSRF)", () => {
  it("aceita https público e remove barra final", () => {
    expect(validateBaseUrl(" https://sgloc.exemplo.com.br/ ")).toBe("https://sgloc.exemplo.com.br");
    expect(validateBaseUrl("https://exemplo.com/sistema//")).toBe("https://exemplo.com/sistema");
  });
  it("recusa vazio, http, credenciais, internos e IPs privados", () => {
    expect(bad("")).toBe("no_url");
    expect(bad("http://exemplo.com")).toBe("invalid_url");
    expect(bad("https://user:pw@exemplo.com")).toBe("invalid_url");
    for (const u of ["https://localhost", "https://127.0.0.1", "https://10.0.0.5", "https://192.168.1.1", "https://172.20.0.1", "https://169.254.169.254", "https://[::1]", "https://metadata.google.internal", "https://intranet", "https://2130706433", "https://exemplo.com?x=1", "nao é url"])
      expect(bad(u)).toBe("invalid_url");
  });
});

describe("classificação de erros", () => {
  it("mapeia status HTTP", () => {
    expect(classifyHttp(200, {})).toBeNull();
    expect(classifyHttp(401, { message: "Unauthenticated." })?.kind).toBe("unauthorized");
    expect(classifyHttp(404, null)?.kind).toBe("not_found");
    const v = classifyHttp(422, { message: "Dados inválidos", errors: { placa: ["A placa é obrigatória."] } });
    expect(v?.kind).toBe("validation");
    expect(v?.message).toContain("A placa é obrigatória.");
    expect(classifyHttp(503, "x")?.kind).toBe("server");
    expect(classifyHttp(418, null)?.kind).toBe("http");
  });
  it("mapeia falhas de rede e tempo esgotado", () => {
    expect(classifyNetwork(Object.assign(new Error("x"), { name: "AbortError" })).kind).toBe("timeout");
    expect(classifyNetwork(new TypeError("fetch failed")).kind).toBe("network");
  });
});

describe("leitura tolerante", () => {
  it("lê item com campos faltando, extras e tipos estranhos", () => {
    const it1 = readItem({ id: "12", placa: "ABC1D23", km_agendamento: "abc", extra: 1, loja_id: 3, hora: { x: 1 } });
    expect(it1.id).toBe(12); expect(it1.km_agendamento).toBeNull(); expect(it1.hora).toBeNull(); expect(it1.modelo).toBeNull();
    expect(readItem(null).id).toBeNull();
  });
  it("encontra a lista em envelopes diferentes", () => {
    const paged = { success: true, data: { current_page: 1, data: [{ id: 1 }], total: 9, last_page: 2, next_page_url: "u" }, status: 200 };
    const r = readList(paged);
    expect(r.items).toHaveLength(1); expect(r.total).toBe(9); expect(r.envelopeKeys).toEqual(["success", "data", "status"]); expect(r.paginationKeys).toContain("current_page");
    expect(readList({ data: [{ id: 1 }, { id: 2 }] }).items).toHaveLength(2);
    expect(readList([{ id: 1 }]).items).toHaveLength(1);
    expect(readList("html").items).toHaveLength(0);
  });
  it("lê opções e login", () => {
    expect(readOptions({ opcoes: { realizado: [{ value: "S", label: "Sim" }], tipo_agenda: "x" } })).toEqual({ realizado: [{ value: "S", label: "Sim" }], tipo_agenda: [] });
    const l = readLogin({ user: { CODIGOPESSOAL: "77", EMAIL: "a@b.c" }, accessToken: { accessToken: "tok-1234567890", token: { expires_at: "2027-01-01T00:00:00Z" } } });
    expect(l).toEqual({ token: "tok-1234567890", expiresAt: "2027-01-01T00:00:00.000Z", userCode: "77", email: "a@b.c" });
    expect(readLogin({}).token).toBeNull();
  });
  it("estado do token", () => {
    expect(tokenState("2000-01-01T00:00:00Z")).toBe("expired");
    expect(tokenState("2999-01-01T00:00:00Z")).toBe("connected");
  });
});

describe("máscara", () => {
  it("mantém códigos/enumerações e IDs, mascara o resto", () => {
    expect(maskValue("placa", "ABC1D23")).toBe("AB***");
    expect(maskValue("operador_nome", "Maria")).toBe("Ma***");
    expect(maskValue("realizado", "S")).toBe("S");
    expect(maskValue("loja_codigo", "FI2")).toBe("FI2");
    expect(maskValue("cliente_id", 55)).toBe(55);
    expect(maskValue("km_agendamento", 12345)).toBe("12***");
    expect(maskValue("obs", null)).toBeNull();
    const d = describeFields({ id: 1, contato_numero: "11999990000", tipo_agenda: "E" });
    expect(d.fields).toEqual({ id: "number", contato_numero: "string", tipo_agenda: "string" });
    expect(d.samples).toEqual({ id: 1, contato_numero: "11***", tipo_agenda: "E" });
  });
  it("compara listagem e detalhe", () => {
    expect(compareFields({ id: 1, loja_codigo: "X", a: "1" }, { id: 1, a: 1 })).toEqual({ onlyInList: ["loja_codigo"], onlyInDetail: [], differentType: ["a"], differentValue: ["a"] });
  });
});

describe("diagnóstico do login", () => {
  it("JSON: mostra mensagem, content-type e só as chaves (sem valores)", () => {
    const d = describeResponseDetail(true, "application/json; charset=UTF-8", { message: "Credenciais incorretas", extra: "segredo" }, "{}");
    expect(d).toBe("Resposta do SGLOC: Credenciais incorretas [application/json; charset=UTF-8; chaves: message, extra]");
    expect(d).not.toContain("segredo");
    expect(describeResponseDetail(true, null, {}, "x")).toBe("Resposta do SGLOC: (sem mensagem no corpo) [sem content-type]");
  });
  it("JSON: message limitada a 300 caracteres", () => {
    const d = describeResponseDetail(true, "application/json", { message: "x".repeat(400) }, "");
    expect(d.startsWith("Resposta do SGLOC: ")).toBe(true);
    expect(d).toContain("chaves: message");
    expect(d.length).toBeLessThan("Resposta do SGLOC: ".length + 320 + 60);
  });
  it("não JSON: diz que não é JSON e mostra até 120 caracteres sem HTML", () => {
    const html = `<html><body>Erro ${"x".repeat(300)}</body></html>`;
    const d = describeResponseDetail(false, "text/html", null, html);
    expect(d.startsWith("Resposta do SGLOC não é JSON [text/html]: ")).toBe(true);
    expect(d).not.toContain("<html");
    expect(d.length - d.indexOf(":") - 1).toBeLessThanOrEqual(125);
    expect(describeResponseDetail(false, null, null, "")).toContain("(corpo vazio)");
  });
  it("composeLoginError junta motivo e diagnóstico; sem diagnóstico fica como antes", () => {
    const com = new SglocError("unauthorized", "base", 401);
    com.diagnostic = describeResponseDetail(true, "application/json", { message: "Credenciais incorretas" }, "{}");
    expect(composeLoginError(com)).toBe("E-mail ou senha do SGLOC recusados (401). Resposta do SGLOC: Credenciais incorretas [application/json; chaves: message]");
    expect(composeLoginError(new SglocError("unauthorized", "base", 401))).toBe("E-mail ou senha do SGLOC recusados (401).");
    const nf = new SglocError("not_found", "Endereço não encontrado no SGLOC (404).", 404);
    nf.diagnostic = "Resposta do SGLOC: (sem mensagem no corpo) [text/html]";
    expect(composeLoginError(nf)).toBe("Endereço não encontrado no SGLOC (404). Resposta do SGLOC: (sem mensagem no corpo) [text/html]");
  });
});
