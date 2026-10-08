import { describe, expect, it } from "vitest";
import { logExportRows, plateFromParam } from "./history-log";

describe("history-log", () => {
  it("exporta com rótulos, autor do sistema e proteção de fórmula", () => {
    const rows = logExportRows([
      { changed_at: "2026-10-05T12:00:00Z", changed_by: null, field_changed: "status", old_value: null, new_value: "=SOMA(A1)", profiles: null, appointments: { plate: "ABC1D23" } },
      { changed_at: "invalido", changed_by: "u1", field_changed: "x_custom", old_value: "a", new_value: "b", profiles: { full_name: "Ana" }, appointments: null },
    ], { status: "Situação" });
    expect(rows[0]).toMatchObject({ Usuário: "Sincronização SGLOC ou usuário excluído", Campo: "Situação", "Valor anterior": "", "Novo valor": "'=SOMA(A1)", Placa: "ABC1D23" });
    expect(rows[1]).toMatchObject({ Usuário: "Ana", Campo: "x_custom", Placa: "" });
  });
  it("normaliza a placa da URL", () => {
    expect(plateFromParam("abc-1d23")).toBe("ABC1D23");
    expect(plateFromParam(undefined)).toBe("");
  });
});
