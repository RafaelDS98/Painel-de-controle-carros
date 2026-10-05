import { describe, expect, it } from "vitest";
import { canManageDeadline, deadlineBlockReason, editLimitBlockReason } from "./edit-limits";

describe("previsão de entrega", () => {
  it("atendimento e oficina alteram 1 vez", () => {
    for (const role of ["atendimento", "oficina"] as const) {
      expect(deadlineBlockReason({ deadlineChangesUsed: 0, deadlineChangesAllowed: 1 }, role)).toBeNull();
      expect(deadlineBlockReason({ deadlineChangesUsed: 1, deadlineChangesAllowed: 1 }, role)).toBe("Já houve 1 alteração da previsão. Peça autorização ao gerente ou master.");
    }
  });
  it("liberação extra permite nova alteração", () => {
    expect(deadlineBlockReason({ deadlineChangesUsed: 1, deadlineChangesAllowed: 2 }, "oficina")).toBeNull();
  });
  it("gerente e master sem limite", () => {
    expect(deadlineBlockReason({ deadlineChangesUsed: 9, deadlineChangesAllowed: 1 }, "gerente")).toBeNull();
    expect(deadlineBlockReason({ deadlineChangesUsed: 9, deadlineChangesAllowed: 1 }, "master")).toBeNull();
    expect(canManageDeadline("atendimento")).toBe(false);
  });
  it("demais campos nunca bloqueiam", () => {
    expect(editLimitBlockReason()).toBeNull();
  });
});
