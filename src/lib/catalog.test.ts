import { describe, expect, it } from "vitest";
import { canonicalName, catalogKey, filterOptions, missingNames, selectOptions, storeLinkError, type CatalogItem } from "./catalog";

const item = (name: string, active = true, sgloc_id: number | null = null): CatalogItem => ({ id: name, kind: "store", name, active, sgloc_id });

describe("listas de seleção", () => {
  it("normaliza sem acento, caixa e espaços extras", () => {
    expect(catalogKey("  Oficina   X ")).toBe(catalogKey("OFICINA X"));
    expect(catalogKey("CÉLIO")).toBe(catalogKey("celio"));
  });
  it("select mostra ativos em ordem e mantém valor inativo do registro", () => {
    const items = [item("MAT"), item("FI2"), item("Velha", false)];
    expect(selectOptions(items, "")).toEqual(["FI2", "MAT"]);
    expect(selectOptions(items, "velha")).toEqual(["FI2", "MAT", "velha"]);
    expect(selectOptions(items, "mat")).toEqual(["FI2", "MAT"]);
  });
  it("filtros juntam lista e registros sem duplicar", () => {
    expect(filterOptions([item("Oficina X")], ["OFICINA X ", "Outra", "(sem valor)"])).toEqual(["Oficina X", "Outra", "(sem valor)"]);
  });
  it("só cria o que falta, uma vez por nome normalizado", () => {
    expect(missingNames([item("MAT")], ["mat", "Nova", " NOVA ", ""])).toEqual(["Nova"]);
    expect(canonicalName([item("MAT")], " mat ")).toBe("MAT");
  });
  it("loja sem ID SGLOC bloqueia o envio com mensagem clara", () => {
    expect(storeLinkError("", [])).toBeNull();
    expect(storeLinkError("mat", [{ name: "MAT", sgloc_id: 1 }])).toBeNull();
    expect(storeLinkError("acb", [{ name: "acb", sgloc_id: null }])).toMatch(/sem vínculo SGLOC/);
    expect(storeLinkError("xyz", [])).toMatch(/sem vínculo SGLOC/);
  });
});

import { canManageCatalog, deleteConfirmText } from "./catalog";
describe("gestão das listas", () => {
  it("só master e gerente gerenciam", () => {
    expect(canManageCatalog("master")).toBe(true); expect(canManageCatalog("gerente")).toBe(true);
    expect(canManageCatalog("atendimento")).toBe(false); expect(canManageCatalog("oficina")).toBe(false);
  });
  it("confirmação mostra uso e avisa setor", () => {
    expect(deleteConfirmText("store", "MAT", 3)).toMatch(/3 agendamento\(s\)/);
    expect(deleteConfirmText("sector", "Oficina", 2)).toMatch(/2 usuário\(s\).*sem setor/);
    expect(deleteConfirmText("brand", "X", NaN)).toMatch(/0 agendamento/);
  });
});
