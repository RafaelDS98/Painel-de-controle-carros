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
    expect(osConsultaFilters({ recuperado: "Sim", com_pendencia: "Não", plate: "" })).toEqual({
      recuperado: "true",
      com_pendencia: "false",
    });
  });
});

import { canCancelOs, isClosedStatus, manualStatusOptions, scopeFilters } from "./os";

describe("encerramento de O.S.", () => {
  it("só Master e Gerente cancelam", () => {
    expect(canCancelOs("master")).toBe(true);
    expect(canCancelOs("gerente")).toBe(true);
    expect(canCancelOs("atendimento")).toBe(false);
    expect(canCancelOs("oficina")).toBe(false);
  });
  it("Finalizada (7) e Cancelada (3) são encerradas; Aguardando retirada (8) não", () => {
    expect(isClosedStatus(7)).toBe(true);
    expect(isClosedStatus(3)).toBe(true);
    expect(isClosedStatus(8)).toBe(false);
  });
  it("troca manual não oferece Finalizada/Cancelada", () => {
    expect(
      manualStatusOptions([{ id: 1 }, { id: 3 }, { id: 7 }, { id: 8 }]).map((s) => s.id),
    ).toEqual([1, 8]);
  });
  it("Em aberto esconde encerradas e o histórico separa finalizadas de canceladas", () => {
    expect(scopeFilters("abertas", {})).toEqual({ nao_finalizadas: "1" });
    expect(scopeFilters("finalizadas", {})).toEqual({ status_id: "7" });
    expect(scopeFilters("canceladas", {})).toEqual({ status_id: "3" });
    expect(scopeFilters("encerradas", { status_id: "1" })).toEqual({ status_id: "3,7" });
  });
});
