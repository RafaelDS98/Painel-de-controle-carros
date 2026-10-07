import { describe, expect, it } from "vitest";
import { emptyMovementFilters, eventRows, fieldLabel, formatDuration, hasCriteria, parseResult, passRows, rpcArgs, statusSpans, timeToCompletion, vehicleSummary, type Pass } from "./movements";

const pass = (over: Partial<Pass> = {}): Pass => ({
  id: "1", plate: "ABC1D23", date: "2026-10-01", time: "08:00", created_at: "2026-10-01T10:00:00Z", store: "MAT", workshop: "X", mechanic: null,
  operator: "", issue: "Revisão", service: "Revisão", schedule_type: "N", external_order: "", os_number: null, km: null, original_deadline: null,
  current_deadline: null, urgent: false, rework_of: null, rework_reason: null, note: "", status: "Finalizado", brand: "VW", model: "Polo",
  sector: null, archived: false, rework_original: null,
  events: [
    { field: "status", old: "", new: "Recebido", at: "2026-10-01T11:00:00Z", by: "Ana" },
    { field: "sgloc_reference", old: null, new: "1", at: "2026-10-01T11:00:00Z", by: null },
    { field: "status", old: "Recebido", new: "Finalizado", at: "2026-10-01T13:00:00Z", by: null },
  ], ...over,
});

describe("movimentações", () => {
  it("sem critério não pesquisa; placa normaliza", () => {
    expect(hasCriteria(emptyMovementFilters())).toBe(false);
    expect(hasCriteria({ ...emptyMovementFilters(), plate: " - " })).toBe(false);
    expect(rpcArgs({ ...emptyMovementFilters(), plate: "abc-1d23", urgent: "nao" }, 2)).toMatchObject({ _plate: "ABC1D23", _urgent: false, _page: 2, _status: undefined });
  });
  it("rótulos amigáveis e técnicos escondidos", () => {
    expect(fieldLabel("status")).toBe("Situação");
    expect(fieldLabel("current_deadline")).toBe("Previsão de entrega");
    expect(fieldLabel("sgloc_reference")).toBeNull(); expect(fieldLabel("store_id")).toBeNull();
    expect(fieldLabel("Excluído (Lixeira)")).toBe("Excluído (Lixeira)");
  });
  it("tempo em cada situação e até concluir", () => {
    const s = statusSpans(pass(), Date.parse("2026-10-01T14:00:00Z"));
    expect(s.map((x) => [x.status, x.ms / 60_000])).toEqual([["", 60], ["Recebido", 120], ["Finalizado", 60]]);
    expect(timeToCompletion(pass(), "Finalizado")).toBe(3 * 3600_000);
    expect(timeToCompletion(pass({ events: [] }), "Finalizado")).toBeNull();
    expect(statusSpans(pass({ created_at: "x" }))).toEqual([]);
    expect(formatDuration(90 * 60_000)).toBe("1 h 30 min"); expect(formatDuration(null)).toBe("—");
  });
  it("resumo do veículo e leitura tolerante", () => {
    const r = parseResult({ total_vehicles: 1, total_passes: 2, vehicles: [{ plate_key: "ABC1D23", passes: [pass({ date: "2026-10-05", service: "Freios" }), pass()] }] });
    expect(vehicleSummary(r.vehicles[0]!)).toMatchObject({ count: 2, first: "2026-10-01", last: "2026-10-05", services: ["Freios", "Revisão"], vehicle: "VW / Polo" });
    expect(parseResult(null)).toEqual({ total_vehicles: 0, total_passes: 0, vehicles: [] });
    expect(parseResult({ vehicles: [{ passes: [{ events: null }] }] }).vehicles[0]!.passes[0]!.events).toEqual([]);
  });
  it("exportação protege fórmulas e esconde técnicos", () => {
    const v = [{ plate_key: "A", passes: [pass({ store: "=HYPERLINK(1)" })] }];
    expect(passRows(v, "Finalizado")[0]!["Loja"]).toBe("'=HYPERLINK(1)");
    expect(eventRows(v).map((r) => r["Campo"])).toEqual(["Situação", "Situação"]);
    expect(eventRows(v)[1]!["Quem"]).toMatch(/Sistema/);
  });
});
