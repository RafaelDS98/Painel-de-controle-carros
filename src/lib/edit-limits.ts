export type LimitRole = "atendimento" | "gerente" | "master";

export type LimitCounters = { editsUsed: number; editsAllowed: number; managerEditsUsed: number };

const safeInt = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : fallback);

/** Limite total do atendimento neste agendamento: limite efetivo + extras já liberadas. */
export function atendimentoAllowance(limit: number, editsAllowed: number): number {
  return Math.max(1, safeInt(limit, 1)) + Math.max(0, safeInt(editsAllowed, 1) - 1);
}

/** Mesma regra do trigger do banco; null = pode editar. */
export function editLimitBlockReason(item: LimitCounters, role: LimitRole, limit: number): string | null {
  if (role === "master") return null;
  const eff = Math.max(1, safeInt(limit, 1));
  if (role === "gerente") {
    return safeInt(item.managerEditsUsed, 0) >= eff ? `Limite de ${eff} edição(ões) do gerente já foi usado neste agendamento.` : null;
  }
  const total = atendimentoAllowance(eff, item.editsAllowed);
  return safeInt(item.editsUsed, 0) >= total ? `Limite de ${total} edição(ões) do atendimento já foi atingido neste agendamento.` : null;
}
