import { afterEach, describe, expect, it, vi } from "vitest";
import { diffAppointment, mapSglocItem, maskedSample, nextRunAt, planSync, shouldRunTick, syncWindow, type LocalRow } from "./sync-core";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

const item = (o: Record<string, unknown> = {}) => ({ id: 101, data_agenda: "2026-10-10", placa: "abc-1d23", hora: "09:30", contato: "Ana", problema: "<b>Freio</b>", ...o });
const local = (o: Partial<LocalRow> = {}): LocalRow => ({ id: "l1", sgloc_reference: null, plate: "ABC1D23", date: "2026-10-10", time: "", archived_at: null, sgloc_sync_state: "local_only", sgloc_missing_count: 0, ...o });
const win = { start: "2026-10-01", end: "2026-11-30" };

describe("mapSglocItem", () => {
  it("normaliza placa, hora, HTML e descarta itens inválidos", () => {
    const m = mapSglocItem(item());
    expect("fields" in m && m.fields).toMatchObject({ plate: "ABC1D23", time: "09:30", issue: "Freio", date: "2026-10-10" });
    expect(mapSglocItem({ placa: "X" })).toEqual({ skip: "sem id" });
    expect(mapSglocItem(item({ data_agenda: "lixo" }))).toEqual({ skip: "sem data" });
    expect(mapSglocItem(item({ placa: "" }))).toEqual({ skip: "sem placa" });
    expect(mapSglocItem(null)).toEqual({ skip: "sem id" });
  });
  it("loja pelo sgloc_stores", () => {
    const m = mapSglocItem(item({ loja_id: 3 }), [{ store_id: 3, code: "SP1" }]);
    expect("fields" in m && m.fields.store).toBe("SP1");
  });
});

describe("diffAppointment", () => {
  it("vazio do SGLOC não apaga e só devolve o que mudou", () => {
    expect(diffAppointment({ contact: "Ana", note: "x", plate: "abc-1d23" }, { contact: "Ana", note: null, plate: "ABC1D23", issue: "Freio" })).toEqual({ issue: "Freio" });
  });
});

describe("planSync", () => {
  it("atualiza por sgloc_reference, protege pending/failed e ignora Lixeira", () => {
    const p = planSync({ items: [item(), item({ id: 102 }), item({ id: 103 })], window: win, complete: true, locals: [
      local({ id: "a", sgloc_reference: "101", sgloc_sync_state: "synced", contact: "Bia" }),
      local({ id: "b", sgloc_reference: "102", sgloc_sync_state: "push_failed" }),
      local({ id: "c", sgloc_reference: "103", archived_at: "2026-10-01" }),
    ] });
    expect(p.update.map((u) => u.id)).toEqual(["a"]);
    expect(p.counts).toMatchObject({ updated: 1, protected: 1, created: 0, skipped: 1 });
  });
  it("vincula por placa+data, ambíguo não cria, sem par cria", () => {
    expect(planSync({ items: [item()], locals: [local()], window: win, complete: true }).link[0]?.patch).toMatchObject({ sgloc_reference: "101" });
    const amb = planSync({ items: [item()], locals: [local({ id: "x" }), local({ id: "y" })], window: win, complete: true });
    expect(amb.counts.ambiguous).toBe(1); expect(amb.create).toHaveLength(0);
    expect(planSync({ items: [item()], locals: [], window: win, complete: true }).counts.created).toBe(1);
    expect(planSync({ items: [item()], locals: [local({ time: "14:00" })], window: win, complete: true }).counts.created).toBe(1);
  });
  it("não retornado só dentro da janela e com leitura completa; volta para synced", () => {
    const locals = [local({ id: "in", sgloc_reference: "9", sgloc_sync_state: "synced" }), local({ id: "out", sgloc_reference: "8", date: "2025-01-01", sgloc_sync_state: "synced" }),
      local({ id: "pf", sgloc_reference: "7", sgloc_sync_state: "pending_push" })];
    expect(planSync({ items: [], locals, window: win, complete: true }).notReturned).toEqual([{ id: "in", missing: 1 }]);
    expect(planSync({ items: [], locals, window: win, complete: false }).notReturned).toHaveLength(0);
    const back = planSync({ items: [item({ id: 9 })], locals: [local({ id: "in", sgloc_reference: "9", sgloc_sync_state: "not_returned", sgloc_missing_count: 2 })], window: win, complete: true });
    expect(back.update[0]?.patch).toMatchObject({ sgloc_sync_state: "synced", sgloc_missing_count: 0 });
  });
  it("amostra mascarada sem dados pessoais", () => {
    const s = maskedSample(planSync({ items: [item()], locals: [], window: win, complete: true }));
    expect(JSON.stringify(s)).not.toContain("Ana"); expect(s[0]).toMatchObject({ acao: "criar", placa: "AB***" });
  });
});

describe("agenda", () => {
  const s = { enabled: true, base_url: "https://x.com", interval_minutes: 480, sync_user_id: "u" };
  it("shouldRunTick respeita intervalo, desligado e conta", () => {
    const now = Date.parse("2026-10-05T12:00:00Z");
    expect(shouldRunTick(s, null, now).run).toBe(true);
    expect(shouldRunTick(s, "2026-10-05T09:00:00Z", now).run).toBe(false);
    expect(shouldRunTick(s, "2026-10-05T04:00:00Z", now).run).toBe(true);
    expect(shouldRunTick({ ...s, enabled: false }, null, now).run).toBe(false);
    expect(shouldRunTick({ ...s, sync_user_id: null }, null, now).run).toBe(false);
  });
  it("nextRunAt arredonda ao tick de 15 min", () => {
    expect(nextRunAt(s, "2026-10-05T04:07:00Z", Date.parse("2026-10-05T05:00:00Z"))).toBe("2026-10-05T12:15:00.000Z");
    expect(nextRunAt({ ...s, enabled: false }, null)).toBeNull();
  });
  it("syncWindow", () => expect(syncWindow("2026-10-05", 7, 45)).toEqual({ start: "2026-09-28", end: "2026-11-19" }));
});

describe("rota do tick (authenticateCronRequest)", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("401 sem Bearer ou com segredo errado; passa com o certo", async () => {
    vi.stubEnv("LOVABLE_CRON_SECRET", "segredo-de-teste");
    const req = (h?: string) => new Request("http://x/api/public/hooks/sgloc-sync", { method: "POST", headers: h ? { authorization: h } : {} });
    expect((await authenticateCronRequest(req()))?.status).toBe(401);
    expect((await authenticateCronRequest(req("Bearer errado")))?.status).toBe(401);
    expect(await authenticateCronRequest(req("Bearer segredo-de-teste"))).toBeNull();
  });
});
