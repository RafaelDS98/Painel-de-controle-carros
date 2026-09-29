import { describe, expect, it } from "vitest";
import { periodRange, pendingDeliveries } from "./agenda-period";

describe("atalhos de período", () => {
  it("define hoje e a semana de segunda a sábado", () => {
    expect(periodRange("today", "2026-09-29")).toEqual({ start: "2026-09-29", end: "2026-09-29" });
    expect(periodRange("week", "2026-09-29")).toEqual({ start: "2026-09-28", end: "2026-10-03" });
  });
  it("usa primeiro e último dia do mês inclusive em ano bissexto", () => {
    expect(periodRange("month", "2028-02-14")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });
  it("conta apenas agendamentos não finalizados dentro do período", () => {
    expect(pendingDeliveries([{ date: "2026-09-29", status: "" }, { date: "2026-09-29", status: "Finalizado" }, { date: "2026-10-01", status: "Recebido" }], "2026-09-29", "2026-09-29")).toBe(1);
  });
});