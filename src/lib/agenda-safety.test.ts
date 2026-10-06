import { describe, expect, it } from "vitest";
import {
  DASH, EMPTY_OPTION, buildImportRecords, clampPage, compareDateTime, countBy, csvEscape, dash, dropExistingReferences,
  exportHeaders, exportRows, foldedOptions, formatDateBR, formatDateTimeBR, groupWeek, guardFormula, inPeriod,
  matchesFilter, safeAverage, serviceCategory, textMatches, toCsv,
} from "./agenda-safety";
import { sglocFixtureIssue, sglocFixtureRows } from "./sgloc-fixture";

const imported = buildImportRecords(sglocFixtureRows, null, false);
const items = imported.records.map((r) => ({
  id: r.sheet_id, date: r.date ?? "", time: r.time ?? "", plate: r.plate, status: r.status ?? "", model: r.model ?? "",
  contact: r.contact ?? "", workshop: r.workshop ?? "", issue: r.issue ?? "", note: r.note ?? "", operator: r.operator ?? "",
  externalOrder: r.external_order ?? "", osNumber: r.os_number, sglocReference: r.sgloc_reference,
  sgloc_sync_state: "local_only", sgloc_last_error: "boom",
}));

describe("fixture do SGLOC na importação", () => {
  it("ignora a linha de total e mantém as 5 linhas válidas", () => {
    expect(imported.records).toHaveLength(5);
    expect(imported.skippedEmpty).toBe(1);
  });
  it("normaliza placa, data, hora, HTML e extras", () => {
    const [first, second, , fourth, fifth] = imported.records;
    expect(first?.plate).toBe("ABC1D23");
    expect(first?.date).toBe("2026-10-05");
    expect(first?.time).toBe("10:30");
    expect(first?.schedule_type).toBe("E");
    expect(first?.os_number).toBe(5501);
    expect(first?.sgloc_reference).toBe("1001");
    expect(first?.issue).toBe(sglocFixtureIssue);
    expect(first?.issue).toHaveLength(193);
    expect(first?.workshop).toHaveLength(40);
    expect(second?.workshop).toBe("");
    expect(second?.os_number ?? null).toBeNull();
    expect(second?.schedule_type).toBe("N");
    expect(fourth?.contact).toBe("");
    expect(fifth?.date).toBeNull();
    expect(fifth?.time).toBe("");
  });
  it("mesma placa 3 vezes com IDs diferentes; ID já existente é ignorado", () => {
    expect(imported.records.filter((r) => r.plate === "ABC1D23").map((r) => r.sgloc_reference)).toEqual(["1001", "1002", "1003"]);
    const { kept, skippedExisting } = dropExistingReferences(imported.records, ["1002"]);
    expect(kept).toHaveLength(4);
    expect(skippedExisting).toBe(1);
  });
});

describe("filtros, ordenação e agrupamento", () => {
  it("operador e oficina sem diferenciar caixa/acentos", () => {
    expect(items.filter((i) => matchesFilter(i.operator, "Maria Exemplo"))).toHaveLength(2);
    expect(items.filter((i) => matchesFilter(i.workshop, "OFICINA MODELO SUL"))).toHaveLength(2);
    expect(foldedOptions(items.map((i) => i.operator))).toEqual(["João Teste", "maria exemplo", EMPTY_OPTION]);
    expect(items.filter((i) => matchesFilter(i.workshop, EMPTY_OPTION))).toHaveLength(2);
  });
  it("busca textual com campos vazios", () => {
    expect(items.filter((i) => textMatches("suspensao", [i.issue, i.contact, i.model, i.note]))).toHaveLength(1);
    expect(() => textMatches("x", [null, undefined, ""])).not.toThrow();
  });
  it("período exclui sem data, mas sem período inclui tudo", () => {
    expect(items.filter((i) => inPeriod(i.date, "2026-10-05", "2026-10-10"))).toHaveLength(4);
    expect(items.filter((i) => inPeriod(i.date, "", ""))).toHaveLength(5);
  });
  it("ordenação por data deixa nulos por último nos dois sentidos", () => {
    const asc = [...items].sort((a, b) => compareDateTime(a, b, true));
    const desc = [...items].sort((a, b) => compareDateTime(a, b, false));
    expect(asc.at(-1)?.plate).toBe("QWE4R56");
    expect(desc.at(-1)?.plate).toBe("QWE4R56");
    expect(asc[0]?.date).toBe("2026-10-05");
    expect(compareDateTime({ date: "2026-10-07", time: "09:00" }, { date: "2026-10-07", time: "texto" })).toBe(-1);
  });
  it("grade semanal com grupo Sem data", () => {
    const week = groupWeek(items, "2026-10-05", "2026-10-10");
    expect(week.noDate.map((i) => i.plate)).toEqual(["QWE4R56"]);
    expect(week.days[0]).toHaveLength(1);
    expect(week.days[2]).toHaveLength(2); // dois veículos na quarta às 09:00
  });
  it("paginação com zero resultados e página maior que o total", () => {
    expect(clampPage(3, 0, 8)).toEqual({ pages: 1, current: 1 });
    expect(clampPage(9, 10, 8)).toEqual({ pages: 2, current: 2 });
  });
});

