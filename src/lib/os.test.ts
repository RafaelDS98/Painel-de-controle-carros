import { describe, expect, it } from "vitest";
import { buildFilters, itemTotal, osDate, parseSearch } from "./os";

describe("ordens de serviço", () => {
  it("total do item = quantidade × valor unitário, arredondado em centavos", () => {
    expect(itemTotal(3, 10.335)).toBe(31.01);
    expect(itemTotal("x", 2)).toBe(0);
  });
  it("busca vazia não quebra", () => {
    expect(parseSearch(null)).toEqual({ rows: [], total: 0 });
  });
  it("filtros vazios não são enviados", () => {
    expect(buildFilters({ plate: " abc ", numero: "" })).toEqual({ plate: "abc" });
  });
  it("data inválida vira traço", () => {
    expect(osDate("x")).toBe("—");
  });
});

import { osConsultaFilters } from "./os";
describe("consulta de O.S.", () => {
  it("'Não finalizadas' vira flag e não filtra por situação", () => {
    expect(osConsultaFilters({ status_id: "nao_finalizadas" })).toEqual({ nao_finalizadas: "1" });
  });
  it("Sim/Não vira verdadeiro/falso e vazios saem", () => {
    expect(osConsultaFilters({ recuperado: "Sim", com_pendencia: "Não", plate: "" })).toEqual({ recuperado: "true", com_pendencia: "false" });
  });
});
