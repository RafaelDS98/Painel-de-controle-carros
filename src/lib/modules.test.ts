import { describe, expect, it } from "vitest";
import { knownModules, landingPath } from "./modules";

describe("modules", () => {
  it("ignora módulos desconhecidos e valores inválidos", () => {
    expect(knownModules(["oficina", "futuro", "agenda"])).toEqual(["agenda", "oficina"]);
    expect(knownModules(null)).toEqual([]);
  });
  it("escolhe a primeira tela disponível", () => {
    expect(landingPath(["oficina"])).toBe("/oficina");
    expect(landingPath(["historicos", "oficina"])).toBe("/historicos");
    expect(landingPath([])).toBeNull();
  });
});
