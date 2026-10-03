import { describe, expect, it } from "vitest";
import { inPeriod } from "./agenda-safety";
import { applySelection, selectionChips, toggleSelection, removeSelection, type ChartSelection } from "./chart-selection";

const rows = [
  { id: 1, date: "2026-09-29", time: "08:30", workshop: "Arrais", contact: "SESMA", issue: "freio", model: "TORO" },
  { id: 2, date: "2026-09-29", time: "09:00", workshop: "Fenix", contact: "SEAP", issue: "revisão", model: "KWID" },
  { id: 3, date: "2026-09-30", time: "08:30", workshop: "ARRAIS", contact: "SEAP", issue: "freio", model: "TORO" },
  { id: 4, date: null, time: "", workshop: "", contact: "", issue: "", model: "" },
];
const ids = (r: typeof rows) => r.map((x) => x.id);

describe("seleção dos gráficos", () => {
  it("alterna, troca e limpa", () => {
    let s: ChartSelection = toggleSelection({}, "weekday", "Ter");
    expect(s).toEqual({ weekday: ["Ter"] });
    expect(toggleSelection(s, "weekday", "Qua")).toEqual({ weekday: ["Qua"] });
    s = toggleSelection(s, "weekday", "Ter");
    expect(s).toEqual({});
  });
  it("multisseleção com Ctrl soma e retira (OU)", () => {
    let s = toggleSelection({}, "weekday", "Ter");
    s = toggleSelection(s, "weekday", "Qua", true);
    expect(ids(applySelection(rows, s))).toEqual([1, 2, 3]);
    s = toggleSelection(s, "weekday", "Ter", true);
    expect(s).toEqual({ weekday: ["Qua"] });
  });
  it("entre gráficos é E e o próprio gráfico não se filtra", () => {
    const s: ChartSelection = { weekday: ["Ter"], service: ["Freios"] };
    expect(ids(applySelection(rows, s))).toEqual([1]);
    expect(ids(applySelection(rows, s, "weekday"))).toEqual([1, 3]);
    expect(ids(applySelection(rows, { workshop: ["arrais"] }))).toEqual([1, 3]);
  });
  it("sem data fica fora quando há seleção de dia; chips e remoção", () => {
    expect(ids(applySelection(rows, { weekday: ["Ter"] }))).not.toContain(4);
    expect(selectionChips({ weekday: ["Ter"] })[0]?.label).toBe("Dia: Ter");
    expect(removeSelection({ weekday: ["Ter", "Qua"] }, "weekday", "Ter")).toEqual({ weekday: ["Qua"] });
  });
  it("combina com o filtro de período", () => {
    const period = rows.filter((r) => inPeriod(r.date, "2026-09-30", "2026-09-30"));
    expect(ids(applySelection(period, { service: ["Freios"] }))).toEqual([3]);
  });
});
