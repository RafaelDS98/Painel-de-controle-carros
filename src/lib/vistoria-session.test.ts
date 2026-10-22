import { describe, expect, it } from "vitest";
import { hasPanelAccess, isVistoriaSessionExpired } from "./vistoria-session";
import { permissionDefault } from "./permissions";

const H = 3600_000;

describe("sessão de vistorias", () => {
  it("continua aberta até 12h e expira depois", () => {
    expect(isVistoriaSessionExpired(0, 12 * H)).toBe(false);
    expect(isVistoriaSessionExpired(0, 12 * H + 1)).toBe(true);
  });
  it("sem registro de login não expira", () => {
    expect(isVistoriaSessionExpired(null, 99 * H)).toBe(false);
  });
  it("botão de voltar ao painel só para quem tem outro módulo", () => {
    expect(hasPanelAccess(new Set(["module.vistorias"]))).toBe(false);
    expect(hasPanelAccess(new Set(["module.vistorias", "module.agenda"]))).toBe(true);
  });
});

describe("permissões padrão de vistorias", () => {
  it("todos os perfis fazem vistoria; cancelar e configurar só gerente/master", () => {
    expect(permissionDefault("atendimento", "action.inspection_create")).toBe(true);
    expect(permissionDefault("oficina", "module.vistorias")).toBe(true);
    expect(permissionDefault("atendimento", "action.inspection_cancel")).toBe(false);
    expect(permissionDefault("gerente", "action.inspection_config")).toBe(true);
  });
});
