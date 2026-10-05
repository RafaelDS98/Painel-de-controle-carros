import { describe, expect, it } from "vitest";
import { atendimentoAllowance, editLimitBlockReason } from "./edit-limits";

describe("edit limits", () => {
  it("master ilimitado", () => {
    expect(editLimitBlockReason({ editsUsed: 99, editsAllowed: 1, managerEditsUsed: 99 }, "master", 1)).toBeNull();
  });
  it("atendimento soma extras liberadas", () => {
    expect(atendimentoAllowance(2, 2)).toBe(3);
    expect(editLimitBlockReason({ editsUsed: 2, editsAllowed: 2, managerEditsUsed: 0 }, "atendimento", 2)).toBeNull();
    expect(editLimitBlockReason({ editsUsed: 3, editsAllowed: 2, managerEditsUsed: 0 }, "atendimento", 2)).toContain("3 edição");
  });
  it("atendimento padrão 1", () => {
    expect(editLimitBlockReason({ editsUsed: 1, editsAllowed: 1, managerEditsUsed: 0 }, "atendimento", 1)).not.toBeNull();
  });
  it("gerente usa contador próprio", () => {
    expect(editLimitBlockReason({ editsUsed: 5, editsAllowed: 1, managerEditsUsed: 1 }, "gerente", 2)).toBeNull();
    expect(editLimitBlockReason({ editsUsed: 0, editsAllowed: 1, managerEditsUsed: 2 }, "gerente", 2)).toContain("2 edição");
  });
});
