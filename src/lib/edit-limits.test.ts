import { describe, expect, it } from "vitest";
import { canManageDeadline, deadlineBlockReason } from "./edit-limits";

describe("previsão de entrega", () => {
  it("atendimento e oficina alteram 1 vez com o padrão", () => {
    for (const role of ["atendimento", "oficina"] as const) {
      expect(deadlineBlockReason({ deadlineChangesUsed: 0, deadlineChangesAllowed: 1 }, role)).toBeNull();
      expect(deadlineBlockReason({ deadlineChangesUsed: 1, deadlineChangesAllowed: 1 }, role)).toBe("Já houve 1 alteração da previsão. Peça autorização ao gerente ou master.");
    }
  });
  it("limite do usuário/perfil maior permite mais alterações", () => {
    expect(deadlineBlockReason({ deadlineChangesUsed: 2, deadlineChangesAllowed: 1 }, "atendimento", 3)).toBeNull();
    expect(deadlineBlockReason({ deadlineChangesUsed: 3, deadlineChangesAllowed: 1 }, "atendimento", 3)).toMatch(/3 alterações/);
  });
  it("liberação extra soma ao limite", () => {
    expect(deadlineBlockReason({ deadlineChangesUsed: 1, deadlineChangesAllowed: 2 }, "oficina")).toBeNull();
    expect(deadlineBlockReason({ deadlineChangesUsed: 3, deadlineChangesAllowed: 2 }, "oficina", 2)).not.toBeNull();
  });
  it("gerente e master sem limite", () => {
    expect(deadlineBlockReason({ deadlineChangesUsed: 9, deadlineChangesAllowed: 1 }, "gerente")).toBeNull();
    expect(deadlineBlockReason({ deadlineChangesUsed: 9, deadlineChangesAllowed: 1 }, "master")).toBeNull();
    expect(canManageDeadline("atendimento")).toBe(false);
  });
});
