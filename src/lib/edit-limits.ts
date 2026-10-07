export type LimitRole = "atendimento" | "oficina" | "gerente" | "master";

export type DeadlineCounters = { deadlineChangesUsed: number; deadlineChangesAllowed: number };

const safeInt = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : fallback);

/** Gerente e master alteram a previsão livremente e liberam alterações extras. */
export const canManageDeadline = (role: LimitRole) => role === "gerente" || role === "master";

/** Extras liberadas por gerente/master no agendamento (allowed começa em 1). */
export const deadlineExtras = (item: DeadlineCounters) => Math.max(0, safeInt(item.deadlineChangesAllowed, 1) - 1);

/** Mesma regra do trigger: limite do usuário (individual ou do perfil) + extras; null = pode alterar. */
export function deadlineBlockReason(item: DeadlineCounters, role: LimitRole, userLimit = 1): string | null {
  if (canManageDeadline(role)) return null;
  const used = Math.max(0, safeInt(item.deadlineChangesUsed, 0));
  const limit = Math.max(1, safeInt(userLimit, 1)) + deadlineExtras(item);
  return used >= limit ? `Já houve ${used === 1 ? "1 alteração" : `${used} alterações`} da previsão. Peça autorização ao gerente ou master.` : null;
}
