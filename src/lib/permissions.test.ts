import { describe, expect, it } from "vitest";
import { permissionDefault } from "./permissions";

describe("permissões padrão por perfil", () => {
  it("master e gerente gerenciam notícias; atendimento e oficina não", () => {
    expect(permissionDefault("master", "action.news_create")).toBe(true);
    expect(permissionDefault("gerente", "module.noticias")).toBe(true);
    expect(permissionDefault("atendimento", "action.news_create")).toBe(false);
    expect(permissionDefault("oficina", "action.home_layout")).toBe(false);
  });
  it("atendimento encaminha para oficina por padrão", () => {
    expect(permissionDefault("atendimento", "action.forward_workshop")).toBe(true);
    expect(permissionDefault("oficina", "action.forward_workshop")).toBe(false);
  });
  it("sem perfil não tem nada", () => {
    expect(permissionDefault(null, "module.veiculos")).toBe(false);
  });
});

import { permissionDefault as pd } from "./permissions";
describe("O.S. para a Oficina", () => {
  it("perfil Oficina consulta O.S. por padrão, mas não cria", () => {
    expect(pd("oficina", "module.os")).toBe(true);
    expect(pd("oficina", "action.create_os")).toBe(false);
  });
});
