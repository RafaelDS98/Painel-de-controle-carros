import { describe, expect, it } from "vitest";
import { brToIso, isoToBr, maskBrDate } from "./date-br";

describe("datas dd/mm/aaaa", () => {
  it("exibe o valor gravado como dia/mês/ano", () => {
    expect(isoToBr("2026-10-05")).toBe("05/10/2026");
  });
  it("converte de volta preservando o valor", () => {
    expect(brToIso("05/10/2026")).toBe("2026-10-05");
  });
  it("rejeita data inexistente", () => {
    expect(brToIso("31/02/2026")).toBeNull();
  });
  it("aplica a máscara ao digitar", () => {
    expect(maskBrDate("05102026")).toBe("05/10/2026");
  });
});
