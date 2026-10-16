import { describe, expect, it } from "vitest";
import {
  checkAllState,
  hasSelection,
  isSelected,
  removeValue,
  searchRows,
  selectionChips,
  toggleAll,
  toggleSelect,
  toggleValue,
} from "./dashboard-filter";

describe("seleção do dashboard", () => {
  it("clique simples seleciona e o mesmo clique de novo limpa", () => {
    const one = toggleSelect({}, "day", "12/10");
    expect(one.day).toEqual(["12/10"]);
    expect(toggleSelect(one, "day", "12/10").day).toBeUndefined();
    expect(hasSelection(toggleSelect(one, "day", "12/10"))).toBe(false);
  });

  it("Ctrl/Cmd soma itens e retirar um deixa os outros", () => {
    const two = toggleSelect({ day: ["12/10"] }, "day", "13/10", true);
    expect(two.day).toEqual(["12/10", "13/10"]);
    expect(toggleSelect(two, "day", "12/10", true).day).toEqual(["13/10"]);
  });

  it("selecionar num gráfico mantém a seleção do outro (E entre gráficos)", () => {
    const both = toggleSelect({ day: ["12/10"] }, "situation", "Próprio");
    expect(both).toEqual({ day: ["12/10"], situation: ["Próprio"] });
    expect(isSelected(both, "day", "12/10")).toBe(true);
    expect(isSelected(both, "situation", "Próprio")).toBe(true);
  });

  it("caixinha 'todos' marca tudo, limpa no segundo clique e avisa quando são alguns", () => {
    const list = ["ABC1D23", "RWL1D65"];
    expect(checkAllState(list, [])).toBe(false);
    expect(checkAllState(list, ["ABC1D23"])).toBe("partial");
    expect(checkAllState(list, ["abc1d23", "rwl1d65"])).toBe(true);
    expect(toggleAll(list, [])).toEqual(["ABC1D23", "RWL1D65"]);
    expect(toggleAll(list, list)).toEqual([]);
    expect(toggleValue(["ABC1D23"], "RWL1D65")).toEqual(["ABC1D23", "RWL1D65"]);
    expect(toggleValue(["ABC1D23"], "abc1d23")).toEqual([]);
  });

  it("busca do pop-up ignora acento, caixa e hífen da placa", () => {
    const rows = [
      { plate: "ABC1D23", model: "CÉLIO" },
      { plate: "RWL-1D65", model: "Strada" },
    ];
    expect(searchRows(rows, "celio", ["plate", "model"]).map((r) => r.plate)).toEqual(["ABC1D23"]);
    expect(searchRows(rows, "abc-1d23", ["plate", "model"]).map((r) => r.plate)).toEqual([
      "ABC1D23",
    ]);
    expect(searchRows(rows, "rwl", ["plate", "model"]).map((r) => r.plate)).toEqual(["RWL-1D65"]);
    expect(searchRows(rows, "  ", ["plate", "model"])).toHaveLength(2);
    expect(searchRows(rows, "zzz", ["plate", "model"])).toHaveLength(0);
  });

  it("removeValue tira um item e fecha a dimensão quando esvazia", () => {
    const one = removeValue({ vehicle: ["ABC1D23", "RWL1D65"] }, "vehicle", "ABC1D23");
    expect(one.vehicle).toEqual(["RWL1D65"]);
    expect(hasSelection(one, "vehicle")).toBe(true);
    expect(removeValue(one, "vehicle").vehicle).toBeUndefined();
  });

  it("chips trazem rótulo da dimensão e o valor marcado", () => {
    expect(selectionChips({ situation: ["Próprio"] })).toEqual([
      { dim: "situation", value: "Próprio", label: "Situação: Próprio" },
    ]);
  });
});
