import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { fixSheetRange } from "./sheet-range";
import { buildImportRecords } from "./agenda-safety";
import { sglocFixtureRows } from "./sgloc-fixture";

const headers = ["ID", "Data Cadastro", "Data Atendimento", "Hora", "Placa", "Loja", "Modelo", "Contato", "Local/Oficina", "Problemas Relatado", "Observação", "Operador", "O.S Externa", "Realizado", "Tipo", "OS FORNEC"];
const data = [
  ["2001", "2026-10-01", "05/10/2026", "10:30:00", "aaa-1b11", "FI2", "Furgão", "Órgão A", "Oficina X", "Freio", "", "op um", "", '<span class="badge badge-success">Sim</span>', '<span class="badge">Emergencial</span>', "7001"],
  ["2002", "2026-10-01", "2026-10-06", "08:00", "BBB2C22", "FIL", "Picape", "Órgão B", "", "Revisão", "", "OP DOIS", "", "", "Normal", ""],
  ["2003", "2026-10-02", "2026-10-07", "09:15", "CCC3D33", "MAT", "Sedan", "", "Oficina Y", "Pneu", "", "", "", "", "", "7003"],
  ["3 registro(s)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
];

function sglocLikeSheet(rows: unknown[][]) {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]) as Record<string, unknown>;
  sheet["!ref"] = "A1:C1"; // dimensão declarada errada, como no export real
  return sheet;
}
const read = (sheet: Record<string, unknown>) => XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet as XLSX.WorkSheet, { defval: "" });

describe("fixSheetRange", () => {
  it("sem correção lê 0 linhas; com correção lê todas", () => {
    expect(read(sglocLikeSheet(data))).toHaveLength(0);
    const sheet = sglocLikeSheet(data);
    fixSheetRange(sheet, XLSX.utils);
    expect(sheet["!ref"]).toBe("A1:P5");
    const rows = read(sheet);
    expect(rows).toHaveLength(4);
    const { records, skippedEmpty } = buildImportRecords(rows, null, false);
    expect(skippedEmpty).toBe(1);
    expect(records.map((r) => [r.date, r.time, r.plate, r.os_number ?? null, r.schedule_type])).toEqual([
      ["2026-10-05", "10:30", "AAA1B11", 7001, "E"],
      ["2026-10-06", "08:00", "BBB2C22", null, "N"],
      ["2026-10-07", "09:15", "CCC3D33", 7003, "N"],
    ]);
  });
  it("planilha com dimensão correta fica igual", () => {
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...data]) as Record<string, unknown>;
    const before = sheet["!ref"];
    fixSheetRange(sheet, XLSX.utils);
    expect(sheet["!ref"]).toBe(before);
    expect(read(sheet)).toHaveLength(4);
  });
  it("planilha vazia e entradas estranhas não lançam erro", () => {
    const empty: Record<string, unknown> = { "!ref": "A1:C1" };
    expect(() => fixSheetRange(empty, XLSX.utils)).not.toThrow();
    expect(empty["!ref"]).toBe("A1:C1");
    expect(() => fixSheetRange(undefined, XLSX.utils)).not.toThrow();
    expect(read(empty)).toHaveLength(0);
  });
  it("fixture do SGLOC passa pelo caminho de leitura", () => {
    const sheet = XLSX.utils.json_to_sheet(sglocFixtureRows) as Record<string, unknown>;
    sheet["!ref"] = "A1:C1";
    fixSheetRange(sheet, XLSX.utils);
    const { records, skippedEmpty } = buildImportRecords(read(sheet), null, false);
    expect(records).toHaveLength(5);
    expect(skippedEmpty).toBe(1);
    expect(records[0]?.schedule_type).toBe("E");
    expect(records[0]?.os_number).toBe(5501);
  });
});
