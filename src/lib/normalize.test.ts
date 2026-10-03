import { describe, expect, it } from "vitest";
import { authorLabel, importRowSkipReason, isEmergency, normalizeDate, normalizePlate, normalizeTime, parseKm, safeText, sglocExtras, stripHtml } from "./normalize";

describe("normalizePlate", () => {
  it("apara, maiúsculas e remove símbolos", () => {
    expect(normalizePlate(" abc-1d23 ")).toBe("ABC1D23");
    expect(normalizePlate(null)).toBe("");
    expect(normalizePlate(undefined)).toBe("");
  });
});

describe("normalizeDate", () => {
  it("aceita formatos e serial do Excel", () => {
    expect(normalizeDate("2026-10-03")).toBe("2026-10-03");
    expect(normalizeDate("3/10/2026")).toBe("2026-10-03");
    expect(normalizeDate(new Date(2026, 9, 3))).toBe("2026-10-03");
    expect(normalizeDate(46298)).toBe("2026-10-03");
  });
  it("inválido vira null sem lançar", () => {
    expect(normalizeDate("31/02/2026")).toBeNull();
    expect(normalizeDate("abc")).toBeNull();
    expect(normalizeDate("")).toBeNull();
    expect(normalizeDate(null)).toBeNull();
    expect(normalizeDate(new Date("x"))).toBeNull();
  });
});

describe("normalizeTime", () => {
  it("aceita HH:mm, HH:mm:ss, Date e fração", () => {
    expect(normalizeTime("9:05")).toBe("09:05");
    expect(normalizeTime("14:30:00")).toBe("14:30");
    expect(normalizeTime(new Date(2026, 0, 1, 8, 15))).toBe("08:15");
    expect(normalizeTime(0.375)).toBe("09:00");
  });
  it("inválido vira vazio", () => {
    expect(normalizeTime("25:00")).toBe("");
    expect(normalizeTime("manhã")).toBe("");
    expect(normalizeTime(null)).toBe("");
  });
});

describe("stripHtml e safeText", () => {
  it("remove tags e decodifica entidades", () => {
    expect(stripHtml('<span class="badge badge-success">Sim</span>')).toBe("Sim");
    expect(stripHtml("A &amp; B&nbsp;&lt;C&gt;")).toBe("A & B <C>");
    expect(stripHtml("linha1<br>linha2\r\n  linha3  ")).toBe("linha1\nlinha2\nlinha3");
    expect(stripHtml("x".repeat(500))).toHaveLength(500);
  });
  it("safeText", () => {
    expect(safeText(null)).toBe("");
    expect(safeText("  a ")).toBe("a");
    expect(safeText(12)).toBe("12");
  });
});

describe("filtro de linhas da importação", () => {
  const base = { ID: "123", Placa: "abc1234", Realizado: "<span>Não</span>", Tipo: "Normal", "OS FORNEC": "" };
  it("ignora linha de total, vazia e sem placa; aceita colunas extras", () => {
    expect(importRowSkipReason({ ID: "127 registro(s)", Placa: "" })).toBe("vazia");
    expect(importRowSkipReason({ ID: "", Placa: "  " })).toBe("vazia");
    expect(importRowSkipReason({ ID: "5", Placa: "--" })).toBe("sem placa");
    expect(importRowSkipReason(base)).toBeNull();
  });
  it("mapeia OS FORNEC, Tipo e ID", () => {
    expect(sglocExtras({ ...base, "OS FORNEC": "4567", Tipo: '<span class="badge">EMERGENCIAL</span>' })).toEqual({ os_number: 4567, schedule_type: "E", sgloc_reference: "123" });
    expect(sglocExtras({ ...base, "OS FORNEC": "abc", ID: "X-1" })).toEqual({ os_number: null, schedule_type: "N", sgloc_reference: null });
  });
});

describe("outros", () => {
  it("autor nulo vira Sincronização SGLOC", () => {
    expect(authorLabel(null, null)).toBe("Sincronização SGLOC");
    expect(authorLabel("u1", null)).toBe("Usuário sem nome");
    expect(authorLabel("u1", "Ana")).toBe("Ana");
  });
  it("emergencial e km", () => {
    expect(isEmergency("E")).toBe(true);
    expect(isEmergency("Emergência")).toBe(true);
    expect(isEmergency("N")).toBe(false);
    expect(parseKm("")).toBeNull();
    expect(parseKm("120")).toBe(120);
    expect(parseKm("-1")).toBeUndefined();
    expect(parseKm("1.5")).toBeUndefined();
  });
});
