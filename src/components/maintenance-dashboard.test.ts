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