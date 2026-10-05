export type ModuleKey = "agenda" | "historicos" | "oficina";
export const MODULES: { key: ModuleKey; label: string; path: "/" | "/historicos" | "/oficina"; description: string }[] = [
  { key: "agenda", label: "Agenda", path: "/", description: "Agendamentos, indicadores e configurações permitidas ao perfil." },
  { key: "historicos", label: "Históricos", path: "/historicos", description: "Log geral de alterações, exportação e histórico por veículo." },
  { key: "oficina", label: "Oficina", path: "/oficina", description: "Veículos encaminhados para a oficina do usuário." },
];

/** Mantém só módulos conhecidos (o banco guarda texto livre para módulos futuros). */
export function knownModules(value: unknown): ModuleKey[] {
  if (!Array.isArray(value)) return [];
  return MODULES.map((module) => module.key).filter((key) => value.includes(key));
}

/** Primeira tela disponível para quem não tem a Agenda. */
export function landingPath(modules: ModuleKey[]): "/" | "/historicos" | "/oficina" | null {
  return MODULES.find((module) => modules.includes(module.key))?.path ?? null;
}
