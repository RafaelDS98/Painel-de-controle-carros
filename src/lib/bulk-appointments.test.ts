import { describe, expect, it } from "vitest";
import { batchChanges, batchColumns, batchIdHeader, batchValidation, type BatchRecord } from "./bulk-appointments";

const current: BatchRecord = {
  date: "2026-10-01", time: "09:00", plate: "ABC1234", status: "",
  model: "Modelo", contact: "Contato", workshop: "Oficina", issue: "Revisão",
  note: "", operator: "Operador", external_order: "", current_deadline: null,
};

function spreadsheet(values: BatchRecord) {
  return Object.fromEntries([[batchIdHeader, "99999999-9999-4999-9999-999999999999"],
    ...batchColumns.map(([column, header]) => [header, values[column] ?? ""])]);
}

describe("comparação para edição em lote", () => {
  it("ignora reimportação idêntica e situação não atualizada", () => {
    const row = spreadsheet({ ...current, status: "Não atualizada" });
    expect(batchChanges(row, current)).toEqual({});
  });

  it("altera apenas colunas diferentes e permite limpar o prazo", () => {
    const row = spreadsheet({ ...current, status: "Finalizado", note: "nova nota", current_deadline: null });
    expect(batchChanges(row, { ...current, current_deadline: "2026-10-05" })).toEqual({ status: "Finalizado", note: "nova nota", current_deadline: null });
  });

  it("normaliza data e hora do Excel sem exigir edição", () => {
    const row = spreadsheet(current);
    row["Data Atendimento"] = new Date(2026, 9, 1);
    row.Hora = 9 / 24;
    expect(batchChanges(row, current)).toEqual({});
  });

  it("rejeita situação desconhecida", () => {
    expect(batchValidation({ status: "Outro" })).toBe("Situação inválida.");
  });
});