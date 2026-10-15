// Regras de transição de status, cores e labels para Ordens de Serviço.
import type { OsStatusCode, OsStatus } from "./os-types";

/** Transições permitidas por status atual (não-master). Master pode qualquer transição. */
const ALLOWED_TRANSITIONS: Record<number, OsStatusCode[]> = {
  2: [4, 3], // Para aprovação → Aprovada, Cancelada
  4: [1, 3], // Aprovada → Em andamento, Cancelada
  1: [7],    // Em andamento → Finalizada
  6: [2, 3], // Em cotação → Para aprovação, Cancelada
  5: [1, 3], // Aguardando entrega → Em andamento, Cancelada
  3: [],     // Cancelada → nenhuma (terminal)
  7: [],     // Finalizada → nenhuma (terminal)
};

/** Verifica se a transição é permitida para o papel dado. */
export function canTransition(currentStatus: number, newStatus: OsStatusCode, isMaster: boolean): boolean {
  if (isMaster) return true;
  const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
  return allowed.includes(newStatus);
}

/** Retorna os status possíveis a partir do atual. */
export function allowedNextStatuses(currentStatus: number, isMaster: boolean, allStatuses: OsStatus[]): OsStatus[] {
  if (isMaster) return allStatuses.filter((s) => s.id !== currentStatus);
  const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
  return allStatuses.filter((s) => allowed.includes(s.id as OsStatusCode));
}

/** Verifica se o status permite finalização. */
export function canFinalize(statusId: number, isMaster: boolean): boolean {
  if (isMaster) return true;
  return statusId === 1; // Em andamento
}

/** Verifica se o status é terminal (não permite mais transições não-master). */
export function isTerminal(statusId: number): boolean {
  return statusId === 3 || statusId === 7; // Cancelada ou Finalizada
}

/** Label legível do tipo de atendimento. */
export function tipoAtendimentoLabel(code: string): string {
  const labels: Record<string, string> = { P: "Programado", E: "Emergência", N: "Normal", D: "Retorno" };
  return labels[code] ?? code;
}

/** Cor de fundo suave para badge de status. */
export function statusBgColor(color: string): string {
  return color + "1a"; // 10% opacity hex
}

/** Texto de cor para badge de status. */
export function statusTextColor(color: string): string {
  return color;
}

/** Ordem de exibição dos status na lista de filtros. */
export const STATUS_DISPLAY_ORDER: OsStatusCode[] = [2, 4, 1, 6, 5, 3, 7];

/** Status padrão ao criar nova O.S. */
export const DEFAULT_STATUS_ID: OsStatusCode = 2; // Para aprovação

/** Labels dos status por código. */
export const STATUS_LABELS: Record<number, string> = {
  1: "Em andamento",
  2: "Para aprovação",
  3: "Cancelada",
  4: "Aprovada",
  5: "Aguardando entrega",
  6: "Em cotação",
  7: "Finalizada",
};

/** Cores dos status por código. */
export const STATUS_COLORS: Record<number, string> = {
  1: "#10b981",
  2: "#f59e0b",
  3: "#6b7280",
  4: "#3b82f6",
  5: "#ec4899",
  6: "#8b5cf6",
  7: "#059669",
};