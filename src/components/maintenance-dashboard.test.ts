import { describe, expect, it } from "vitest";
import { deadlineState } from "./maintenance-dashboard";

describe("avisos de prazo", () => {
  const today = "2026-09-28";
  it("não sinaliza atraso quando não há prazo", () => {
    expect(deadlineState({ status: "Recebido", currentDeadline: null }, undefined, today)).toBeNull();
  });
  it("sinaliza prazo vencido, vencimento hoje e prazo futuro", () => {
    expect(deadlineState({ status: "Recebido", currentDeadline: "2026-09-27" }, undefined, today)).toBe("overdue");
    expect(deadlineState({ status: "Peça", currentDeadline: today }, undefined, today)).toBe("today");
    expect(deadlineState({ status: "Em execução", currentDeadline: "2026-09-29" }, undefined, today)).toBe("onTime");
  });
  it("compara a data local de conclusão com o prazo", () => {
    const finished = { status: "Finalizado" as const, currentDeadline: "2026-09-28" };
    expect(deadlineState(finished, "2026-09-29T02:59:00Z", today)).toBe("deliveredOnTime");
    expect(deadlineState(finished, "2026-09-29T03:01:00Z", today)).toBe("deliveredLate");
    expect(deadlineState(finished, undefined, today)).toBeNull();
  });
});
import { comparePriority } from "./maintenance-dashboard";
describe("ordenação por prioridade", () => {
  it("coloca urgentes e atrasados antes dos demais", () => {
    const base = { status: "", priorityUrgent: false, date: "2026-09-28", time: "09:00" };
    const rows = [
      { ...base, plate: "SEM", currentDeadline: null },
      { ...base, plate: "FUT", currentDeadline: "2026-10-05" },
      { ...base, plate: "HOJE", currentDeadline: "2026-09-28" },
      { ...base, plate: "ATR", currentDeadline: "2026-09-20" },
      { ...base, plate: "URG", currentDeadline: null, priorityUrgent: true },
      { ...base, plate: "URGFIM", currentDeadline: null, priorityUrgent: true, status: "Finalizado" },
    ];
    const order = [...rows].sort((a, b) => comparePriority(a, b, "2026-09-28", "Finalizado")).map((r) => r.plate);
    expect(order).toEqual(["URG", "ATR", "HOJE", "FUT", "SEM", "URGFIM"]);
  });
});
