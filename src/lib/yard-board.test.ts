import { describe, expect, it } from "vitest";
import { buildBoard, inPeriod, parseBoardConfig, sortYard } from "./yard-board";
import type { YardAppointment } from "./yard-utils";

const car = (p: Partial<YardAppointment>): YardAppointment =>
  ({
    dbId: p.plate ?? "x",
    plate: "AAA0000",
    status: "",
    registeredAt: "2026-10-01",
    lastStatusChangeAt: null,
    checkInAt: null,
    forwardedAt: null,
    priorityUrgent: false,
    ...p,
  }) as YardAppointment;

describe("tela principal da oficina", () => {
  it("encaminhado sem entrada vai para Chegando", () => {
    const b = buildBoard(
      [car({ plate: "OZW1234", forwardedAt: "2026-10-21T18:39:00Z" })],
      () => "main",
    );
    expect(b.arriving.map((c) => c.plate)).toEqual(["OZW1234"]);
  });
  it("situação marcada como Pátio sai da tela principal", () => {
    const b = buildBoard(
      [car({ status: "Aguardando peças", checkInAt: "2026-10-20T10:00:00Z" })],
      () => "yard",
    );
    expect(b.working.length + b.ready.length + b.arriving.length).toBe(0);
  });
  it("situação Pronto vai para a coluna de prontos", () => {
    const b = buildBoard([car({ status: "Aguardando retirada" })], () => "ready");
    expect(b.ready).toHaveLength(1);
  });
  it("ordena do mais novo ou do mais antigo conforme a escolha", () => {
    const old = car({ plate: "OLD0001", forwardedAt: "2026-10-01T10:00:00Z" });
    const neu = car({ plate: "NEW0001", forwardedAt: "2026-10-21T10:00:00Z" });
    expect(sortYard([old, neu], "newest")[0]?.plate).toBe("NEW0001");
    expect(sortYard([neu, old], "oldest")[0]?.plate).toBe("OLD0001");
  });
  it("urgente vem primeiro na tela principal", () => {
    const u = car({ plate: "URG0001", priorityUrgent: true, forwardedAt: "2026-10-01T10:00:00Z" });
    const n = car({ plate: "NEW0001", forwardedAt: "2026-10-21T10:00:00Z" });
    expect(sortYard([n, u], "newest", true)[0]?.plate).toBe("URG0001");
  });
  it("Hoje usa o dia de São Paulo", () => {
    const c = car({ forwardedAt: "2026-10-22T01:00:00Z" }); // 21/10 22h em SP
    expect(inPeriod(c, "today", { start: "", end: "" }, new Date("2026-10-21T15:00:00Z"))).toBe(
      true,
    );
  });
  it("Master renomeia coluna; nome vazio volta ao padrão", () => {
    const cfg = parseBoardConfig({
      columns: { arriving: { label: "Novos" }, ready: { label: " " } },
    });
    expect(cfg.columns.arriving.label).toBe("Novos");
    expect(cfg.columns.ready.label).toBe("Prontos / aguardando retirada");
  });
});

import { workType } from "./yard-board";
describe("workType", () => {
  it("classifica serviços", () => {
    expect(workType("Avaria na lateral dianteira")).toBe("Funilaria");
    expect(workType("Pintura do capô")).toBe("Pintura");
    expect(workType("pneu estourado")).toBe("Pneus");
    expect(workType("Revisão de 40.000 km")).toBe("Revisão");
    expect(workType("Bateria descarregada")).toBe("Elétrica");
    expect(workType("vazamento de óleo")).toBe("Manutenção");
  });
});