describe("KPIs, gráficos e exibição", () => {
  it("conjunto vazio não gera NaN", () => {
    expect(safeAverage(0, 0)).toBe(0);
    expect(countBy([], (x: { a: string }) => x.a)).toEqual([]);
  });
  it("KPIs do fixture", () => {
    const withDate = items.filter((i) => i.date);
    expect(safeAverage(withDate.length, new Set(withDate.map((i) => i.date)).size)).toBeCloseTo(4 / 3);
    expect(countBy(items, (i) => i.operator).find((r) => r.name === "maria exemplo")?.value).toBe(2);
    expect(countBy(items, (i) => i.contact).some((r) => r.name === DASH)).toBe(true);
    expect(items.map((i) => serviceCategory(i.issue))).toEqual(["Suspensão", "Revisão", "Freios", "Corretiva", "Corretiva"]);
    expect(serviceCategory(null)).toBe("Corretiva");
  });
  it("formatação nunca mostra undefined/null/Invalid Date", () => {
    for (const v of [null, undefined, "", "null", "undefined", Number.NaN]) expect(dash(v)).toBe(DASH);
    expect(formatDateBR("2026-10-05")).toBe("05/10/2026");
    expect(formatDateBR(null)).toBe(DASH);
    expect(formatDateBR("lixo")).toBe(DASH);
    expect(formatDateTimeBR("não é data")).toBe(DASH);
  });
});

describe("exportação", () => {
  it("escapa aspas, vírgula, ponto e vírgula e quebra de linha", () => {
    expect(csvEscape('a "b", c')).toBe('"a ""b"", c"');
    expect(csvEscape("linha 1\nlinha 2")).toBe('"linha 1\nlinha 2"');
    expect(csvEscape("x;y")).toBe('"x;y"');
    expect(csvEscape(null)).toBe("");
  });
  it("protege contra fórmula", () => {
    expect(guardFormula("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(guardFormula("+55")).toBe("'+55");
    expect(guardFormula("-retorno")).toBe("'-retorno");
    expect(guardFormula("@x")).toBe("'@x");
    expect(guardFormula("normal")).toBe("normal");
  });
  it("CSV do fixture sem colunas técnicas e com nulos vazios", () => {
    const rows = exportRows(items);
    const csv = toCsv(rows, exportHeaders);
    expect(csv).not.toMatch(/sgloc_sync_state|sgloc_last_error|boom|undefined|null/);
    expect(csv).toContain('"Cliente pediu ""urgente"", retirar até 17h, sem lavagem"');
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'-retorno");
    expect(rows[4]?.["Data Atendimento"]).toBe("");
    expect(rows[0]?.["Problemas Relatado"]).toContain("\n");
  });
});

import { buildImportRecords as buildRecs, importErrorReason as reason } from "./agenda-safety";
describe("importação manual: linhas e motivos", () => {
  it("guarda a linha da planilha de cada registro criado", () => {
    const rows = [{ ID: "1123", Placa: "QEA1B23", "Data Atendimento": "05/10/2026", Hora: "08:00" }, { ID: "", Placa: "" }, { ID: "9", Placa: "abc-1234", "Data Atendimento": "2026-10-06", Hora: "9:30" }];
    const { records, lines, skippedEmpty } = buildRecs(rows, null, false);
    expect(lines).toEqual([2, 4]);
    expect(skippedEmpty).toBe(1);
    expect(records[0]).toMatchObject({ plate: "QEA1B23", date: "2026-10-05", time: "08:00", status: "", sgloc_reference: "1123" });
  });
  it("traduz erros do banco", () => {
    expect(reason({ code: "23505" })).toMatch(/já cadastrado/);
    expect(reason({ code: "42501" })).toMatch(/permissão/);
    expect(reason(null)).toMatch(/desconhecido/);
  });
});
