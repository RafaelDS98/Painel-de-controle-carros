export type LimitRole = "atendimento" | "oficina" | "gerente" | "master";

export type DeadlineCounters = { deadlineChangesUsed: number; deadlineChangesAllowed: number };

const safeInt = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : fallback);

/** Gerente e master alteram a previsão livremente e liberam alterações extras. */
export const canManageDeadline = (role: LimitRole) => role === "gerente" || role === "master";

/** Mesma regra do trigger do banco para a Previsão de Entrega; null = pode alterar. */
export function deadlineBlockReason(item: DeadlineCounters, role: LimitRole): string | null {
  if (canManageDeadline(role)) return null;
  const used = Math.max(0, safeInt(item.deadlineChangesUsed, 0));
  const allowed = Math.max(0, safeInt(item.deadlineChangesAllowed, 1));
  return used >= allowed ? `Já houve ${used === 1 ? "1 alteração" : `${used} alterações`} da previsão. Peça autorização ao gerente ou master.` : null;
}

/** Os demais campos não têm limite de edições para nenhum perfil. */
export function editLimitBlockReason(): string | null {
  return null;
}
