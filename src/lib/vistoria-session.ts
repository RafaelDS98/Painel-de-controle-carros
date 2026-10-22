/** Sessão do módulo Vistorias no celular: fica aberta por até 12h desde o login. */
export const VISTORIA_SESSION_HOURS = 12;
export const VISTORIA_LOGIN_KEY = "vistoria-login-at";

export function isVistoriaSessionExpired(loginAt: number | null, now: number): boolean {
  if (loginAt == null || !Number.isFinite(loginAt)) return false;
  return now - loginAt > VISTORIA_SESSION_HOURS * 3600_000;
}

/** Quem tem algum outro módulo vê o botão "Voltar ao painel ANPEXC". */
export function hasPanelAccess(perms: ReadonlySet<string>): boolean {
  return ["module.agenda", "module.oficina", "module.os", "module.veiculos", "module.historicos"].some(
    (p) => perms.has(p),
  );
}
