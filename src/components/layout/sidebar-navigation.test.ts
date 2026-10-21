import { describe, expect, it } from "vitest";
import { canSeeNavigation, consultasSearch, isNavigationChildActive } from "./sidebar-navigation";

describe("subtelas do menu respeitam permissões", () => {
  it("oculta O.S. sem module.os mesmo com acesso à frota", () => {
    expect(canSeeNavigation(new Set(["module.veiculos"]), "module.os")).toBe(false);
  });
  it("mostra O.S. com permissão explícita", () => {
    expect(canSeeNavigation(new Set(["module.os"]), "module.os")).toBe(true);
  });
  it("oculta Consultas se nenhuma consulta estiver permitida", () => {
    expect(canSeeNavigation(new Set(), undefined, ["module.veiculos", "module.os"])).toBe(false);
  });
  it("Consultas leva a O.S. quando frota está negada", () => {
    expect(consultasSearch(new Set(["module.os"]))).toEqual({ tab: "consultas-os" });
  });
  it("Consultas leva a veículos quando frota está permitida", () => {
    expect(consultasSearch(new Set(["module.veiculos"]))).toEqual({ tab: "consultas" });
  });
  it("o mesmo item Consultas continua ativo nas duas telas internas", () => {
    expect(isNavigationChildActive("/", "/", { tab: "consultas" }, { tab: "consultas" })).toBe(
      true,
    );
    expect(isNavigationChildActive("/", "/", { tab: "consultas-os" }, { tab: "consultas" })).toBe(
      true,
    );
    expect(isNavigationChildActive("/", "/", { tab: "oficina" }, { tab: "consultas" })).toBe(false);
  });
});
