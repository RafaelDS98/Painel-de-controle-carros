import { describe, expect, it } from "vitest";
import { agendaWarnings, type SyncSnapshot } from "./agenda-freshness";

const now = Date.parse("2026-10-06T13:40:00Z");
const sync = (over: Partial<SyncSnapshot>): SyncSnapshot => ({ syncLive: true, intervalMinutes: 480, last: null, lastRealSuccessAt: "2026-10-06T10:00:00Z", accountWarning: null, ...over });

describe("aviso de agenda desatualizada", () => {
  it("sem problemas não avisa", () => {
    expect(agendaWarnings({ loadedAt: now - 1000, now, loadFailed: false, sync: sync({}) })).toEqual([]);
    expect(agendaWarnings({ loadedAt: now, now, loadFailed: false, sync: null })).toEqual([]);
  });
  it("avisa carga falha ou antiga", () => {
    expect(agendaWarnings({ loadedAt: now - 60_000, now, loadFailed: true, sync: null })[0]).toMatch(/falhou/);
    expect(agendaWarnings({ loadedAt: now - 11 * 60_000, now, loadFailed: false, sync: null })[0]).toMatch(/não é atualizada/);
  });
  it("avisa modo simulação", () => {
    expect(agendaWarnings({ loadedAt: now, now, loadFailed: false, sync: sync({ syncLive: false }) })[0]).toMatch(/simulação/);
  });
  it("avisa falha e atraso da sincronização real", () => {
    const w = agendaWarnings({ loadedAt: now, now, loadFailed: false, sync: sync({ last: { started_at: "2026-10-06T13:00:00Z", status: "failed", dry_run: false, error_detail: [{ message: "Conexão expirada" }] }, lastRealSuccessAt: "2026-10-05T10:00:00Z" }) });
    expect(w.join(" ")).toMatch(/falhou.*Conexão expirada/);
    expect(w.join(" ")).toMatch(/atrasada/);
    expect(agendaWarnings({ loadedAt: now, now, loadFailed: false, sync: sync({ lastRealSuccessAt: null }) })[0]).toMatch(/Nenhuma/);
  });
});

import { agendaChangeToast } from "./agenda-freshness";
describe("aviso de recarga após sincronização", () => {
  it("conta o que entrou e não avisa em simulação", () => {
    expect(agendaChangeToast({ source: "sync", inserted: 4, updated: 1 })).toBe("Agenda atualizada pela sincronização: 4 novo(s), 1 alterado(s).");
    expect(agendaChangeToast({ source: "simulation", inserted: 4 })).toBeNull();
    expect(agendaChangeToast(null)).toBeNull();
  });
});
