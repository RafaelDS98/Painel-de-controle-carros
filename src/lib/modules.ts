export type ModuleKey = "agenda" | "historicos" | "oficina";
export const MODULES: { key: ModuleKey; label: string; path: "/" | "/historicos"; description: string }[] = [
  { key: "agenda", label: "Agenda", path: "/", description: "Agendamentos, indicadores e configurações permitidas ao perfil." },
  { key: "historicos", label: "Históricos", path: "/historicos", description: "Log geral de alterações, exportação e histórico por veículo." },
  { key: "oficina", label: "Oficina", path: "/", description: "Aba Oficina dentro da Agenda." },
];

/** Mantém só módulos conhecidos (o banco guarda texto livre para módulos futuros). */
export function knownModules(value: unknown): ModuleKey[] {
  if (!Array.isArray(value)) return [];
  return MODULES.map((module) => module.key).filter((key) => value.includes(key));
}

/** Primeira tela disponível para quem não tem a Agenda. */
export function landingPath(modules: ModuleKey[]): "/" | "/historicos" | null {
  return MODULES.find((module) => modules.includes(module.key))?.path ?? null;
}
